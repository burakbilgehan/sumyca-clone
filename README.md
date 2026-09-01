# Sumyca Clone (with map)

Sumyca'nın görsel klonu + harita görünümü. Listings birden fazla kaynaktan canlı çekilir (Sumyca + benzer furnished apartment siteleri), sonuçlar hem listede hem Leaflet haritasında gösterilir. Harita pinleri kaynak sitenin rengini taşır; "More filters > Sources" ile kaynaklar seçilebilir.

## Run

```bash
npm install
npm run dev
```

Production build: `npm run build` / `npm run preview`

## Veri kaynakları

Her kaynak `src/sources/` altında bir adapter'dır: evrensel `SearchFormState` filtrelerini o siteye özgü isteğe çevirir, dönen veriyi ortak `Listing` biçimine normalleştirir.

| Kaynak | Veri | Erişim |
|---|---|---|
| Sumyca | `api-sumyca.m2msystems.cloud` search + quotation_estimates | CORS açık, direkt |
| Hmlet | `ywzjnepacv.ap-northeast-1.awsapprunner.com/v1/units` | CORS açık, direkt |
| Tokyo Furnished | `tokyo-furnished.com/wp-json` (katalog, fiyat/koordinat content HTML'inden parse) | CORS açık, direkt |
| Blueground | `theblueground.com/api/sp` | CORS yok, Worker proxy üzerinden |
| Exflats | `exflats.com` HTML listeleri + detaylar (scrape) | CORS yok, Worker proxy üzerinden |

Bir kaynak aktif filtreyi karşılayamıyorsa o aramada atlanır ve sonuç listesinde not düşülür.

## Cloudflare Worker proxy

`worker/` dizini Blueground pass-through ve Exflats scraper'ını barındırır:

```bash
cd worker
npx wrangler deploy
```

Sonra Worker URL'ini client'a tanıt:

```bash
echo "VITE_WORKER_BASE=https://<worker>.workers.dev" > .env.local
```

Worker ayarlanmazsa Blueground/Exflats kaynakları "proxy not configured" notu ile sessizce atlanır. Exflats envanteri Worker'da 12 saat, detaylar 24 saat, geocode 30 gün cache'lenir (ilk istek yavaş olabilir).

## Diğer

- Konum autocomplete: Photon (OSM)
- Harita: Leaflet + OpenStreetMap tiles. İngilizce mahalle etiketleri (`src/data/neighborhoods.ts`, zoom'a göre kademeli, çakışanlar ayıklanır) OSM etiketlerinin üstünde ama hat/istasyon/ilan pinlerinin altında bir pane'de çizilir. İkonik mekanlar (`src/data/landmarks.ts`, el yapımı SVG ikonlar, çam ağacı tier dağılımı: 6/14/20) mahalle etiketlerinin üstünde rozet olarak gösterilir; hover'da adı çıkar. Metro istasyonları z15'te sadece aktarma istasyonları olarak, z16+ hepsi + ad etiketleriyle görünür.
- Rezervasyonlar orijinal sitede yapılır: karttaki "View on {source}" linki kaynağın detay sayfasına gider.
- Ulaşım kutusu: her kart, 8 merkeze (Shibuya, Shinjuku, Asakusa, Akihabara, Roppongi, Ginza, Haneda, Narita) tahmini toplu taşıma süresini gösterir. Süreler `scripts/build-transit-matrix.mjs` ile mini-tokyo-3d istasyon grafı üzerinde Dijkstra ile önceden hesaplanmış statik matristen gelir (hat hızları + aktarma cezaları + havalimanı ekspres kenarları); gerçek tarife değil tahmindir, kartta "(est.)" olarak işaretlenir. Listing'in istasyonları matriste bulunamazsa koordinattan en yakın istasyonlara snap yapılır. Matrisi yenilemek: `npm run build:transit`.
- `scripts/smoke-search.mjs` ve `scripts/smoke-integration.mjs`: adapter'ları dev server üzerinden uçtan uca test eder.
