import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { LANDMARKS } from '../data/landmarks'
import { landmarkIcon } from '../data/landmarkIcons'

// rozet boyutu zoom ile büyür ama her seviyede seçilir kalır
function badgePx(z: number): number {
  if (z <= 11) return 22
  if (z === 12) return 26
  if (z <= 14) return 30
  return 36
}

const LANDMARK_PANE = 'landmarks'

export function LandmarkLayer() {
  const map = useMap()

  useEffect(() => {
    let disposed = false
    const pane = map.getPane(LANDMARK_PANE) ?? map.createPane(LANDMARK_PANE)
    // mahalle etiketlerinin (300) üstünde, hat (380) ve istasyonların (400) altında
    pane.style.zIndex = '395'
    const group = L.layerGroup([], { pane: LANDMARK_PANE }).addTo(map)

    const render = () => {
      if (disposed) return
      group.clearLayers()
      const z = map.getZoom()
      if (z < 10) return
      const bounds = map.getBounds()
      const px = badgePx(z)
      const pad = 5
      const placed: { x1: number; x2: number; y1: number; y2: number }[] = []

      const visible = LANDMARKS.filter((l) => l.minZoom <= z && bounds.contains([l.lat, l.lng]))
      for (const lm of [...visible].sort((a, b) => b.priority - a.priority)) {
        const icon = landmarkIcon(lm.icon)
        if (!icon) continue
        const pt = map.latLngToContainerPoint([lm.lat, lm.lng])
        const box = { x1: pt.x - px / 2 - pad, x2: pt.x + px / 2 + pad, y1: pt.y - px / 2 - pad, y2: pt.y + px / 2 + pad }
        if (placed.some((p) => box.x1 < p.x2 && box.x2 > p.x1 && box.y1 < p.y2 && box.y2 > p.y1)) continue
        placed.push(box)

        const divIcon = L.divIcon({
          className: 'landmark-wrap',
          html: `<div class="landmark-badge" style="width:${px}px;height:${px}px">${icon.svg}</div>`,
          iconSize: [px, px],
          iconAnchor: [px / 2, px / 2],
        })
        const m = L.marker([lm.lat, lm.lng], {
          icon: divIcon,
          interactive: true,
          keyboard: false,
          pane: LANDMARK_PANE,
        })
        m.bindTooltip(lm.en, { direction: 'top', offset: [0, -px / 2 - 4] })
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
