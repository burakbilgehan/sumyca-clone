import { useState } from 'react'
import type { QuoteResult } from '../types'
import { fmtYen, monthlyAmount, monthlySuffix } from '../price'
import type { UniversalListing } from '../sources'

interface Props {
  listing: UniversalListing
  quote?: QuoteResult
  highlighted: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

const PRIORITY_KEYS = ['FixedWiFi', 'MobileWiFi', 'AirConditioner', 'WashingMachine', 'Refrigerator', 'Microwave', 'RiceCooker', 'Dryer', 'AutomaticLock', 'Bidet', 'HotWaterSupply']

function amenityChips(listing: UniversalListing): string[] {
  const keys = new Set(listing.keywords.map((k) => k.key))
  const byKey = new Map(listing.keywords.map((k) => [k.key, k]))
  const out: string[] = []
  for (const key of PRIORITY_KEYS) {
    if (keys.has(key)) {
      const k = byKey.get(key)!
      if (key === 'FixedWiFi' || key === 'MobileWiFi') out.push('Wi-Fi')
      else if (key === 'AirConditioner') out.push('Air conditioner')
      else if (key === 'WashingMachine') out.push('Washing machine')
      else out.push(k.nameEn)
      if (out.length >= 4) return out
    }
  }
  for (const k of listing.keywords) {
    if (out.length >= 4) break
    if (!out.includes(k.nameEn)) out.push(k.nameEn)
  }
  return out
}

function stationLabel(station: UniversalListing['nearestStations'][number] | undefined): string {
  if (!station) return 'Station info unavailable'
  const isStn = /station$/i.test(station.stationName) || /駅$/.test(station.stationName)
  const name = isStn ? station.stationName : `${station.stationName} Station`
  return `${name} ${station.minuteWalk} min walk`
}

export function ListingCard({ listing, quote, highlighted, onHover, onSelect }: Props) {
  const [fav, setFav] = useState(false)
  const isInstant = listing.reservationApprovalRequiredSetting === 'ImmediateReservationRequest'
  const isSale = listing.listingSale?.listingSaleType !== 'notSale'
  const amount = monthlyAmount({ listing, quote })
  const buildYear = listing.builtAt?.buildYear ?? 0
  const age = buildYear > 0 ? new Date().getFullYear() - buildYear : null
  const station = listing.nearestStations[0]
  const chips = amenityChips(listing)
  const url = listing.sourceUrl

  return (
    <div
      className={`listing-card${highlighted ? ' highlighted' : ''}`}
      onMouseEnter={() => onHover(listing.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(listing.id)}
    >
      <div className="listing-photo">
        <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <img src={listing.mainImageThumbnailUrl || listing.mainImageUrl} alt={listing.name} loading="lazy" />
        </a>
        <div className="photo-badges">
          {isInstant && <span className="badge badge-instant">Instant Book</span>}
          {isSale && <span className="badge badge-sale">SALE</span>}
        </div>
        <button
          className="fav-btn"
          aria-label="Add to favorites"
          aria-pressed={fav}
          onClick={(e) => {
            e.stopPropagation()
            setFav((v) => !v)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? '#ff525e' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="listing-body">
        <div className="listing-meta-row">
          <span className="badge badge-source" style={{ background: listing.sourceColor }}>
            {listing.sourceName}
          </span>
          <span>
            {listing.layoutType}
            {listing.size > 0 && <> ・ {listing.size} m²</>}
          </span>
          {listing.maxNumberOfGuests > 0 && (
            <>
              <span>・</span>
              <span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: '-2px' }}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>{' '}
                {listing.maxNumberOfGuests}
              </span>
            </>
          )}
        </div>

        <div className="listing-price-row">
          <span className="listing-price">{fmtYen(amount)}</span>
          <span className="listing-price-suffix">{monthlySuffix()}</span>
        </div>

        <div className="listing-name">{listing.name}</div>

        <div className="listing-sub">
          {age !== null && (
            <>
              <span className="star">☆</span> Age of building {age} years /{' '}
            </>
          )}
          {station && <>{stationLabel(station)} / </>}
          {listing.address.prefecture.prefectureName} {listing.address.city.cityName}
        </div>

        <div className="listing-chips">
          {chips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </div>

        <div className="listing-footer">
          <a className="view-details" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            View on {listing.sourceName}
          </a>
          {quote && quote.discountAmount > 0 && <span className="badge badge-best-rate">Best Rate</span>}
          {isInstant && <span className="badge badge-instant">Instant Book</span>}
        </div>
      </div>
    </div>
  )
}
