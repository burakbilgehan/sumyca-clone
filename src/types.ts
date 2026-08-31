import type { SourceId } from './sources/types'

export interface Keyword {
  id: number
  category: string
  key: string
  nameEn: string
  nameJa: string
}

export interface Station {
  lineName: string
  stationName: string
  minuteWalk: number
}

export interface ListingLocation {
  lat: number
  lng: number
}

export interface ListingAddress {
  prefecture: { prefectureId: string; prefectureName: string }
  city: { cityId: string; cityName: string }
  streetAddress: string
  buildingName: string
}

export interface Listing {
  id: string
  name: string
  layoutType: string
  size: number
  maxNumberOfGuests: number
  totalDailyCost: number
  mainImageUrl: string
  mainImageThumbnailUrl: string
  location: ListingLocation
  nearestStations: Station[]
  keywords: Keyword[]
  builtAt: { availability: string; buildYear: number }
  address: ListingAddress
  listingSale: { listingSaleType: string }
  reservationApprovalRequiredSetting: string
}

export interface ListingsWithRoomType {
  listing: Listing
  roomType: unknown
  roomTypeRelationInfo: unknown
}

export interface SearchResponse {
  listingsWithRoomType: ListingsWithRoomType[]
  pagination: { page: number; itemsPerPage: number }
}

export interface QuoteResult {
  listingId: string
  listingName: string
  beforeTotalCostResult: {
    totalRent: number
    totalUtilityCost: number
    totalManagementCost: number
    cleaningFee: number
    commissionFee: number
    beddingFee: number
    deposit: number
    extensionFee: number
    totalDays: number
  }
  afterTotalCostResult: {
    totalRent: number
    totalUtilityCost: number
    totalManagementCost: number
    cleaningFee: number
    commissionFee: number
    beddingFee: number
    deposit: number
    extensionFee: number
    totalDays: number
  }
  beforeTotal: number
  afterTotal: number
  discountAmount: number
  targetPriceAdjustments: unknown[]
}

export interface QuotationResponse {
  data: QuoteResult[]
}

export interface PlaceSuggestion {
  name: string
  city: string
  state: string
  country: string
  lat: number
  lng: number
  label: string
}

export interface SearchFormState {
  locationName: string
  startDate: string
  endDate: string
  numGuests: number
  maxCost: number
  minCost: number
  maxMinuteWalk: number
  minSize: number
  maxSize: number
  buildYearAfter: number
  radius: number
  instantBooking: boolean
  sort: 'costAsc' | 'costDesc'
  /** boş dizi = tüm kaynaklar */
  sources: SourceId[]
}
