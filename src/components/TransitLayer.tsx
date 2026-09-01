import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LineDef, StationDef } from '../data/tokyo'

let tokyoData: { TOKYO_LINES: LineDef[]; TOKYO_STATIONS: StationDef[] } | null = null

// Doygun hat renklerini pastelleştir: beyazla karıştır → göz yormaz
function soften(hex: string, amt: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const m = (c: number) => Math.round(c + (255 - c) * amt)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

function stationIcon(s: StationDef, lines: LineDef[]): L.DivIcon {
  const covered = s.lines.map((li) => lines[li]).filter((l) => l)
  const dots = covered
    .slice(0, 4)
    .map((l) => `<i style="background:${soften(l.color, 0.4)}"></i>`)
    .join('')
  const label = s.en
    ? `<div class="station-label">${s.en.replace(/</g, '&lt;')}</div>`
    : `<div class="station-label">${s.ja.replace(/</g, '&lt;')}</div>`
  return L.divIcon({
    className: 'station-wrap',
    html: `<div class="station-marker"><span class="station-dots">${dots}</span>${label}</div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function stationPopup(s: StationDef, lines: LineDef[]): string {
  const covered = s.lines.map((li) => lines[li]).filter((l) => l)
  const list = covered
    .map((l) => `<span><i style="background:${l.color}"></i>${(l.en || l.ja).replace(/</g, '&lt;')}</span>`)
    .join('')
  const title = s.en ? `${s.en} · ${s.ja}` : s.ja
  return `<div class="station-popup"><div class="sname">${title.replace(/</g, '&lt;')}</div><div class="lines">${list}</div></div>`
}

export function TransitLayer() {
  const map = useMap()
  const lastKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let disposed = false
    let lineLayer: L.LayerGroup | null = null
    let stationLayer: L.LayerGroup | null = null

    const cleanup = () => {
      disposed = true
      if (lineLayer) lineLayer.remove()
      if (stationLayer) stationLayer.remove()
      map.off('moveend', onMove)
      map.off('zoomed', onZoom)
    }

    const renderStations = (lines: LineDef[]) => {
      if (!stationLayer) return
      const z = map.getZoom()
      // uzakta istasyon yok; biraz yaklaşınca açılır
      if (z < 14) {
        stationLayer.clearLayers()
        lastKeysRef.current = new Set()
        return
      }
      const b = map.getBounds()
      const s = b.getSouth() - 0.02
      const w = b.getWest() - 0.02
      const n = b.getNorth() + 0.02
      const e = b.getEast() + 0.02
      const active: string[] = []
      for (const st of tokyoData!.TOKYO_STATIONS) {
        if (st.lat < s || st.lat > n || st.lng < w || st.lng > e) continue
        const key = `${st.lng.toFixed(4)},${st.lat.toFixed(4)}`
        active.push(key)
        if (lastKeysRef.current.has(key)) continue
        const marker = L.marker([st.lat, st.lng], { icon: stationIcon(st, lines), interactive: true, keyboard: false, riseOnHover: false, zIndexOffset: 700 })
        marker.bindPopup(stationPopup(st, lines), { minWidth: 150, closeButton: false })
        stationLayer.addLayer(marker)
      }
      const existing = stationLayer.getLayers() as L.Marker[]
      for (const m of existing) {
        const ll = m.getLatLng()
        const key = `${ll.lng.toFixed(4)},${ll.lat.toFixed(4)}`
        if (!active.includes(key)) stationLayer.removeLayer(m)
      }
      lastKeysRef.current = new Set(active)
    }

    const setTiers = () => {
      const z = map.getZoom()
      map.getContainer().classList.toggle('zoomed-in', z >= 14)
      map.getContainer().classList.toggle('transit-far', z < 14)
    }

    const onMove = () => {
      if (!tokyoData || disposed) return
      setTiers()
      renderStations(tokyoData.TOKYO_LINES)
    }
    const onZoom = () => onMove()

    void import('../data/tokyo').then((mod) => {
      if (disposed || !map.getContainer()) return
      tokyoData = { TOKYO_LINES: mod.TOKYO_LINES, TOKYO_STATIONS: mod.TOKYO_STATIONS }
      if (!map.getPane('transit')) {
        const pane = map.createPane('transit')
        pane.style.zIndex = '380'
        pane.style.pointerEvents = 'none'
      }
      lineLayer = L.layerGroup().addTo(map)
      stationLayer = L.layerGroup().addTo(map)
      for (const line of mod.TOKYO_LINES) {
        if (line.path.length < 2) continue
        L.polyline(line.path, { color: '#6b6b6b', weight: 3.4, opacity: 0.45, pane: 'transit', lineCap: 'round', lineJoin: 'round' }).addTo(lineLayer)
      }
      for (const line of mod.TOKYO_LINES) {
        if (line.path.length < 2) continue
        L.polyline(line.path, { color: soften(line.color, 0.18), weight: 2.6, opacity: 0.92, pane: 'transit', lineCap: 'round', lineJoin: 'round' }).addTo(lineLayer)
      }
      map.on('moveend', onMove)
      map.on('zoomed', onZoom)
      setTiers()
      renderStations(mod.TOKYO_LINES)
    })

    return cleanup
  }, [map])

  return null
}

