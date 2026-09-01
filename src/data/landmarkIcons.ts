// El yapımı SVG ikon seti (emoji yok). Her ikon tek renkli çizgi stilindedir,
// beyaz yuvarlak rozet içinde gösterilir.
export interface LandmarkIcon {
  svg: string
  color: string
}

const wrap = (color: string, body: string) => ({
  color,
  svg: `<svg viewBox="0 0 24 24" style="color:${color}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
})

const ICONS: Record<string, (c: string) => string> = {
  // kafes kule (Skytree / Tokyo Tower)
  tower: (c) => wrap(c, '<path d="M12 3v4"/><path d="M7 20l4-13"/><path d="M17 20L13 7"/><path d="M4 20h16"/><path d="M8.5 10h7"/><path d="M9.5 14h5"/><path d="M10.5 17.5h3"/>').svg,
  // torii kapısı
  torii: (c) => wrap(c, '<path d="M4.5 9c2-2.5 5-3.5 7.5-3.5S17.5 6.5 19.5 9"/><path d="M5 9h14"/><path d="M6.5 12h11"/><path d="M8 12v8"/><path d="M16 12v8"/><path d="M6.5 20h11"/>').svg,
  // kale (Imperial Palace)
  castle: (c) => wrap(c, '<path d="M5 21V10l7-5 7 5v11"/><path d="M3 21h18"/><path d="M5 21v-3h2v3"/><path d="M17 21v-3h2v3"/><path d="M8 21v-3h2v3"/><path d="M14 21v-3h2v3"/><path d="M10 15h4"/><path d="M10 18h4"/>').svg,
  // ağaç (bahçeler)
  tree: (c) => wrap(c, '<path d="M12 21v-5"/><path d="M12 16c-4.2 0-6.5-2.2-6.5-5.5S9.6 6.5 12 6.5s6.5 1.8 6.5 4S16.2 16 12 16z"/><path d="M12 11c-2.6 0-4-1.4-4-3.5S9.4 4 12 4s4 1.4 4 3.5S14.6 11 12 11z"/>').svg,
  // sakura çiçeği
  sakura: (c) => wrap(c, '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="8.6" r="2.4"/><circle cx="15.2" cy="10.4" r="2.4"/><circle cx="14" cy="13.9" r="2.4"/><circle cx="10" cy="13.9" r="2.4"/><circle cx="8.8" cy="10.4" r="2.4"/>').svg,
  // balık (market)
  fish: (c) => wrap(c, '<path d="M2.5 12c3-4.6 7.3-6 13.3-4.5 2.6.6 4.4 2.4 5.2 4.5-.8 2.1-2.6 3.9-5.2 4.5-6 1.5-10.3.1-13.3-4.5z"/><path d="M2.5 12L.6 9.4"/><path d="M2.5 12l-1.9 2.6"/><circle cx="15.8" cy="10.8" r=".9" fill="currentColor"/>').svg,
  // alışveriş çantası
  bag: (c) => wrap(c, '<path d="M9 7V6a3 3 0 016 0v1"/><path d="M4 8h16l-1 11.5a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19.5L4 8z"/><path d="M9.5 12.5h5"/>').svg,
  // gece hayatı (ay + yıldızlar)
  night: (c) => wrap(c, '<path d="M14 4.5a7.5 7.5 0 108.1 8.1A8.6 8.6 0 0114 4.5z"/><path d="M5.5 4l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/><path d="M18.5 16.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z"/>').svg,
  // oyun kolu (Akihabara / Nakano)
  game: (c) => wrap(c, '<path d="M7 9.5h10a5.5 5.5 0 015 5v1.2a2 2 0 01-2 2H16.2L13.5 20h-3l-2.7-2.3H4a2 2 0 01-2-2v-1.2a5.5 5.5 0 015-5z"/><path d="M8 13v3"/><path d="M6.5 14.5h3"/><circle cx="15.6" cy="13.2" r="1" fill="currentColor"/><circle cx="18.4" cy="15.8" r="1" fill="currentColor"/>').svg,
  // asma köprü (Rainbow Bridge)
  bridge: (c) => wrap(c, '<path d="M7 6v9"/><path d="M17 6v9"/><path d="M3 18h18"/><path d="M5 14.5h14"/><path d="M7 6c3 3 5 5.5 8 8.5"/><path d="M17 6c-3 3-5 5.5-8 8.5"/>').svg,
  // stadyum
  stadium: (c) => wrap(c, '<path d="M2 10.5C2 7.8 5.8 5.8 12 5.8S22 7.8 22 10.5v5.3c0 3.1-4 4.6-10 4.6s-10-1.5-10-4.6v-5.3z"/><path d="M2 13.6c3 1.4 6.6 2.2 10 2.2s7-.8 10-2.2"/><path d="M12 15.8v2.5"/>').svg,
  // müze
  museum: (c) => wrap(c, '<path d="M12 3.5L3 9.5h18L12 3.5z"/><path d="M5 11v10h14V11"/><path d="M8 14.5V18"/><path d="M12 14.5V18"/><path d="M16 14.5V18"/>').svg,
  // gökdelen (Tocho vb.)
  building: (c) => wrap(c, '<path d="M5 21V8l7-3 7 3v13"/><path d="M3 21h18"/><path d="M9 11.5h2"/><path d="M9 14.5h2"/><path d="M9 17.5h2"/><path d="M13 11.5h2"/><path d="M13 14.5h2"/><path d="M13 17.5h2"/>').svg,
  // silüet / gözlem terası
  skyline: (c) => wrap(c, '<path d="M5 21v-9h3v9"/><path d="M9 21V8h4v13"/><path d="M14 21v-11h3v11"/><path d="M18 21V7h3v14"/><path d="M2 21h20"/><path d="M6 14.5h1"/><path d="M6 17.5h1"/><path d="M10 10.5h1"/><path d="M10 13.5h1"/><path d="M10 16.5h1"/><path d="M15 12.5h1"/><path d="M15 15.5h1"/><path d="M15 18.5h1"/><path d="M19 9.5h1"/><path d="M19 12.5h1"/><path d="M19 15.5h1"/>').svg,
  // fener (pazar sokakları)
  lantern: (c) => wrap(c, '<path d="M9 4h6"/><path d="M8 6h8l-1 7a3 3 0 01-6 0L8 6z"/><path d="M10 8.5h4"/><path d="M10.5 11h3"/><path d="M12 13v3"/><path d="M9 16h6"/><path d="M11 19.5h2"/>').svg,
  // kase + buhar (yemek)
  food: (c) => wrap(c, '<path d="M4 12.5h16a8 8 0 01-16 0z"/><path d="M9 9c0-1.5 1-2.5 2-2.5s2 1 2 2.5"/><path d="M15 9c0-1.5 1-2.5 2-2.5s2 1 2 2.5"/>').svg,
  // bira kupası
  bar: (c) => wrap(c, '<path d="M6 5.5h10v7a5 5 0 01-5 5H10a5 5 0 01-5-5v-7z"/><path d="M16 8h2a2 2 0 010 4h-2"/><path d="M7 7.5c1-1 2-1 3 0s2 1 3 0 2-1 3 0"/><path d="M3 21h16"/>').svg,
  // panda
  panda: (c) => wrap(c, '<circle cx="7.5" cy="4.5" r="2" fill="currentColor"/><circle cx="16.5" cy="4.5" r="2" fill="currentColor"/><circle cx="12" cy="12.5" r="7.5"/><circle cx="9.3" cy="11.5" r="1.7" fill="currentColor"/><circle cx="14.7" cy="11.5" r="1.7" fill="currentColor"/><path d="M11 14.2h2v1.1h-2z" fill="currentColor"/>').svg,
  // taiko davulu
  drum: (c) => wrap(c, '<path d="M5 9h14a3 3 0 013 3v1a3 3 0 01-3 3H5a3 3 0 01-3-3v-1a3 3 0 013-3z"/><path d="M10 4v5"/><path d="M14 4v5"/><path d="M9 16v4"/><path d="M15 16v4"/><path d="M6 20h12"/>').svg,
  // palet (sanat)
  art: (c) => wrap(c, '<path d="M12 3a9 9 0 00-9 9c0 4.6 3.6 8.7 9 8.7h1.4a2 2 0 002-2 2.1 2.1 0 012-2A9 9 0 0012 3z"/><circle cx="7.6" cy="10.2" r="1.2" fill="currentColor"/><circle cx="11" cy="7.4" r="1.2" fill="currentColor"/><circle cx="15" cy="8" r="1.2" fill="currentColor"/><circle cx="17.2" cy="12" r="1.2" fill="currentColor"/>').svg,
  // klaket (sinema)
  film: (c) => wrap(c, '<path d="M3 4.5h18v15H3v-15z"/><path d="M3 4.5L12 11"/><path d="M12 4.5l9 6.5"/><path d="M3 13.5h18"/>').svg,
  // yıldız patlaması (Shibuya Crossing)
  star: (c) => wrap(c, '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2z"/><path d="M19 15.8l.6 2.2 2.2.6-2.2.6-.6 2.2-.6-2.2-2.2-.6 2.2-.6z"/>').svg,
  // madalya (sumo)
  medal: (c) => wrap(c, '<circle cx="12" cy="10.5" r="5"/><path d="M12 8.3l.7 1.5 1.6.3-1.1 1.2.2 1.6-1.4-.7-1.4.7.2-1.6-1.1-1.2 1.6-.3z" fill="currentColor"/><path d="M9.5 14.8L7.5 21l4.5-2.7L16.5 21l-2-6.2"/>').svg,
}

const COLORS: Record<string, string> = {
  tower: '#2b6cb0',
  torii: '#d23c2a',
  castle: '#6d4c41',
  tree: '#2e7d32',
  sakura: '#d81b60',
  fish: '#0277bd',
  bag: '#ef6c00',
  night: '#3949ab',
  game: '#7b1fa2',
  bridge: '#00838f',
  stadium: '#1565c0',
  museum: '#5d4037',
  building: '#546e7a',
  skyline: '#37474f',
  lantern: '#e65100',
  food: '#00897b',
  bar: '#f9a825',
  panda: '#212121',
  drum: '#c62828',
  art: '#ad1457',
  film: '#424242',
  star: '#f9a825',
  medal: '#f57f17',
}

export function landmarkIcon(key: string): LandmarkIcon | null {
  const build = ICONS[key]
  if (!build) return null
  const color = COLORS[key] ?? '#333'
  return { svg: build(color), color }
}
