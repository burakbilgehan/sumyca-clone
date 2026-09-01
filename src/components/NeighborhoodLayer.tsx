import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { NEIGHBORHOODS } from '../data/neighborhoods'

// zoom'a göre punto: her seviyede okunur kalır ama uzakta küçülür
function fontPx(z: number): number {
  if (z <= 11) return 11
  if (z === 12) return 12
  if (z <= 14) return 13
  return 15
}

const HOOD_PANE = 'hood'

export function NeighborhoodLayer() {
  const map = useMap()

  useEffect(() => {
    let disposed = false
    const pane = map.getPane(HOOD_PANE) ?? map.createPane(HOOD_PANE)
    // tile'ların (200) üstünde, hat/istasyon (380+) ve ilan pinlerinin altında
    pane.style.zIndex = '300'
    pane.style.pointerEvents = 'none'
    const group = L.layerGroup([], { pane: HOOD_PANE }).addTo(map)

    const labelIcon = (name: string, px: number, w: number, h: number) =>
      L.divIcon({
        className: 'hood-label-wrap',
        html: `<div class="hood-label" style="font-size:${px}px">${name.replace(/</g, '&lt;')}</div>`,
        iconSize: [w, h],
        iconAnchor: [w / 2, h + 4],
      })

    const render = () => {
      if (disposed) return
      group.clearLayers()
      const z = map.getZoom()
      if (z < 10) return
      const bounds = map.getBounds()
      const px = fontPx(z)
      const pad = 3

      const visible = NEIGHBORHOODS.filter((n) => n.minZoom <= z && bounds.contains([n.lat, n.lng]))
      // öncelik sırasıyla açgözlü declutter: çakışan etiketleri gizle
      const placed: { n: (typeof NEIGHBORHOODS)[number]; x1: number; x2: number; y1: number; y2: number; w: number; h: number }[] = []
      for (const n of [...visible].sort((a, b) => b.priority - a.priority)) {
        const pt = map.latLngToContainerPoint([n.lat, n.lng])
        const w = Math.max(30, Math.ceil(n.en.length * px * 0.68))
        const h = Math.ceil(px * 1.5)
        const box = { x1: pt.x - w / 2 - pad, x2: pt.x + w / 2 + pad, y1: pt.y - h - 4 - pad, y2: pt.y - 4 + pad }
        if (placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)) continue
        placed.push({ n, ...box, w, h })
      }

      for (const p of placed) {
        const m = L.marker([p.n.lat, p.n.lng], {
          icon: labelIcon(p.n.en, px, p.w, p.h),
          interactive: false,
          keyboard: false,
          pane: HOOD_PANE,
        })
        group.addLayer(m)
      }
    }

    map.on('moveend zoomend', render)
    render()
    return () => {
      disposed = true
      map.off('moveend', render)
      map.off('zoomend', render)
      group.remove()
    }
  }, [map])

  return null
}
