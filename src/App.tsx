import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuoteResult, SearchFormState } from './types'
import { fetchQuotes, reverseGeocode } from './api'
import { addDays, todayStr } from './price'
import { ALL_SOURCE_IDS, SOURCES, finalizeListings, searchAllSources } from './sources'
import type { SourceId, UniversalListing } from './sources'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { SearchForm } from './components/SearchForm'
import { ListingCard } from './components/ListingCard'
import { MapView, type FocusTarget, type MapEntry } from './components/MapView'

const AUTO_CAP = 500

function defaultForm(): SearchFormState {
  return {
    locationName: 'Tokyo',
    startDate: '',
    endDate: '',
    numGuests: 2,
    maxCost: 0,
    minCost: 0,
    maxMinuteWalk: 0,
    minSize: 0,
    maxSize: 0,
    buildYearAfter: 0,
    radius: 20,
    instantBooking: false,
    sort: 'costAsc',
    sources: [],
  }
}

function readInitialForm(): SearchFormState {
  const qs = new URLSearchParams(window.location.search)
  const base = defaultForm()
  const num = (k: string) => {
    const v = qs.get(k)
    return v ? Number(v) || 0 : 0
  }
  const sourcesParam = (qs.get('sources') ?? '').split(',').filter((s) => (ALL_SOURCE_IDS as string[]).includes(s))
  return {
    ...base,
    locationName: qs.get('query') ?? base.locationName,
    startDate: qs.get('startDate') ?? '',
    endDate: qs.get('endDate') ?? '',
    numGuests: qs.get('numGuests') ? Number(qs.get('numGuests')) || 2 : 2,
    maxCost: num('maxCost'),
    maxMinuteWalk: num('maxMinuteWalk'),
    buildYearAfter: num('buildYearAfter'),
    sort: qs.get('sort') === 'costDesc' ? 'costDesc' : 'costAsc',
    sources: sourcesParam as SourceId[],
  }
}

function syncUrl(form: SearchFormState) {
  const qs = new URLSearchParams()
  qs.set('query', form.locationName)
  if (form.startDate) qs.set('startDate', form.startDate)
  if (form.endDate) qs.set('endDate', form.endDate)
  qs.set('numGuests', String(form.numGuests))
  if (form.maxCost) qs.set('maxCost', String(form.maxCost))
  if (form.maxMinuteWalk) qs.set('maxMinuteWalk', String(form.maxMinuteWalk))
  if (form.buildYearAfter) qs.set('buildYearAfter', String(form.buildYearAfter))
  qs.set('sort', form.sort)
  if (form.sources.length) qs.set('sources', form.sources.join(','))
  window.history.replaceState(null, '', `${window.location.pathname}?${qs.toString()}`)
}

// Aylık fiyat için kanonik 30 gecelik pencere (tarih girilmediyse bugünden)
function monthlyQuoteSpan(form: SearchFormState): { startDate: string; endDate: string } {
  const start = form.startDate || todayStr()
  return { startDate: start, endDate: addDays(start, 30) }
}

async function fetchQuotesFor(form: SearchFormState, ids: string[]): Promise<Record<string, QuoteResult>> {
  if (ids.length === 0) return {}
  const { startDate, endDate } = monthlyQuoteSpan(form)
  return fetchQuotes(ids, startDate, endDate, form.numGuests)
}

type SourceState = { page: number; hasMore: boolean }

