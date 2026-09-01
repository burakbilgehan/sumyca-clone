import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// İstasyonları mini-tokyo-3d (ODPT kaynaklı) verisinden bir graf olarak kurup
// merkezlere (Shibuya, Shinjuku, ...) Dijkstra ile tahmini toplu taşıma süreleri üretir.
// Model: hat boyu komşu istasyon kenarları (mesafe * eğrilik / hat hızı + durak süresi),
// aynı istasyonda hatlar arası aktarma cezası, ilk biniş bekleme süresi ve
// havalimanı koridorları için sabit ekspres kenarları (Keisei/NEX/Keikyu/Monorail).

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = 'https://raw.githubusercontent.com/nagix/mini-tokyo-3d/master/data'

async function get(name) {
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) throw new Error(`${name} -> ${res.status}`)
  return res.json()
}

const railways = await get('railways.json')
const stations = await get('stations.json')

// ---- sabitler ----
const TRANSFER_MIN = 5.0 // aynı istasyonda hat değiştirme (yürüyüş + bekleme)
const START_WAIT_MIN = 4.0 // ilk binişte ortalama bekleme
const CURVATURE = 1.12 // kuş uçuşu -> ray boyu düzeltmesi
const MERGE_RADIUS_KM = 0.7 // aynı adlı istasyon platformlarını tek düğüme birleştirme
const MAX_SEG_KM = 12 // bundan uzun komşu çifti veri hatası say, kenar ekleme (Sobu Rapid ~9km aralıklar içerir)

// hızlar: duruşlar dahil ortalama işletme hızı (km/s) - gerçek tarifelerden kalibre
function lineSpeedKmh(id) {
  if (/Shinkansen/.test(id)) return 130
  if (/Keisei/.test(id)) return 40
  if (/Keikyu/.test(id)) return 38
  if (/Monorail/.test(id)) return 32
  if (/TokyoMetro|Toei|Metro/.test(id)) return 30
  if (/Toden|Tram/.test(id)) return 15
  // JR hızlı/ekspres hatları yerel duruşlu hatlardan ayrıştır
  if (/SobuRapid/.test(id)) return 55
  if (/ChuoRapid/.test(id)) return 45
  if (/Yokosuka/.test(id)) return 50
  if (/JR-East\.Tokaido/.test(id)) return 50
  if (/JR-East\.Utsunomiya/.test(id)) return 45
  if (/JR-East/.test(id)) return 34
  return 29
}

// ---- isim normalizasyonu (runtime ile aynı kurallar) ----
function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/station|sta\.|monorail|railway|エキ/g, '')
    .replace(/駅/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '')
}

// ---- istasyonları düğümlere kümele ----
const lineIdx = new Map()
railways.forEach((r, i) => lineIdx.set(r.id, i))

const clusters = []
const clusterByName = new Map() // normName -> [clusterIdx...]
const rawByRailway = new Map() // railway idx -> [{c, lat, lng}]

for (const s of stations) {
  if (!s.coord || s.coord.length < 2) continue
  const li = lineIdx.get(s.railway)
  if (li == null) continue
  const lat = s.coord[1]
  const lng = s.coord[0]
  const en = s.title?.en || ''
  const ja = s.title?.ja || ''
  const name = en || ja
  if (!name) continue
  const key = normName(en) || normName(ja)
  if (!key) continue

  // aynı ad, 700m içinde -> aynı küme
  let ci = -1
  const bucket = clusterByName.get(key)
  if (bucket) {
    for (const i of bucket) {
      const c = clusters[i]
      const d = Math.hypot((lat - c.lat) * 111, (lng - c.lng) * 91)
      if (d <= MERGE_RADIUS_KM) {
        ci = i
        break
      }
    }
  }
  if (ci === -1) {
    ci = clusters.length
    clusters.push({ key, lat, lng, ja, lines: new Set() })
    clusterByName.set(key, [...(bucket ?? []), ci])
  }
  clusters[ci].lines.add(li)

  const arr = rawByRailway.get(li) ?? []
  const last = arr[arr.length - 1]
  if (!last || last.c !== ci) arr.push({ c: ci, lat, lng })
  rawByRailway.set(li, arr)
}

// ---- graf: düğüm = (küme, hat) ----
const nodeOf = new Map() // `${c}:${l}` -> node idx
const nodes = [] // { c, l, edges: [[node, min]] }
const getNode = (c, l) => {
  const k = `${c}:${l}`
  let n = nodeOf.get(k)
  if (n == null) {
    n = nodes.length
    nodeOf.set(k, n)
    nodes.push({ c, l, edges: [] })
  }
  return n
}

const addEdge = (a, b, min) => {
  nodes[a].edges.push([b, min])
  nodes[b].edges.push([a, min])
}

