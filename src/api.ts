import type { PlaceSuggestion, QuotationResponse, SearchFormState, SearchResponse } from './types'

const API_BASE = 'https://api-sumyca.m2msystems.cloud'
const PHOTON_BASE = 'https://photon.komoot.io/api/'
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse'

export interface SearchApiParams {
  locationName?: string
  radius?: number
  startDate?: string
  endDate?: string
  minNumGuests?: number
  maxCost?: number
  minCost?: number
  maxMinuteWalk?: number
  minSize?: number
  maxSize?: number
  buildYearAfter?: number
  instantBooking?: boolean
  sort?: 'costAsc' | 'costDesc'
  page?: number
  itemsPerPage?: number
  locale?: string
}

export function buildSearchParams(form: SearchFormState, page: number, itemsPerPage: number): SearchApiParams {
  const params: SearchApiParams = {
    locationName: form.locationName,
    radius: form.radius,
    buildYearAfter: form.buildYearAfter,
    minNumGuests: form.numGuests,
    // 'newest' istemci tarafında uygulanır; API yalnızca fiyat sıralamasını bilir
    sort: form.sort === 'newest' ? 'costAsc' : form.sort,
    page,
    itemsPerPage,
    locale: 'en',
  }
  if (form.startDate && form.endDate) {
    params.startDate = form.startDate
    params.endDate = form.endDate
  }
  // form aylık (¥/ay), API günlük (¥/gün) bekliyor
  if (form.maxCost) params.maxCost = Math.round(form.maxCost / 30)
  if (form.minCost) params.minCost = Math.round(form.minCost / 30)
  if (form.maxMinuteWalk) params.maxMinuteWalk = form.maxMinuteWalk
  if (form.minSize) params.minSize = form.minSize
  if (form.maxSize) params.maxSize = form.maxSize
  if (form.instantBooking) params.instantBooking = true
  return params
}

export async function searchListings(form: SearchFormState, page: number, itemsPerPage: number): Promise<SearchResponse> {
  const params = buildSearchParams(form, page, itemsPerPage)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== false) qs.set(k, String(v))
  }
  const res = await fetch(`${API_BASE}/search_listings_with_room_type/location_name_and_conditions?${qs.toString()}`, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return (await res.json()) as SearchResponse
}

export async function fetchQuotes(listingIds: string[], startDate: string, endDate: string, persons: number): Promise<Record<string, QuotationResponse['data'][number]>> {
  const out: Record<string, QuotationResponse['data'][number]> = {}
  const chunks: string[][] = []
  for (let i = 0; i < listingIds.length; i += 50) chunks.push(listingIds.slice(i, i + 50))
  for (const chunk of chunks) {
    const res = await fetch(`${API_BASE}/quotation_estimates`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds: chunk, staySpan: { startDate, endDate }, persons }),
    })
    if (!res.ok) continue
    const json = (await res.json()) as QuotationResponse
    for (const q of json.data ?? []) out[q.listingId] = q
  }
  return out
}

export async function autocompletePlace(q: string): Promise<PlaceSuggestion[]> {
  if (!q.trim()) return []
  const qs = new URLSearchParams({ q, limit: '7' })
  let res: Response
  try {
    res = await fetch(`${PHOTON_BASE}?${qs.toString()}`, { signal: AbortSignal.timeout(10000) })
  } catch {
    return []
  }
  if (!res.ok) return []
  const json = (await res.json()) as {
    features: Array<{
      geometry: { coordinates: [number, number] }
      properties: {
        osm_id?: number
        osm_type?: string
        osm_key?: string
        name?: string
        city?: string
        state?: string
        country?: string
        county?: string
      }
    }>
  }
  const seen = new Set<string>()
  const out: PlaceSuggestion[] = []
  for (const f of json.features ?? []) {
    const p = f.properties ?? {}
    const key = `${p.osm_type ?? ''}:${p.osm_id ?? ''}`
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    const city = p.city ?? p.county ?? ''
    const parts = [p.name, city, p.state, p.country].filter((x) => x && x.trim())
    const label = [...new Set(parts)].join(', ')
    if (!label) continue
    out.push({
      name: p.name ?? label,
      city,
      state: p.state ?? '',
      country: p.country ?? '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label,
    })
  }
  return out.slice(0, 7)
}

export interface ReverseGeocodeResult {
  name: string
  district: string
  city: string
  state: string
  country: string
  label: string
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  let res: Response
  try {
    res = await fetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lng}`, { signal: AbortSignal.timeout(10000) })
  } catch {
    return null
  }
  if (!res.ok) return null
  const json = (await res.json()) as {
    features: Array<{ properties: { name?: string; district?: string; city?: string; state?: string; country?: string; county?: string } }>
  }
  const f = json.features?.[0]
  if (!f) return null
  const p = f.properties ?? {}
  const city = p.city ?? p.county ?? ''
  const district = p.district ?? ''
  const parts = [district, city, p.state, p.country].filter((x) => x && x.trim())
  return {
    name: p.name ?? district ?? city,
    district,
    city,
    state: p.state ?? '',
    country: p.country ?? '',
    label: [...new Set(parts)].join(', '),
  }
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