export default function App() {
  const [form, setForm] = useState<SearchFormState>(readInitialForm)
  const [results, setResults] = useState<UniversalListing[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draining, setDraining] = useState(false)
  const [searchingArea, setSearchingArea] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [notes, setNotes] = useState<string[]>([])
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<FocusTarget | null>(null)
  const [fitKey, setFitKey] = useState(0)
  const [listPct, setListPct] = useState(42)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const searchSeq = useRef(0)
  const focusN = useRef(0)
  const formRef = useRef(form)
  const resultsRef = useRef(results)
  const drainRef = useRef(false)
  const capRef = useRef(AUTO_CAP)
  const sourcesRef = useRef<Record<string, SourceState>>({})
  const layoutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    resultsRef.current = results
  }, [results])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const patch = useCallback((p: Partial<SearchFormState>) => {
    setForm((f) => ({ ...f, ...p }))
  }, [])

  const appendFinalized = useCallback((incoming: UniversalListing[], form: SearchFormState) => {
    const merged = finalizeListings([...resultsRef.current, ...incoming], form)
    resultsRef.current = merged
    setResults(merged)
  }, [])

  // tüm sonuçları arka planda çek (drain)
  const drain = useCallback(
    async (f: SearchFormState, seq: number) => {
      if (drainRef.current) return
      drainRef.current = true
      setDraining(true)
      try {
        while (true) {
          if (seq !== searchSeq.current) return
          const st = sourcesRef.current
          const active = Object.keys(st).filter((id) => st[id].hasMore)
          if (active.length === 0) {
            setHasMore(false)
            break
          }
          if (resultsRef.current.length >= capRef.current) {
            setHasMore(true)
            break
          }
          for (const id of active) {
            if (seq !== searchSeq.current) return
            const src = SOURCES.find((s) => s.id === id)
            if (!src) continue
            const nextPage = st[id].page + 1
            let res
            try {
              res = await src.search(f, nextPage)
            } catch {
              res = { listings: [], total: -1, hasMore: false }
            }
            if (seq !== searchSeq.current) return
            st[id] = { page: nextPage, hasMore: res.hasMore }
            if (res.listings.length > 0) {
              appendFinalized(res.listings, f)
              const sumycaIds = res.listings.filter((l) => l.source === 'sumyca').map((l) => l.id)
              if (sumycaIds.length > 0) {
                const q = await fetchQuotesFor(f, sumycaIds)
                if (seq !== searchSeq.current) return
                setQuotes((prev) => ({ ...prev, ...q }))
              }
            }
            if (resultsRef.current.length >= capRef.current) {
              setHasMore(true)
              return
            }
          }
        }
      } finally {
        if (seq === searchSeq.current) setDraining(false)
        drainRef.current = false
      }
    },
    [appendFinalized],
  )

  const runSearch = useCallback(
    async (_reset = true, extraForm?: SearchFormState) => {
      const f = extraForm ?? formRef.current
      if (!f.locationName.trim()) return
      const seq = ++searchSeq.current
      setLoading(true)
      setError(null)
      try {
        const run = await searchAllSources(f, 0)
        if (seq !== searchSeq.current) return
        resultsRef.current = run.listings
        setResults(run.listings)
        sourcesRef.current = run.next
        setNotes(run.notes)
        setHasMore(run.hasMore)
        setQuotes({})
        setFitKey((k) => k + 1)
        setSearched(true)
        setHoveredId(null)
        setSelectedId(null)
        setFocus(null)
        const sumycaIds = run.listings.filter((l) => l.source === 'sumyca').map((l) => l.id)
        if (sumycaIds.length > 0) {
          const q = await fetchQuotesFor(f, sumycaIds)
          if (seq === searchSeq.current) setQuotes(q)
        }
        void drain(f, seq)
      } catch (e) {
        if (seq === searchSeq.current) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (seq === searchSeq.current) setLoading(false)
      }
    },
    [drain],
  )

  const onApply = useCallback(
    (next: SearchFormState) => {
      setForm(next)
      if (searched) void runSearch(true, next)
    },
    [searched, runSearch],
  )

  const onSearch = useCallback(() => {
    syncUrl(form)
    void runSearch(true, form)
  }, [form, runSearch])

  // haritadaki görünür bölge için arama
  const onSearchArea = useCallback(
    async (lat: number, lng: number, radiusKm: number) => {
      setSearchingArea(true)
      try {
        const rg = await reverseGeocode(lat, lng)
        const name = rg?.district || rg?.city || rg?.name || formRef.current.locationName
        const next: SearchFormState = {
          ...formRef.current,
          locationName: name,
          radius: Math.max(2, Math.min(radiusKm, 60)),
        }
        setForm(next)
        syncUrl(next)
        await runSearch(true, next)
      } finally {
        setSearchingArea(false)
      }
    },
    [runSearch],
  )

  // ilk yüklemede URL'de sorgu varsa otomatik ara
  const didInitial = useRef(false)
  useEffect(() => {
    if (didInitial.current) return
    didInitial.current = true
    const qs = new URLSearchParams(window.location.search)
    if (!qs.get('query')) return
    void runSearch(true, formRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSelectListing = useCallback((id: string) => {
    setSelectedId(id)
    focusN.current += 1
    setFocus({ id, n: focusN.current })
    const el = document.getElementById(`card-${id}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const onLoadMore = useCallback(() => {
    capRef.current += AUTO_CAP
    void drain(formRef.current, searchSeq.current)
  }, [drain])

  // panel ayırıcı sürükleme
  const onDividerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = layoutRef.current
    if (!el) return
    document.body.classList.add('dragging-panel')
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0) return
      const pct = ((ev.clientX - r.left) / r.width) * 100
      setListPct(Math.min(70, Math.max(22, pct)))
    }
    const up = () => {
      document.body.classList.remove('dragging-panel')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const entries: MapEntry[] = useMemo(
    () =>
      results.map((l) => ({
        listing: l,
        quote: quotes[l.id],
      })),
    [results, quotes],
  )

  return (
    <>
      <Header />
      <SearchForm form={form} onChange={patch} onApply={onApply} onSearch={onSearch} loading={loading} />

      <div className="results-layout" ref={layoutRef}>
        <div
          className={`list-panel${isMobile && mobileView === 'map' ? ' hidden-on-mobile' : ''}`}
          style={!isMobile ? { flex: `0 0 ${listPct}%`, maxWidth: 'none' } : undefined}
        >
          {loading && (
            <div className="status-box">
              <span className="spinner" /> Searching listings...
            </div>
          )}
          {!loading && error && <div className="status-box">Error: {error}</div>}
          {!loading && searched && !error && (
            <div className="results-meta">
              <span className="results-count">
                {results.length === 0
                  ? 'No listings found'
                  : `${results.length} listing${results.length > 1 ? 's' : ''} found${draining ? ' ・ loading more...' : ''}`}
              </span>
              <span>{form.locationName}</span>
            </div>
          )}
          {!loading && searched && !error && notes.length > 0 && (
            <div className="results-notes">
              {notes.map((n, i) => (
                <div key={i}>・ {n}</div>
              ))}
            </div>
          )}
          {!loading && searched && !error && results.length === 0 && (
            <div className="status-box">Try relaxing the filters (max rent, walk minutes, build year).</div>
          )}
          {results.map((l) => (
            <div key={l.id} id={`card-${l.id}`}>
              <ListingCard
                listing={l}
                quote={quotes[l.id]}
                highlighted={hoveredId === l.id || selectedId === l.id}
                onHover={setHoveredId}
                onSelect={onSelectListing}
              />
            </div>
          ))}
          {!loading && results.length > 0 && (
            <div className="load-more-wrap">
              {hasMore ? (
                <button className="btn-load-more" onClick={onLoadMore} disabled={draining}>
                  {draining ? 'Loading...' : 'Load more listings'}
                </button>
              ) : (
                <span className="status-box">All listings loaded</span>
              )}
            </div>
          )}
        </div>

        {!isMobile && <div className="panel-divider" onPointerDown={onDividerDown} aria-hidden="true" />}

        {(!isMobile || mobileView === 'map') && (
          <div className="map-panel">
            <MapView
              entries={entries}
              hoveredId={hoveredId}
              focus={focus}
              fitKey={fitKey}
              searchingArea={searchingArea}
              onHover={setHoveredId}
              onSelect={onSelectListing}
              onSearchArea={onSearchArea}
            />
          </div>
        )}
      </div>

      {isMobile && (
        <div className="view-toggle">
          <button className={mobileView === 'list' ? 'active' : ''} onClick={() => setMobileView('list')}>
            List
          </button>
          <button className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}>
            Map
          </button>
        </div>
      )}

      <Footer />
    </>
  )
}