for (const [li, seq] of rawByRailway) {
  const speed = lineSpeedKmh(railways[li].id)
  for (let i = 1; i < seq.length; i++) {
    const p = seq[i - 1]
    const q = seq[i]
    if (p.c === q.c) continue
    const dLatKm = (q.lat - p.lat) * 111
    const dLngKm = (q.lng - p.lng) * 91
    const dist = Math.hypot(dLatKm, dLngKm)
    if (dist > MAX_SEG_KM) continue
    const min = (dist * CURVATURE / speed) * 60
    addEdge(getNode(p.c, li), getNode(q.c, li), min)
  }
}

// aynı küme içinde hatlar arası aktarma
for (let ci = 0; ci < clusters.length; ci++) {
  const ls = [...clusters[ci].lines]
  for (let i = 0; i < ls.length; i++) {
    for (let j = i + 1; j < ls.length; j++) {
      addEdge(getNode(ci, ls[i]), getNode(ci, ls[j]), TRANSFER_MIN)
    }
  }
}

// ---- havalimanı ekspres kenarları (tarifeli servislerin modeli) ----
const AIRPORT_EDGES = [
  ['nippori', 'naritaairportterminal1', 45],
  ['nippori', 'naritaairportterminal2and3', 45],
  ['tokyo', 'naritaairportterminal1', 62],
  ['tokyo', 'naritaairportterminal2and3', 62],
  ['shinagawa', 'hanedaairportterminal3', 18],
  ['shinagawa', 'hanedaairportterminal1and2', 20],
  ['hamamatsucho', 'hanedaairportterminal1', 25],
  ['hamamatsucho', 'hanedaairportterminal2', 25],
]
const airportCandidates = new Map() // key -> küme idx listesi
for (let i = 0; i < clusters.length; i++) {
  const key = clusters[i].key
  if (/^(naritaairport|hanedaairport)/.test(key)) {
    airportCandidates.set(key, [...(airportCandidates.get(key) ?? []), i])
  }
}
for (const [from, to, min] of AIRPORT_EDGES) {
  const fs = clusterByName.get(from) ?? []
  const ts = airportCandidates.get(to) ?? clusterByName.get(to) ?? []
  for (const f of fs) {
    for (const t of ts) {
      if (f === t) continue
      const lf = [...clusters[f].lines][0]
      const lt = [...clusters[t].lines][0]
      addEdge(getNode(f, lf), getNode(t, lt), min)
    }
  }
}

// ---- Dijkstra ----
function dijkstra(startC) {
  const dist = new Map()
  const prev = new Map()
  const seen = new Set()
  const pq = []
  const push = (n, d) => {
    pq.push([d, n])
    pq.sort((a, b) => a[0] - b[0]) // küçük grafikte yeterli
  }
  for (const l of clusters[startC].lines) {
    const n = getNode(startC, l)
    dist.set(n, START_WAIT_MIN)
    prev.set(n, null)
    push(n, START_WAIT_MIN)
  }
  while (pq.length) {
    const [d, n] = pq.shift()
    if (seen.has(n)) continue
    seen.add(n)
    for (const [m, w] of nodes[n].edges) {
      const nd = d + w
      if (nd < (dist.get(m) ?? Infinity)) {
        dist.set(m, nd)
        prev.set(m, n)
        push(m, nd)
      }
    }
  }
  // küme bazında: o kümedeki herhangi bir düğüme varış minimumu
  const out = new Array(clusters.length).fill(Infinity)
  out[startC] = 0
  for (const [n, d] of dist) {
    const c = nodes[n].c
    if (d < out[c]) out[c] = d
  }
  return { out, prev }
}

const HUBS = [
  { id: 'shibuya', en: 'Shibuya', ja: '渋谷', key: 'shibuya', lat: 35.658, lng: 139.701 },
  { id: 'shinjuku', en: 'Shinjuku', ja: '新宿', key: 'shinjuku', lat: 35.69, lng: 139.7 },
  { id: 'asakusa', en: 'Asakusa', ja: '浅草', key: 'asakusa', lat: 35.711, lng: 139.798 },
  { id: 'akihabara', en: 'Akihabara', ja: '秋葉原', key: 'akihabara', lat: 35.698, lng: 139.773 },
  { id: 'roppongi', en: 'Roppongi', ja: '六本木', key: 'roppongi', lat: 35.663, lng: 139.731 },
  { id: 'ginza', en: 'Ginza', ja: '銀座', key: 'ginza', lat: 35.672, lng: 139.765 },
  { id: 'haneda', en: 'Haneda', ja: '羽田', key: 'haneda', lat: 35.549, lng: 139.779, prefix: 'hanedaairport' },
  { id: 'narita', en: 'Narita', ja: '成田', key: 'narita', lat: 35.773, lng: 140.388, prefix: 'naritaairport' },
]

