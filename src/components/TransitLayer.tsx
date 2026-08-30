import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LineDef, StationDef } from '../data/tokyo'

let tokyoData: { TOKYO_LINES: LineDef[]; TOKYO_STATIONS: StationDef[] } | null = null

function stationIcon(s: StationDef, lines: LineDef[]): L.DivIcon {
  const covered = s.lines.map((li) => lines[li]).filter((l) => l)
  const dots = covered
    .slice(0, 4)
    .map((l) => `<i style="background:${l.color}"></i>`)
    .join('')
  const label = s.en
    ? `<div class="station-label">${s.en.replace(/</g, '&lt;')}<span class="ja">${s.ja.replace(/</g, '&lt;')}</span></div>`
    : `<div class="station-label">${s.ja.replace(/</g, '&lt;')}</div>`
  return L.divIcon({
    className: 'station-wrap',
    html: `<div class="station-marker"><span class="station-dots">${dots}</span>${label}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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
      if (z < 13) {
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
      map.getContainer().classList.toggle('zoomed-in', z >= 15)
      map.getContainer().classList.toggle('transit-far', z < 13)
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
        L.polyline(line.path, { color: '#333', weight: 3, opacity: 0.7, pane: 'transit', lineCap: 'round', lineJoin: 'round' }).addTo(lineLayer)
      }
      for (const line of mod.TOKYO_LINES) {
        if (line.path.length < 2) continue
        L.polyline(line.path, { color: line.color, weight: 1.8, opacity: 0.92, pane: 'transit', lineCap: 'round', lineJoin: 'round' }).addTo(lineLayer)
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

