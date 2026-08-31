import { haversineKm } from '../api'
import { monthlyAmount } from '../price'
import type { SearchFormState } from '../types'
import { bluegroundAdapter } from './blueground'
import { exflatsAdapter } from './exflats'
import { hmletAdapter } from './hmlet'
import { sumycaAdapter } from './sumyca'
import { tokyoFurnishedAdapter } from './tokyoFurnished'
import type { SourceAdapter, SourceId, SourceSearchResult, UniversalListing } from './types'

export type { SourceAdapter, SourceId, SourceSearchResult, UniversalListing } from './types'

export const SOURCES: SourceAdapter[] = [sumycaAdapter, hmletAdapter, bluegroundAdapter, tokyoFurnishedAdapter, exflatsAdapter]

export const ALL_SOURCE_IDS: SourceId[] = SOURCES.map((s) => s.id)

export function selectedSourceIds(form: SearchFormState): SourceId[] {
  return form.sources.length ? form.sources : ALL_SOURCE_IDS
}

export function applyUniversalFilters(listings: UniversalListing[], form: SearchFormState): UniversalListing[] {
  return listings.filter((l) => {
    const amt = monthlyAmount({ listing: l })
    if (form.maxCost && amt > form.maxCost) return false
    if (form.minCost && amt < form.minCost) return false
    if (form.minSize && l.size && l.size < form.minSize) return false
    if (form.maxSize && l.size && l.size > form.maxSize) return false
    if (form.maxMinuteWalk && l.nearestStations.length) {
      if (Math.min(...l.nearestStations.map((s) => s.minuteWalk)) > form.maxMinuteWalk) return false
    }
    if (form.buildYearAfter && l.builtAt.buildYear && l.builtAt.buildYear < form.buildYearAfter) return false
    if (form.numGuests && l.maxNumberOfGuests && l.maxNumberOfGuests < form.numGuests) return false
    if (form.instantBooking && l.reservationApprovalRequiredSetting !== 'ImmediateReservationRequest') return false
    return true
  })
}

// Kaynağın uygulayamayacağı (bu aramada aktif olan) filtreler; kaynak gizlenmez, yumuşak not düşülür
function unsupportedFor(a: SourceAdapter, form: SearchFormState): string[] {
  const out: string[] = []
  if ((form.maxCost || form.minCost) && !a.supports.cost) out.push('price range')
  if ((form.minSize || form.maxSize) && !a.supports.size) out.push('size')
  if (form.maxMinuteWalk && !a.supports.walk) out.push('walk minutes')
  if (form.buildYearAfter && !a.supports.buildYear) out.push('build year')
  if (form.numGuests > 2 && !a.supports.guestsOver2) out.push('3+ guests')
  if (form.instantBooking && !a.supports.instant) out.push('instant booking')
  return out
}

export function sortListings(listings: UniversalListing[], sort: SearchFormState['sort']): UniversalListing[] {
  const dir = sort === 'costDesc' ? -1 : 1
  return [...listings].sort((a, b) => dir * (monthlyAmount({ listing: a }) - monthlyAmount({ listing: b })))
}

// Farklı kaynaklardan gelen sonuçlar için arama merkezi: client-radius'lu kaynakların koordinat medyanı
function radiusCenter(listings: UniversalListing[]): { lat: number; lng: number } | null {
  const pts = listings.filter((l) => SOURCES.find((x) => x.id === l.source)?.clientRadius)
  if (pts.length === 0) return null
  const mid = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }
  return { lat: mid(pts.map((p) => p.location.lat)), lng: mid(pts.map((p) => p.location.lng)) }
}

function applyRadius(listings: UniversalListing[], form: SearchFormState): UniversalListing[] {
  if (form.radius <= 0) return listings
  const center = radiusCenter(listings)
  if (!center) return listings
  return listings.filter((l) => {
    const a = SOURCES.find((x) => x.id === l.source)
    if (!a?.clientRadius) return true
    return haversineKm(center.lat, center.lng, l.location.lat, l.location.lng) <= form.radius
  })
}

export function finalizeListings(listings: UniversalListing[], form: SearchFormState): UniversalListing[] {
  return sortListings(applyRadius(applyUniversalFilters(listings, form), form), form.sort)
}

export interface SourceRun {
  listings: UniversalListing[]
  hasMore: boolean
  notes: string[]
  next: Record<SourceId, { page: number; hasMore: boolean }>
}

export async function searchAllSources(form: SearchFormState, page: number): Promise<SourceRun> {
  const ids = selectedSourceIds(form)
  const adapters = SOURCES.filter((a) => ids.includes(a.id))
  const notes: string[] = []
  const jobs = adapters.map(async (a) => {
    try {
      const res = await a.search(form, page)
      if (res.note) notes.push(`${a.name}: ${res.note}`)
      return { adapter: a, res }
    } catch {
      notes.push(`${a.name}: failed to load`)
      return { adapter: a, res: { listings: [], total: 0, hasMore: false } as SourceSearchResult }
    }
  })
  const settled = await Promise.all(jobs)

  for (const s of settled) {
    const unsupported = unsupportedFor(s.adapter, form)
    if (unsupported.length > 0 && s.res.listings.length > 0) {
      notes.push(`${s.adapter.name}: ${unsupported.join(', ')} filter not available, showing all`)
    }
  }

  let listings = settled.flatMap((s) => s.res.listings)
  listings = finalizeListings(listings, form)

  const next = {} as Record<SourceId, { page: number; hasMore: boolean }>
  for (const s of settled) next[s.adapter.id] = { page, hasMore: s.res.hasMore }
  return { listings, hasMore: Object.values(next).some((v) => v.hasMore), notes, next }
}
