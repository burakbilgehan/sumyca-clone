# Sumyca Clone (with map)

Sumyca'nın görsel klonu + harita görünümü. Listings ve fiyatlar canlı olarak Sumyca API'sinden çekilir, sonuçlar hem listede hem Leaflet haritasında gösterilir.

## Run

```bash
npm install
npm run dev
```

Production build: `npm run build` / `npm run preview`

## Veri kaynakları

- Arama: `api-sumyca.m2msystems.cloud/search_listings_with_room_type/location_name_and_conditions` (CORS açık)
- Konaklama toplam fiyatı/indirimler: `POST api-sumyca.m2msystems.cloud/quotation_estimates`
- Konum autocomplete: Photon (OSM)
- Harita: Leaflet + OpenStreetMap tiles

## Farklar (orijinal Sumyca'ya göre)

- Sonuçlar haritada fiyat pinleri ile gösterilir; kart ve pinler arasında hover/tıklama senkronizasyonu vardır
- Load more ile sayfalama, sort değişince otomatik arama
- Mobilde List/Map görünüm anahtarı

Rezervasyonlar orijinal sitede yapılır: karttaki "View details" linki `sumyca.com/en/listings/{id}` adresine gider.
