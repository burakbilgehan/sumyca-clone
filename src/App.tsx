import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ListingsWithRoomType, QuoteResult, SearchFormState } from './types'
import { fetchQuotes, reverseGeocode, searchListings } from './api'
import { addDays, todayStr } from './price'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { SearchForm } from './components/SearchForm'
import { ListingCard } from './components/ListingCard'
import { MapView, type FocusTarget, type MapEntry } from './components/MapView'

const ITEMS_PER_PAGE = 50
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
  }
}

function readInitialForm(): SearchFormState {
  const qs = new URLSearchParams(window.location.search)
  const base = defaultForm()
  const num = (k: string) => {
    const v = qs.get(k)
    return v ? Number(v) || 0 : 0
  }
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

export default function App() {
  const [form, setForm] = useState<SearchFormState>(readInitialForm)
  const [results, setResults] = useState<ListingsWithRoomType[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteResult>>({})
  const [page, setPage] = useState(0)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [draining, setDraining] = useState(false)
  const [searchingArea, setSearchingArea] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
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
  const pageRef = useRef(page)
  const resultsRef = useRef(results)
  const drainRef = useRef(false)
  const capRef = useRef(AUTO_CAP)
  const layoutRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    pageRef.current = page
  }, [page])

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

  // tüm sonuçları arka planda çek (drain)
  const drain = useCallback(async (f: SearchFormState, seq: number) => {
    if (drainRef.current) return
    drainRef.current = true
    setDraining(true)
    try {
      let p = pageRef.current + 1
      while (true) {
        if (seq !== searchSeq.current) return
        const res = await searchListings(f, p, ITEMS_PER_PAGE)
        if (seq !== searchSeq.current) return
        const more = res.listingsWithRoomType ?? []
        if (more.length === 0) {
          setHasMore(false)
          break
        }
        const room = Math.max(0, capRef.current - resultsRef.current.length)
        if (room <= 0) {
          setHasMore(true)
          break
        }
        const take = more.slice(0, room)
        resultsRef.current = [...resultsRef.current, ...take]
        setResults(resultsRef.current)
        pageRef.current = p
        setPage(p)
        if (take.length > 0) {
          const q = await fetchQuotesFor(f, take.map((w) => w.listing.id))
          if (seq !== searchSeq.current) return
          setQuotes((prev) => ({ ...prev, ...q }))
        }
        if (take.length < more.length) {
          setHasMore(true)
          break
        }
        p += 1
      }
    } catch (e) {
      if (seq === searchSeq.current) setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      if (seq === searchSeq.current) setDraining(false)
      drainRef.current = false
    }
  }, [])

  const runSearch = useCallback(
    async (_reset = true, extraForm?: SearchFormState) => {
      const f = extraForm ?? formRef.current
      if (!f.locationName.trim()) return
      const seq = ++searchSeq.current
      setLoading(true)
      setError(null)
      try {
        const res = await searchListings(f, 0, ITEMS_PER_PAGE)
        if (seq !== searchSeq.current) return
        const list = res.listingsWithRoomType ?? []
        setResults(list)
        resultsRef.current = list
        setHasMore(list.length >= ITEMS_PER_PAGE)
        setPage(0)
        pageRef.current = 0
        setQuotes({})
        setFitKey((k) => k + 1)
        setSearched(true)
        setHoveredId(null)
        setSelectedId(null)
        setFocus(null)
        if (list.length > 0) {
          const q = await fetchQuotesFor(f, list.map((w) => w.listing.id))
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
    const seq = ++searchSeq.current
    void (async () => {
      try {
        const res = await searchListings(form, 0, ITEMS_PER_PAGE)
        const list = res.listingsWithRoomType ?? []
        setResults(list)
        resultsRef.current = list
        setHasMore(list.length >= ITEMS_PER_PAGE)
        setPage(0)
        pageRef.current = 0
        setFitKey((k) => k + 1)
        setSearched(true)
        if (list.length > 0) {
          const q = await fetchQuotesFor(form, list.map((w) => w.listing.id))
          setQuotes(q)
        }
        void drain(form, seq)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
      }
    })()
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
      results.map((w) => ({
        listing: w.listing,
        quote: quotes[w.listing.id],
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
          {!loading && searched && !error && results.length === 0 && (
            <div className="status-box">Try relaxing the filters (max rent, walk minutes, build year).</div>
          )}
          {results.map((w) => (
            <div key={w.listing.id} id={`card-${w.listing.id}`}>
              <ListingCard
                listing={w.listing}
                quote={quotes[w.listing.id]}
                highlighted={hoveredId === w.listing.id || selectedId === w.listing.id}
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
