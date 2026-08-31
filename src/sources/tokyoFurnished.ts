import type { SearchFormState } from '../types'
import type { SourceAdapter, SourceSearchResult, UniversalListing } from './types'

const TF_API = 'https://tokyo-furnished.com/wp-json/wp/v2'
const CACHE_MS = 10 * 60 * 1000

let cacheAt = 0
let cachedRooms: UniversalListing[] | null = null

async function loadRooms(): Promise<UniversalListing[]> {
  if (cachedRooms && Date.now() - cacheAt < CACHE_MS) return cachedRooms
  const [roomsRes, catsRes] = await Promise.all([
    fetch(`${TF_API}/mphb_room_type?per_page=100&_embed`, { signal: AbortSignal.timeout(20000) }),
    fetch(`${TF_API}/mphb_room_type_category?per_page=100`, { signal: AbortSignal.timeout(20000) }),
  ])
  if (!roomsRes.ok || !catsRes.ok) throw new Error(`Tokyo Furnished failed: ${roomsRes.status}`)
  const rooms = (await roomsRes.json()) as Array<{
    id: number
    link: string
    title: { rendered: string }
    content: { rendered: string }
    mphb_room_type_category: number[]
    _embedded?: { 'wp:featuredmedia'?: Array<{ source_url: string }> }
  }>
  const cats = (await catsRes.json()) as Array<{ id: number; name: string }>
  const catName = new Map(cats.map((c) => [c.id, c.name]))

  const out: UniversalListing[] = []
  for (const r of rooms) {
    const c = r.content?.rendered ?? ''
    const price = parsePrice(c)
    const coords = parseCoords(c)
    const adults = [...c.matchAll(/mphb-room-type-adults-(\d+)/g)].map((m) => Number(m[1]))
    const size = c.match(/(\d+(?:\.\d+)?)\s*m²|㎡/)?.[1]
    const layout = r.title.rendered.match(/\b(Studio|1K|1LDK|2K|2LDK|3LDK|4LDK)\b/i)?.[0]
    const area = r.mphb_room_type_category?.map((id) => catName.get(id)).filter(Boolean)[0] ?? 'Tokyo'
    if (!price || !coords) continue
    const image = r._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? ''
    out.push({
      id: `tokyofurnished:${r.id}`,
      name: r.title.rendered,
      layoutType: layout ?? 'Studio',
      size: size ? Number(size) : 0,
      maxNumberOfGuests: adults.length ? Math.max(...adults) : 0,
      totalDailyCost: price / 30,
      mainImageUrl: image,
      mainImageThumbnailUrl: image,
      location: coords,
      nearestStations: [],
      keywords: [],
      builtAt: { availability: '', buildYear: 0 },
      address: {
        prefecture: { prefectureId: '', prefectureName: 'Tokyo' },
        city: { cityId: '', cityName: area },
        streetAddress: '',
        buildingName: '',
      },
      listingSale: { listingSaleType: 'notSale' },
      reservationApprovalRequiredSetting: 'RequestBased',
      source: 'tokyofurnished',
      sourceName: 'Tokyo Furnished',
      sourceColor: '#f59e0b',
      sourceUrl: r.link,
    })
  }
  cachedRooms = out
  cacheAt = Date.now()
  return out
}

function parsePrice(c: string): number | null {
  const el = c.match(/th-(?:plist-price-number|pricing-cost)[^>]*>([^<]+)</)
  if (!el) return null
  const digits = el[1].replace(/[^0-9]/g, '')
  const v = Number(digits)
  return v > 0 ? v : null
}

function parseCoords(c: string): { lat: number; lng: number } | null {
  const m = c.match(/maps\.google\.com\/maps\?q=([0-9.-]+)%2C%20([0-9.-]+)/)
  if (!m) return null
  return { lat: Number(m[1]), lng: Number(m[2]) }
}

export const tokyoFurnishedAdapter: SourceAdapter = {
  id: 'tokyofurnished',
  name: 'Tokyo Furnished',
  color: '#f59e0b',
  perPage: 100,
  clientRadius: true,
  priceNote: 'base rent, utilities may be extra',
  supports: { cost: true, size: true, walk: false, buildYear: false, guestsOver2: true, instant: false },
  async search(form: SearchFormState): Promise<SourceSearchResult> {
    const rooms = await loadRooms()
    let list = rooms
    const q = form.locationName.toLowerCase()
    if (q && !/^tokyo/i.test(q)) {
      const matches = rooms.filter((r) => r.address.city.cityName.toLowerCase().includes(q))
      if (matches.length) list = matches
    }
    return { listings: list, total: list.length, hasMore: false }
  },
}
