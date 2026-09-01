import { useEffect, useState } from 'react'
import type { UniversalListing } from '../sources'
import { transitTimesFor, type TransitTimes } from '../transit'

interface Props {
  listing: UniversalListing
}

export function TransitBox({ listing }: Props) {
  const [result, setResult] = useState<{ id: string; times: TransitTimes | null } | null>(null)

  useEffect(() => {
    let alive = true
    void transitTimesFor(listing).then((t) => {
      if (!alive) return
      setResult({ id: listing.id, times: t })
    })
    return () => {
      alive = false
    }
  }, [listing])

  if (!result || result.id !== listing.id || !result.times) return null
  const times = result.times

  return (
    <div className="transit-box">
      <div className="transit-title">
        Transit to hubs <span className="transit-est">(est.)</span>
      </div>
      <div className="transit-grid">
        {times.hubIds.map((id, i) => {
          const m = times.minutes[id]
          if (m == null) return null
          return (
            <span key={id} className="transit-chip">
              <span className="transit-hub">{times.hubLabels[i]}</span>
              <span className="transit-min">{m} min</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
