import type { UniversalListing } from './sources'
import { haversineKm } from './api'

export interface TransitHubDef {
  id: string
  en: string
  ja: string
  lat: number
  lng: number
}

export interface StationRow {
  lat: number
  lng: number
  t: (number | null)[]
}

let dataPromise: Promise<typeof import('./data/transit')> | null = null
let byName: Map<string, StationRow> | null = null
let byLat: { lat: number; row: StationRow }[] | null = null

function loadData() {
  if (!dataPromise) {
    dataPromise = import('./data/transit').then((mod) => {
      byName = new Map(Object.entries(mod.TRANSIT_STATIONS))
      byLat = [...byName.entries()].map(([, row]) => ({ lat: row.lat, row }))
      byLat.sort((a, b) => a.lat - b.lat)
      return mod
    })
  }
  return dataPromise
}

export function transitHubs(): Promise<TransitHubDef[]> {
  return loadData().then((mod) => mod.TRANSIT_HUBS)
}

// build script'indeki normName ile aynı kurallar
function normName(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/station|sta\.|monorail|railway|エキ/g, '')
    .replace(/駅/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '')
}

// "京王線新宿駅" gibi hat önekli adlardan istasyon adını ayıkla
function stripLinePrefix(s: string): string {
  const i = s.lastIndexOf('線')
  return i >= 0 ? s.slice(i + 1) : s
}

function lookupStation(name: string): StationRow | null {
  if (!byName) return null
  let n = normName(name)
  let hit = byName.get(n)
  if (hit) return hit
  const stripped = stripLinePrefix(name)
  if (stripped !== name) {
    n = normName(stripped)
    hit = byName.get(n)
    if (hit) return hit
  }
  // "JR渋谷駅" / "東京メトロ渋谷駅" gibi önekleri temizle
  const m = /^(?:JR|メトロ|東京メトロ|都営|京王|京成|京急|東急|西武|東武|小田急|つくばエクスプレス|東京モノレール|ゆりかもめ|りんかい)([^\u3040-\u30ff\u4e00-\u9fffa-z]{0,4})(.+)$/i.exec(name)
  if (m) {
    n = normName(m[2])
    hit = byName.get(n)
    if (hit) return hit
  }
  return null
}

// koordinattan en yakın istasyonlara snap (haversine bant + lineer tarama)
const WALK_MIN_PER_KM = 12
const SNAP_MAX_KM = 3
const SNAP_K = 3

function snapNearest(lat: number, lng: number): { walk: number; row: StationRow }[] {
  if (!byLat) return []
  let lo = 0
  let hi = byLat.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (byLat[mid].lat < lat - 0.1) lo = mid + 1
    else hi = mid
  }
  const cands: { walk: number; row: StationRow }[] = []
  for (let i = lo; i < byLat.length && byLat[i].lat <= lat + 0.1; i++) {
    const row = byLat[i].row
    const d = haversineKm(lat, lng, row.lat, row.lng)
    if (d > SNAP_MAX_KM) continue
    cands.push({ walk: d * WALK_MIN_PER_KM, row })
  }
  cands.sort((a, b) => a.walk - b.walk)
  return cands.slice(0, SNAP_K)
}

export interface TransitTimes {
  hubIds: string[]
  hubLabels: string[]
  minutes: Record<string, number>
}

const cache = new Map<string, Promise<TransitTimes | null>>()

export function transitTimesFor(listing: UniversalListing): Promise<TransitTimes | null> {
  const key = `${listing.id}:${listing.location?.lat}:${listing.location?.lng}:${(listing.nearestStations ?? []).map((s) => `${s.stationName}:${s.minuteWalk}`).join('|')}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = loadData()
    .then((mod) => {
      const cands: { walk: number; row: StationRow }[] = []
      for (const st of listing.nearestStations ?? []) {
        const row = lookupStation(st.stationName)
        if (row) cands.push({ walk: st.minuteWalk, row })
      }
      if (!cands.length && listing.location) {
        cands.push(...snapNearest(listing.location.lat, listing.location.lng))
      }
      if (!cands.length) return null
      const minutes: Record<string, number> = {}
      mod.TRANSIT_HUBS.forEach((h, hi) => {
        let best = Infinity
        for (const c of cands) {
          const v = c.row.t[hi]
          if (v != null && v + c.walk < best) best = v + c.walk
        }
        if (Number.isFinite(best)) minutes[h.id] = Math.round(best)
      })
      if (Object.keys(minutes).length === 0) return null
      return { hubIds: mod.TRANSIT_HUBS.map((h) => h.id), hubLabels: mod.TRANSIT_HUBS.map((h) => h.en), minutes }
    })
    .catch(() => null)
  cache.set(key, p)
  if (cache.size > 2000) cache.clear()
  return p
}
