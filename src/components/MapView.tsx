import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import { haversineKm } from '../api'
import { compactYen, fmtYen, monthlyAmount, monthlySuffix } from '../price'
import { SOURCES } from '../sources'
import type { UniversalListing } from '../sources'
import { TransitLayer } from './TransitLayer'
import { NeighborhoodLayer } from './NeighborhoodLayer'
import { LandmarkLayer } from './LandmarkLayer'
import type { QuoteResult } from '../types'

export interface MapEntry {
  listing: UniversalListing
  quote?: QuoteResult
}

export interface FocusTarget {
  id: string
  n: number
}

interface Props {
  entries: MapEntry[]
  hoveredId: string | null
  focus: FocusTarget | null
  fitKey: number
  searchingArea: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onSearchArea: (lat: number, lng: number, radiusKm: number) => void
}

type MarkerRegistry = Map<string, L.Marker>
type ClusterGroup = L.MarkerClusterGroup

function popupHtml(e: MapEntry): string {
  const { listing } = e
  return `
    <div class="map-popup">
      <img src="${listing.mainImageThumbnailUrl || listing.mainImageUrl}" alt="" />
      <div class="name">${listing.name.replace(/"/g, '&quot;')}</div>
      <div class="price">${fmtYen(monthlyAmount(e))} <small>${monthlySuffix()} ・ ${listing.layoutType}${listing.size > 0 ? ` ・ ${listing.size} m²` : ''}</small></div>
      <a href="${listing.sourceUrl}" target="_blank" rel="noreferrer">View on ${listing.sourceName}</a>
    </div>`
}

function MapSetup({ clusterRef }: { clusterRef: React.MutableRefObject<ClusterGroup | null> }) {
  const map = useMap()
  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 70,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 17,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          className: 'cluster-wrap',
          html: `<div class="marker-cluster">${cluster.getChildCount()}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
    })
    group.addTo(map)
    clusterRef.current = group
    return () => {
      map.removeLayer(group)
      clusterRef.current = null
    }
  }, [map, clusterRef])

  // panel boyutu değişince haritayı yeniden ölçeklendir
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  return null
}

function FitBounds({ entries, fitKey }: { entries: MapEntry[]; fitKey: number }) {
  const map = useMap()
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(() => {
    const list = entriesRef.current
    if (list.length === 0) return
    const bounds = L.latLngBounds(list.map((e) => [e.listing.location.lat, e.listing.location.lng] as [number, number]))
    if (list.length === 1) {
      map.setView(bounds.getCenter(), 14)
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [fitKey, map])
  return null
}

function FocusHandler({
  focus,
  registryRef,
  clusterRef,
}: {
  focus: FocusTarget | null
  registryRef: React.MutableRefObject<MarkerRegistry>
  clusterRef: React.MutableRefObject<ClusterGroup | null>
}) {
  useEffect(() => {
    if (!focus) return
    const marker = registryRef.current.get(focus.id)
    const group = clusterRef.current
    if (!marker || !group) return
    group.zoomToShowLayer(marker, () => {
      marker.openPopup()
    })
  }, [focus, registryRef, clusterRef])
  return null
}

function SearchAreaButton({ onSearchArea, searchingArea }: { onSearchArea: Props['onSearchArea']; searchingArea: boolean }) {
  const map = useMap()
  return (
    <button
      className={`search-area-btn${searchingArea ? ' loading' : ''}`}
      type="button"
      onClick={() => {
        const c = map.getCenter()
        const corner = map.getBounds().getNorthEast()
        const radiusKm = haversineKm(c.lat, c.lng, corner.lat, corner.lng)
        onSearchArea(c.lat, c.lng, Math.max(2, Math.round(radiusKm)))
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
      </svg>
      {searchingArea ? 'Searching...' : 'Search this area'}
    </button>
  )
}

function priceIconHtml(amount: number, color: string): string {
  return `<div class="price-marker" style="background:${color}">${compactYen(amount)}</div>`
}

function MarkersLayer({
  entries,
  hoveredId,
  onHover,
  onSelect,
  registryRef,
  clusterRef,
}: {
  entries: MapEntry[]
  hoveredId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  registryRef: React.MutableRefObject<MarkerRegistry>
  clusterRef: React.MutableRefObject<ClusterGroup | null>
}) {
  const priceIcon = useMemo(
    () =>
      L.divIcon({
        className: 'price-marker-wrap',
        html: priceIconHtml(0, '#999'),
        iconSize: [110, 26],
        iconAnchor: [55, 34],
      }),
    [],
  )

  useEffect(() => {
    const group = clusterRef.current
    if (!group) return
    const markers = registryRef.current
    const seen = new Set<string>()

    for (const e of entries) {
      seen.add(e.listing.id)
      let marker = markers.get(e.listing.id)
      if (!marker) {
        marker = L.marker([e.listing.location.lat, e.listing.location.lng], { icon: priceIcon, riseOnHover: false })
        marker.on('mouseover', () => onHover(e.listing.id))
        marker.on('mouseout', () => onHover(null))
        marker.on('click', () => onSelect(e.listing.id))
        group.addLayer(marker)
        markers.set(e.listing.id, marker)
      }
      const icon = L.divIcon({
        className: 'price-marker-wrap',
        html: priceIconHtml(monthlyAmount(e), e.listing.sourceColor),
        iconSize: [110, 26],
        iconAnchor: [55, 34],
      })
      marker.setIcon(icon)
      marker.bindPopup(popupHtml(e), { minWidth: 220, maxWidth: 260, closeButton: false })
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        group.removeLayer(marker)
        markers.delete(id)
      }
    }
  }, [entries, priceIcon, onHover, onSelect, registryRef, clusterRef])

  useEffect(() => {
    for (const [id, marker] of registryRef.current) {
      const pill = marker.getElement()?.querySelector('.price-marker') as HTMLElement | null
      if (pill) pill.classList.toggle('hovered', id === hoveredId)
    }
  }, [hoveredId, registryRef])

  return null
}

export function MapView({ entries, hoveredId, focus, fitKey, searchingArea, onHover, onSelect, onSearchArea }: Props) {
  const registryRef = useRef<MarkerRegistry>(new Map())
  const clusterRef = useRef<ClusterGroup | null>(null)
  const center: [number, number] = entries.length > 0 ? [entries[0].listing.location.lat, entries[0].listing.location.lng] : [35.6812, 139.7671]
  return (
    <div className="map-root">
      <MapContainer center={center} zoom={13} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapSetup clusterRef={clusterRef} />
        <FitBounds entries={entries} fitKey={fitKey} />
        <NeighborhoodLayer />
        <LandmarkLayer />
        <TransitLayer />
        <MarkersLayer entries={entries} hoveredId={hoveredId} onHover={onHover} onSelect={onSelect} registryRef={registryRef} clusterRef={clusterRef} />
        <FocusHandler focus={focus} registryRef={registryRef} clusterRef={clusterRef} />
        <SearchAreaButton onSearchArea={onSearchArea} searchingArea={searchingArea} />
      </MapContainer>
      <div className="map-legend">
        <span className="legend-sources">
          {SOURCES.filter((s) => entries.some((e) => e.listing.source === s.id)).map((s) => (
            <span key={s.id} className="legend-source">
              <span className="legend-dot" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </span>
        <span>Map © OpenStreetMap</span>
      </div>
    </div>
  )
}
