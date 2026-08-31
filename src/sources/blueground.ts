import { WORKER_BASE } from '../config'
import { addDays, todayStr } from '../price'
import type { SearchFormState } from '../types'
import type { SourceAdapter, SourceSearchResult, UniversalListing } from './types'

const BG_PLACE_ID = 'ct-eyJ0eXBlIjoiY2l0eSIsImxhdCI6MzUuNjc2NDIyNSwibG5nIjoxMzkuNjUwMDI3fQ'

interface BgProperty {
  id: string
  name: string
  path: string
  bedrooms: number
  lotSize: number
  address: { lat: number; lng: number; city?: string; area?: string; level2?: string }
  rent: { amount: number }
  baseRent: { amount: number }
  photos: Array<{ url: string }>
}

function emptyResult(note?: string): SourceSearchResult {
  return { listings: [], total: 0, hasMore: false, note }
}

function thumb(url: string): string {
  return url.replace('/736/', '/240/')
}

export const bluegroundAdapter: SourceAdapter = {
  id: 'blueground',
  name: 'Blueground',
  color: '#0ea5e9',
  perPage: 18,
  clientRadius: true,
  supports: { cost: true, size: true, walk: false, buildYear: false, guestsOver2: true, instant: false },
  async search(form: SearchFormState, page: number): Promise<SourceSearchResult> {
    if (!WORKER_BASE) return emptyResult('proxy not configured (VITE_WORKER_BASE)')
    if (!/tokyo/i.test(form.locationName)) return emptyResult()
    const qs = new URLSearchParams({
      marketCode: 'TYO',
      placeId: BG_PLACE_ID,
      currency: 'JPY',
      items: String(this.perPage),
      offset: String(page * this.perPage),
      language: 'en',
    })
    // tarih verilmediyse bugünden değil, uygunluk penceresi açık olsun diye +14 günden başlat
    const start = form.startDate || addDays(todayStr(), 14)
    const end = form.endDate || addDays(start, 30)
    qs.set('checkIn', start)
    qs.set('checkOut', end)
    if (form.minCost) qs.set('priceFrom', String(form.minCost))
    if (form.maxCost) qs.set('priceTo', String(form.maxCost))
    const bedrooms = Math.max(1, Math.ceil(form.numGuests / 2))
    qs.set('bedrooms', String(bedrooms))
    if (!/^\s*tokyo\s*$/i.test(form.locationName)) qs.set('query', form.locationName)

    const res = await fetch(`${WORKER_BASE}/proxy/blueground?${qs.toString()}`)
    if (!res.ok) throw new Error(`Blueground failed: ${res.status}`)
    const json = (await res.json()) as { totalItems: number; properties?: { main?: BgProperty[] } }

    const listings: UniversalListing[] = []
    for (const p of json.properties?.main ?? []) {
      const amount = p.rent.amount || p.baseRent.amount
      if (!amount || !p.address?.lat) continue
      const photo = p.photos?.[0]?.url
      listings.push({
        id: `blueground:${p.id}`,
        name: p.name,
        layoutType: `${p.bedrooms}BR`,
        size: p.lotSize ?? 0,
        maxNumberOfGuests: (p.bedrooms ?? 1) * 2,
        totalDailyCost: amount / 30,
        mainImageUrl: photo ?? '',
        mainImageThumbnailUrl: photo ? thumb(photo) : '',
        location: { lat: p.address.lat, lng: p.address.lng },
        nearestStations: [],
        keywords: [],
        builtAt: { availability: '', buildYear: 0 },
        address: {
          prefecture: { prefectureId: '', prefectureName: 'Tokyo' },
          city: { cityId: '', cityName: p.address.area ?? p.address.city ?? 'Tokyo' },
          streetAddress: p.address.level2 ?? '',
          buildingName: '',
        },
        listingSale: { listingSaleType: 'notSale' },
        reservationApprovalRequiredSetting: 'RequestBased',
        source: 'blueground',
        sourceName: 'Blueground',
        sourceColor: this.color,
        sourceUrl: `https://www.theblueground.com/${p.path}`,
      })
    }
    const total = json.totalItems ?? -1
    return {
      listings,
      total,
      hasMore: total >= 0 && page * this.perPage + listings.length < total,
    }
  },
}
