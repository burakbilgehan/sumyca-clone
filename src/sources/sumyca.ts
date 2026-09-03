import { searchListings } from '../api'
import type { SourceAdapter, SourceSearchResult, UniversalListing } from './types'
import type { SearchFormState } from '../types'

export const SUMYCA_COLOR = '#14b8a6'

function toUniversal(listing: UniversalListing): UniversalListing {
  return { ...listing, source: 'sumyca', sourceName: 'Sumyca', sourceColor: SUMYCA_COLOR, sourceUrl: `https://www.sumyca.com/en/listings/${listing.id}` }
}

export const sumycaAdapter: SourceAdapter = {
  id: 'sumyca',
  name: 'Sumyca',
  color: SUMYCA_COLOR,
  perPage: 50,
  clientRadius: false,
  priceNote: 'all-inclusive (incl. utilities)',
  supports: { cost: true, size: true, walk: true, buildYear: true, guestsOver2: true, instant: true, preference: true },
  async search(form: SearchFormState, page: number): Promise<SourceSearchResult> {
    const res = await searchListings(form, page, this.perPage)
    const listings = (res.listingsWithRoomType ?? []).map((w) => toUniversal(w.listing as UniversalListing))
    return { listings, total: -1, hasMore: listings.length >= this.perPage }
  },
}
