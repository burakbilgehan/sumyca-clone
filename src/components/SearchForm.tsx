import { useEffect, useRef, useState } from 'react'
import type { PlaceSuggestion, SearchFormState } from '../types'
import { autocompletePlace } from '../api'
import { ALL_SOURCE_IDS, SOURCES } from '../sources'
import type { SourceId } from '../sources'

interface Props {
  form: SearchFormState
  onChange: (patch: Partial<SearchFormState>) => void
  onApply: (next: SearchFormState) => void
  onSearch: () => void
  loading: boolean
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="form-field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function SearchForm({ form, onChange, onApply, onSearch, loading }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const onLocationInput = async (q: string) => {
    onChange({ locationName: q })
    if (!q.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const res = await autocompletePlace(q)
    setSuggestions(res)
    setOpen(true)
    setActiveIdx(-1)
  }

  const pick = (s: PlaceSuggestion) => {
    onChange({ locationName: s.name })
    setOpen(false)
    setSuggestions([])
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') {
        setOpen(false)
        onSearch()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0) pick(suggestions[activeIdx])
      else {
        setOpen(false)
        onSearch()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const num = (v: string | number) => (v === '' || v === 0 ? '' : String(v))

  const activeSources = form.sources.length ? form.sources : ALL_SOURCE_IDS
  const toggleSource = (id: SourceId) => {
    const next = activeSources.includes(id) ? activeSources.filter((s) => s !== id) : [...activeSources, id]
    onChange({ sources: next.length === ALL_SOURCE_IDS.length ? [] : next })
  }

  return (
    <div className="search-form-wrap">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault()
          setOpen(false)
          onSearch()
        }}
      >
        <div className="form-field" ref={wrapRef} style={{ flexGrow: 2, minWidth: 220 }}>
          <label htmlFor="q">Where are you going?</label>
          <input
            id="q"
            value={form.locationName}
            placeholder="e.g. Tokyo, Shibuya, Shinjuku"
            autoComplete="off"
            onChange={(e) => void onLocationInput(e.target.value)}
            onFocus={() => {
              if (suggestions.length) setOpen(true)
            }}
            onKeyDown={onKeyDown}
          />
          {open && suggestions.length > 0 && (
            <div className="autocomplete">
              {suggestions.map((s, i) => (
                <div
                  key={s.label}
                  className={`autocomplete-item${i === activeIdx ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(s)
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <span className="pin">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                    </svg>
                  </span>
                  <span>{s.name}</span>
                  <span className="sub">{[s.city, s.state, s.country].filter(Boolean).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Check-in">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </Field>
        <Field label="Guests">
          <input
            type="number"
            min={1}
            value={num(form.numGuests)}
            placeholder="2"
            onChange={(e) => onChange({ numGuests: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field label="Max rent /month (¥)">
          <input
            type="number"
            min={0}
            value={num(form.maxCost)}
            placeholder="180,000"
            onChange={(e) => onChange({ maxCost: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Sort">
          <select
            value={form.sort}
            onChange={(e) => onApply({ ...form, sort: e.target.value as 'costAsc' | 'costDesc' })}
          >
            <option value="costAsc">Price: low to high</option>
            <option value="costDesc">Price: high to low</option>
          </select>
        </Field>
        <button className="search-submit" type="submit" disabled={loading}>
          Search
        </button>
      </form>

      <div>
        <button type="button" className="more-filters-toggle" onClick={() => setShowMore((v) => !v)}>
          <span>{showMore ? '−' : '+'}</span> More filters
        </button>
      </div>

      {showMore && (
        <div className="more-filters">
          <Field label="Min rent /night (¥)">
            <input
              type="number"
              min={0}
              value={num(form.minCost)}
              placeholder="0"
              onChange={(e) => onChange({ minCost: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Max walk from station (min)">
            <input
              type="number"
              min={0}
              value={num(form.maxMinuteWalk)}
              placeholder="10"
              onChange={(e) => onChange({ maxMinuteWalk: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Built after">
            <input
              type="number"
              min={1900}
              value={num(form.buildYearAfter)}
              placeholder="2006"
              onChange={(e) => onChange({ buildYearAfter: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Min size (m²)">
            <input
              type="number"
              min={0}
              value={num(form.minSize)}
              placeholder="0"
              onChange={(e) => onChange({ minSize: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Max size (m²)">
            <input
              type="number"
              min={0}
              value={num(form.maxSize)}
              placeholder="0"
              onChange={(e) => onChange({ maxSize: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Radius (km)">
            <input
              type="number"
              min={1}
              value={num(form.radius)}
              placeholder="20"
              onChange={(e) => onChange({ radius: Number(e.target.value) || 20 })}
            />
          </Field>
          <label className="instant-book-chip">
            <input
              type="checkbox"
              checked={form.instantBooking}
              onChange={(e) => onChange({ instantBooking: e.target.checked })}
            />
            Instant Book
          </label>
          <div className="sources-field">
            <label>Sources</label>
            <div className="source-chips">
              {SOURCES.map((s) => {
                const on = activeSources.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`source-chip${on ? '' : ' off'}`}
                    onClick={() => toggleSource(s.id)}
                    aria-pressed={on}
                  >
                    <span className="dot" style={{ background: s.color }} />
                    {s.name}
                  </button>
                )
              })}
            </div>
            <div className="sources-hint">If no source is selected, all sources are searched.</div>
          </div>
        </div>
      )}
    </div>
  )
}
