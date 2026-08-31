import type { SearchFormState } from '../types'
import type { SourceAdapter, SourceSearchResult, UniversalListing } from './types'

const HMLET_API = 'https://ywzjnepacv.ap-northeast-1.awsapprunner.com'
const HMLET_CDN = 'https://cdn.hmlet.com'

const CITY_IDS: Array<[RegExp, number]> = [
  [/tokyo/i, 101],
  [/osaka/i, 102],
  [/singapore/i, 201],
  [/hong ?kong/i, 301],
]

function emptyResult(): SourceSearchResult {
  return { listings: [], total: 0, hasMore: false }
}

export const hmletAdapter: SourceAdapter = {
  id: 'hmlet',
  name: 'Hmlet',
  color: '#4f46e5',
  perPage: 12,
  clientRadius: true,
  priceNote: 'utilities incl., one-time service fee extra',
  supports: { cost: true, size: true, walk: false, buildYear: false, guestsOver2: false, instant: false },
  async search(form: SearchFormState, page: number): Promise<SourceSearchResult> {
    const gcc = CITY_IDS.find(([re]) => re.test(form.locationName))?.[1]
    if (!gcc) return emptyResult()
    const qs = new URLSearchParams({
      gcc_id: String(gcc),
      offset: String(page * this.perPage),
      limit: String(this.perPage),
    })
    qs.set('min_price', form.minCost ? String(form.minCost) : '0')
    qs.set('max_price', form.maxCost ? String(form.maxCost) : '999999')
    if (form.startDate && form.endDate) {
      qs.set('check_in', form.startDate)
      qs.set('check_out', form.endDate)
    }
    const res = await fetch(`${HMLET_API}/v1/units?${qs.toString()}`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`Hmlet failed: ${res.status}`)
    const json = (await res.json()) as {
      totalResults: number
      items: Array<{
        property_id: number
        unit_id: number
        photo_path: string
        earliest_move_in_date: string
        list_price: number
        coordinates: string
        prefecture_en: string
        city_en: string
        property_name_en: string
        unit_number: number
        layout: string
        size_square_meters: number
      }>
    }
    const listings: UniversalListing[] = (json.items ?? []).map((u) => {
      const coords = u.coordinates.match(/-?\d+\.\d+/g)
      const photo = (size: string) => `${HMLET_CDN}/${u.photo_path.replace('{size_pattern}', size)}`
      return {
        id: `hmlet:${u.unit_id}`,
        name: `${u.property_name_en} ${u.unit_number}`,
        layoutType: u.layout,
        size: u.size_square_meters,
        maxNumberOfGuests: 2,
        totalDailyCost: u.list_price / 30,
        mainImageUrl: photo('large'),
        mainImageThumbnailUrl: photo('small'),
        location: { lat: coords ? Number(coords[0]) : 0, lng: coords ? Number(coords[1]) : 0 },
        nearestStations: [],
        keywords: [],
        builtAt: { availability: u.earliest_move_in_date, buildYear: 0 },
        address: {
          prefecture: { prefectureId: '', prefectureName: u.prefecture_en },
          city: { cityId: '', cityName: u.city_en },
          streetAddress: '',
          buildingName: u.property_name_en,
        },
        listingSale: { listingSaleType: 'notSale' },
        reservationApprovalRequiredSetting: 'RequestBased',
        source: 'hmlet',
        sourceName: 'Hmlet',
        sourceColor: this.color,
        sourceUrl: `https://www.hmlet.com/property/${u.property_id}/units/${u.unit_id}/detail`,
      }
    })
    return {
      listings,
      total: json.totalResults,
      hasMore: page * this.perPage + listings.length < json.totalResults,
    }
  },
}
