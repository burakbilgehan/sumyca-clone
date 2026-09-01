// İkonik Tokyo mekanları: çam ağacı dağılımı (üst tier az, alta doğru genişler).
// minZoom: görünürlük eşiği; priority: kalabalıkta önce gösterilir.
export interface LandmarkDef {
  id: string
  en: string
  lat: number
  lng: number
  /** landmarkIcons.ts'deki ikon anahtarı */
  icon: string
  minZoom: number
  priority: number
}

export const LANDMARKS: LandmarkDef[] = [
  // ---- Tier 1 (6): şehrin simgeleri, z>=10 ----
  { id: 'skytree', en: 'Tokyo Skytree', lat: 35.7101, lng: 139.8107, icon: 'tower', minZoom: 10, priority: 3 },
  { id: 'tokyo-tower', en: 'Tokyo Tower', lat: 35.6586, lng: 139.7454, icon: 'tower', minZoom: 10, priority: 3 },
  { id: 'imperial-palace', en: 'Imperial Palace', lat: 35.6852, lng: 139.7528, icon: 'castle', minZoom: 10, priority: 3 },
  { id: 'sensoji', en: 'Senso-ji (Asakusa)', lat: 35.7148, lng: 139.7967, icon: 'torii', minZoom: 10, priority: 3 },
  { id: 'shibuya-crossing', en: 'Shibuya Crossing', lat: 35.6595, lng: 139.7005, icon: 'star', minZoom: 10, priority: 3 },
  { id: 'meiji-jingu', en: 'Meiji Jingu', lat: 35.6764, lng: 139.6993, icon: 'torii', minZoom: 10, priority: 3 },

  // ---- Tier 2 (14): popüler mekanlar, z>=12 ----
  { id: 'tokyo-dome', en: 'Tokyo Dome', lat: 35.7056, lng: 139.7519, icon: 'stadium', minZoom: 12, priority: 2 },
  { id: 'ginza', en: 'Ginza', lat: 35.6717, lng: 139.765, icon: 'bag', minZoom: 12, priority: 2 },
  { id: 'akihabara', en: 'Akihabara Electric Town', lat: 35.6995, lng: 139.771, icon: 'game', minZoom: 12, priority: 2 },
  { id: 'rainbow-bridge', en: 'Rainbow Bridge / Odaiba', lat: 35.6366, lng: 139.7628, icon: 'bridge', minZoom: 12, priority: 2 },
  { id: 'toyosu-market', en: 'Toyosu Fish Market', lat: 35.6442, lng: 139.7831, icon: 'fish', minZoom: 12, priority: 2 },
  { id: 'yoyogi-park', en: 'Yoyogi Park', lat: 35.6716, lng: 139.6943, icon: 'tree', minZoom: 12, priority: 2 },
  { id: 'kabukicho', en: 'Kabukicho', lat: 35.6938, lng: 139.7034, icon: 'night', minZoom: 12, priority: 2 },
  { id: 'roppongi-hills', en: 'Roppongi Hills', lat: 35.6602, lng: 139.7291, icon: 'skyline', minZoom: 12, priority: 2 },
  { id: 'shinjuku-gyoen', en: 'Shinjuku Gyoen', lat: 35.6852, lng: 139.7103, icon: 'sakura', minZoom: 12, priority: 2 },
  { id: 'golden-gai', en: 'Golden Gai', lat: 35.6938, lng: 139.7045, icon: 'bar', minZoom: 12, priority: 2 },
  { id: 'takeshita', en: 'Takeshita-dori', lat: 35.6713, lng: 139.7035, icon: 'bag', minZoom: 12, priority: 2 },
  { id: 'ueno-zoo', en: 'Ueno Zoo', lat: 35.7169, lng: 139.7714, icon: 'panda', minZoom: 12, priority: 2 },
  { id: 'nat-museum', en: 'Tokyo National Museum', lat: 35.7189, lng: 139.7765, icon: 'museum', minZoom: 12, priority: 2 },
  { id: 'budokan', en: 'Nippon Budokan', lat: 35.6933, lng: 139.7501, icon: 'drum', minZoom: 12, priority: 2 },

  // ---- Tier 3 (20): lokal uğrak noktaları, z>=13 ----
  { id: 'omotesando', en: 'Omotesando', lat: 35.6654, lng: 139.7127, icon: 'bag', minZoom: 13, priority: 1 },
  { id: 'ameyoko', en: 'Ameya-Yokocho', lat: 35.7113, lng: 139.7743, icon: 'lantern', minZoom: 13, priority: 1 },
  { id: 'national-stadium', en: 'Japan National Stadium', lat: 35.6779, lng: 139.7145, icon: 'stadium', minZoom: 13, priority: 1 },
  { id: 'ghibli', en: 'Ghibli Museum', lat: 35.6962, lng: 139.5704, icon: 'film', minZoom: 13, priority: 1 },
  { id: 'nakano-broadway', en: 'Nakano Broadway', lat: 35.7091, lng: 139.6654, icon: 'game', minZoom: 13, priority: 1 },
  { id: 'kappabashi', en: 'Kappabashi Kitchen Town', lat: 35.7146, lng: 139.7889, icon: 'food', minZoom: 13, priority: 1 },
  { id: 'kokugikan', en: 'Ryogoku Kokugikan (Sumo)', lat: 35.697, lng: 139.7935, icon: 'medal', minZoom: 13, priority: 1 },
  { id: 'chidorigafuchi', en: 'Chidorigafuchi (Sakura)', lat: 35.6908, lng: 139.7503, icon: 'sakura', minZoom: 13, priority: 1 },
  { id: 'meguro-river', en: 'Meguro River (Sakura)', lat: 35.6471, lng: 139.6997, icon: 'sakura', minZoom: 13, priority: 1 },
  { id: 'hamarikyu', en: 'Hama-rikyu Gardens', lat: 35.66, lng: 139.7622, icon: 'tree', minZoom: 13, priority: 1 },
  { id: 'shibuya-sky', en: 'Shibuya Sky', lat: 35.6585, lng: 139.7016, icon: 'skyline', minZoom: 13, priority: 1 },
  { id: 'teamlab-borderless', en: 'teamLab Borderless', lat: 35.6606, lng: 139.74, icon: 'art', minZoom: 13, priority: 1 },
  { id: 'omoide', en: 'Omoide Yokocho', lat: 35.6947, lng: 139.6982, icon: 'food', minZoom: 13, priority: 1 },
  { id: 'nonbei', en: 'Nonbei Yokocho', lat: 35.6596, lng: 139.6986, icon: 'bar', minZoom: 13, priority: 1 },
  { id: 'tsukiji-outer', en: 'Tsukiji Outer Market', lat: 35.6653, lng: 139.7702, icon: 'fish', minZoom: 13, priority: 1 },
  { id: 'zojoji', en: 'Zojo-ji', lat: 35.6573, lng: 139.7483, icon: 'torii', minZoom: 13, priority: 1 },
  { id: 'hie-shrine', en: 'Hie Shrine', lat: 35.6746, lng: 139.7399, icon: 'torii', minZoom: 13, priority: 1 },
  { id: 'nezu-shrine', en: 'Nezu Shrine', lat: 35.7201, lng: 139.7606, icon: 'torii', minZoom: 13, priority: 1 },
  { id: 'yanaka-ginza', en: 'Yanaka Ginza', lat: 35.7249, lng: 139.7676, icon: 'lantern', minZoom: 13, priority: 1 },
  { id: 'rikugien', en: 'Rikugien Garden', lat: 35.7323, lng: 139.7468, icon: 'tree', minZoom: 13, priority: 1 },
]
