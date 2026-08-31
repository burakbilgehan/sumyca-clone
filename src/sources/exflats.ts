import { WORKER_BASE } from '../config'
import type { SearchFormState } from '../types'
import type { SourceAdapter, SourceSearchResult, UniversalListing } from './types'

interface ExflatItem {
  id: string
  title: string
  priceMonthly: number
  layout: string
  size: number
  capacity: number
  address: string
  stations: Array<{ name: string; walk: number }>
  image: string
  lat: number
  lng: number
  url: string
}

function emptyResult(note?: string): SourceSearchResult {
  return { listings: [], total: 0, hasMore: false, note }
}

export const exflatsAdapter: SourceAdapter = {
  id: 'exflats',
  name: 'Exflats',
  color: '#ef4444',
  perPage: 100,
  clientRadius: true,
  priceNote: 'utilities incl., cleaning fee extra',
  supports: { cost: true, size: true, walk: true, buildYear: false, guestsOver2: true, instant: false },
  async search(form: SearchFormState): Promise<SourceSearchResult> {
    if (!/sapporo|札幌/i.test(form.locationName)) return emptyResult()
    if (!WORKER_BASE) return emptyResult('proxy not configured (VITE_WORKER_BASE)')
    const res = await fetch(`${WORKER_BASE}/sources/exflats`, { signal: AbortSignal.timeout(90000) })
    if (!res.ok) throw new Error(`Exflats failed: ${res.status}`)
    const json = (await res.json()) as { items: ExflatItem[] }
    const listings: UniversalListing[] = (json.items ?? []).map((it) => ({
      id: `exflats:${it.id}`,
      name: it.title,
      layoutType: it.layout || '1K',
      size: it.size ?? 0,
      maxNumberOfGuests: it.capacity ?? 1,
      totalDailyCost: (it.priceMonthly ?? 0) / 30,
      mainImageUrl: it.image ?? '',
      mainImageThumbnailUrl: it.image ?? '',
      location: { lat: it.lat, lng: it.lng },
      nearestStations: (it.stations ?? []).map((s) => ({ lineName: '', stationName: s.name, minuteWalk: s.walk })),
      keywords: [],
      builtAt: { availability: '', buildYear: 0 },
      address: {
        prefecture: { prefectureId: '', prefectureName: 'Hokkaido' },
        city: { cityId: '', cityName: 'Sapporo' },
        streetAddress: it.address ?? '',
        buildingName: '',
      },
      listingSale: { listingSaleType: 'notSale' },
      reservationApprovalRequiredSetting: 'RequestBased',
      source: 'exflats',
      sourceName: 'Exflats',
      sourceColor: this.color,
      sourceUrl: it.url,
    }))
    return { listings, total: listings.length, hasMore: false }
  },
}