const hubClusterIdx = []
for (const h of HUBS) {
  if (h.prefix) {
    const idxs = [...clusterByName.entries()].filter(([k]) => k.startsWith(h.prefix)).flatMap(([, v]) => v)
    hubClusterIdx.push(idxs)
  } else {
    hubClusterIdx.push(clusterByName.get(h.key) ?? [])
  }
  if (hubClusterIdx[hubClusterIdx.length - 1].length === 0) console.warn(`HUB ${h.id} bulunamadı`)
}

// her küme için hub süreleri: hub bazlı Dijkstra sonuçlarını birleştir
const hubDists = HUBS.map((_, h) => {
  const mins = new Array(clusters.length).fill(Infinity)
  for (const c of hubClusterIdx[h]) {
    const { out } = dijkstra(c)
    for (let i = 0; i < out.length; i++) if (out[i] < mins[i]) mins[i] = out[i]
  }
  return mins
})

// ---- çıktı: normName -> { lat, lng, t[8] } (aynı adlı kümelerin minimumu) ----
const out = new Map()
const mergeRow = (key, lat, lng, t) => {
  const prev = out.get(key)
  if (!prev) {
    out.set(key, { lat, lng, t })
    return
  }
  for (let h = 0; h < t.length; h++) {
    if (t[h] != null && (prev.t[h] == null || t[h] < prev.t[h])) prev.t[h] = t[h]
  }
}
for (let i = 0; i < clusters.length; i++) {
  const c = clusters[i]
  const t = HUBS.map((_, h) => {
    const v = hubDists[h][i]
    return Number.isFinite(v) ? Math.round(v) : null
  })
  mergeRow(c.key, c.lat, c.lng, t)
  if (c.ja) {
    const jk = normName(c.ja)
    if (jk && jk !== c.key) mergeRow(jk, c.lat, c.lng, t)
  }
}

// ---- sanity print ----
const hubIdxOf = new Map(HUBS.map((h, i) => [h.id, i]))
const rowOf = (name) => out.get(normName(name))
const pairs = [
  ['shibuya', 'Shinjuku'],
  ['shibuya', 'Ginza'],
  ['shibuya', 'Asakusa'],
  ['shibuya', 'Akihabara'],
  ['shibuya', 'Roppongi'],
  ['shibuya', 'Haneda Airport Terminal 3'],
  ['shibuya', 'Narita Airport Terminal 1'],
  ['shinjuku', 'Tokyo'],
  ['shinjuku', 'Hachioji'],
  ['shinjuku', 'Chiba'],
  ['shinjuku', 'Haneda Airport Terminal 3'],
  ['shinjuku', 'Narita Airport Terminal 1'],
  ['asakusa', 'Ginza'],
  ['asakusa', 'Narita Airport Terminal 1'],
  ['roppongi', 'Akihabara'],
  ['roppongi', 'Haneda Airport Terminal 3'],
  ['ginza', 'Akihabara'],
  ['ginza', 'Haneda Airport Terminal 3'],
]
console.log('sanity (hub -> istasyon, dakika):')
for (const [h, b] of pairs) {
  const r = rowOf(b)
  const v = r ? r.t[hubIdxOf.get(h)] : null
  console.log(`  ${HUBS[hubIdxOf.get(h)].en} -> ${b}: ${v == null ? 'YOK' : v}`)
}

// ---- TS dosyası ----
const hubsTxt = HUBS.map((h) => ({ id: h.id, en: h.en, ja: h.ja, lat: h.lat, lng: h.lng }))
const rows = [...out.entries()].map(([k, v]) => [k, { lat: Math.round(v.lat * 1000) / 1000, lng: Math.round(v.lng * 1000) / 1000, t: v.t }])
const ts = `// Auto-generated by scripts/build-transit-matrix.mjs (mini-tokyo-3d graph + Dijkstra, tahmini süreler).
export interface TransitHubDef { id: string; en: string; ja: string; lat: number; lng: number }
export const TRANSIT_HUBS: TransitHubDef[] = ${JSON.stringify(hubsTxt)}
// key = normalize edilmiş istasyon adı; t = TRANSIT_HUBS sırasıyla dakika (null: ulaşılamaz)
export const TRANSIT_STATIONS: Record<string, { lat: number; lng: number; t: (number | null)[] }> = ${JSON.stringify(Object.fromEntries(rows))}
`

const dest = path.join(__dirname, '..', 'src', 'data', 'transit.ts')
fs.writeFileSync(dest, ts)
console.log(`wrote ${dest}: ${rows.length} istasyon, ${(ts.length / 1024).toFixed(0)} KB`)
