import type { Listing, SearchFormState } from '../types'

export type SourceId = 'sumyca' | 'hmlet' | 'blueground' | 'tokyofurnished' | 'exflats'

export interface UniversalListing extends Listing {
  source: SourceId
  sourceName: string
  sourceColor: string
  sourceUrl: string
}

export interface SourceSearchResult {
  listings: UniversalListing[]
  /** -1: bilinmiyor */
  total: number
  hasMore: boolean
  /** kaynak kullanılamıyorsa kullanıcıya not */
  note?: string
}

export interface SourceAdapter {
  id: SourceId
  name: string
  color: string
  perPage: number
  /** radius filtresini istemci tarafında haversine ile uygula (sumyca API'de native yapıyor) */
  clientRadius: boolean
  /** Aktif filtre bu kaynakta değerlendirilemiyorsa kaynak atlanır */
  supports: {
    cost: boolean
    size: boolean
    walk: boolean
    buildYear: boolean
    guestsOver2: boolean
    instant: boolean
  }
  search(form: SearchFormState, page: number): Promise<SourceSearchResult>
}
