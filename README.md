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
- Harita: Leaflet + OpenStreetMap tiles
- Rezervasyonlar orijinal sitede yapılır: karttaki "View on {source}" linki kaynağın detay sayfasına gider.
- `scripts/smoke-search.mjs` ve `scripts/smoke-integration.mjs`: adapter'ları dev server üzerinden uçtan uca test eder.
