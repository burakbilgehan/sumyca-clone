const BLUEGROUND_UPSTREAM = 'https://www.theblueground.com'
const EXFLATS_BASE = 'https://www.exflats.com'
const PHOTON = 'https://photon.komoot.io/api/'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const timeoutFetch = (url, ms, headers = {}) =>
  fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(ms) })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

const INVENTORY_TTL = 12 * 60 * 60
const DETAIL_TTL = 24 * 60 * 60
const GEO_TTL = 30 * 24 * 60 * 60

async function fetchText(url) {
  const res = await timeoutFetch(url, 15000, { Accept: 'text/html' })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return await res.text()
}

const CACHE_PREFIX = 'https://cache.local/'

async function cachedJson(cache, key, ttl, producer) {
  const k = `${CACHE_PREFIX}${key.replace(/[^a-zA-Z0-9-_/.]/g, '-')}`
  const cached = await cache.match(k)
  if (cached) return cached.json()
  const data = await producer()
  if (data !== undefined) {
    await cache.put(k, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }), {
      expirationTtl: ttl,
    })
  }
  return data
}

function parseListPage(html) {
  const items = []
  const blocks = html.split('<li').slice(1)
  for (const block of blocks) {
    const id = (block.match(/\/fudo\/(\d+)/) || [])[1]
    const price = (block.match(/top_price">\s*([0-9.,]+)\s*万円/) || [])[1]
    const img = (block.match(/box4image"\s+src="([^"]+)"/) || [])[1]
    if (!id || !price) continue
    items.push({
      id,
      price: Math.round(Number(price.replace(/,/g, '')) * 10000),
      title: (block.match(/top_title">([^<]+)</) || [])[1] || `Exflats #${id}`,
      layout: (block.match(/top_madori">([^<]+)</) || [])[1] || '',
      district: (block.match(/top_shozaichi">([^<]+)</) || [])[1] || '',
      image: img || '',
    })
  }
  return items
}

function parseDetailPage(html, district) {
  const addrMatch = html.match(/所在地<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)
  let address = addrMatch ? addrMatch[1].replace(/<[^>]+>/g, '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim() : ''
  if (district && address.startsWith(district)) address = address.slice(district.length).trim()
  const stations = []
  const seenStations = new Set()
  for (const m of html.matchAll(/([^<>|]{2,24}?線)\s*[「]?\s*([^<>|]{1,20}?駅)\s*[」]?\s*徒歩(\d+)分/g)) {
    const key = `${m[2]}:${m[3]}`
    if (seenStations.has(key)) continue
    seenStations.add(key)
    stations.push({ name: m[2].trim(), walk: Number(m[3]) })
  }
  const sizeMatch = html.match(/(\d+(?:\.\d+)?)m[²2]/)
  const capacityMatch = html.match(/利用可能人数<\/th>\s*<td[^>]*>\s*([０-９0-9]+)\s*名/)
  let capacity = 2
  if (capacityMatch) {
    const normalized = capacityMatch[1].replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10))
    capacity = Number(normalized) || 2
  }
  const imgMatch = html.match(/box1image-s"?\s+src="([^"]+)"/) || html.match(/top_image"?\s+src="([^"]+)"/)
  return {
    address,
    stations,
    size: sizeMatch ? Number(sizeMatch[1]) : 0,
    capacity,
    image: imgMatch ? imgMatch[1] : '',
  }
}

function inSapporo(lat, lng) {
  return lat > 42.6 && lat < 43.4 && lng > 141.0 && lng < 141.9
}

async function geocode(cache, address, district) {
  const key = `exflats-geo:${address}`
  return cachedJson(cache, key, GEO_TTL, async () => {
    const queries = [...new Set([district ? `${district} ${address}` : address, district].filter(Boolean))]
    for (const q of queries) {
      let lat = NaN
      let lng = NaN
      try {
        const gres = await timeoutFetch(`https://www.geocoding.jp/api/?q=${encodeURIComponent(q)}`, 8000)
        if (gres.ok) {
          const text = await gres.text()
          lat = Number((text.match(/<lat>([\d.]+)/) || [])[1])
          lng = Number((text.match(/<lng>([\d.]+)/) || [])[1])
        }
      } catch {
        // geocoding.jp yanıt vermedi
      }
      if (!inSapporo(lat, lng)) {
        try {
          const pres = await timeoutFetch(`${PHOTON}?${new URLSearchParams({ q, limit: '1' })}`, 8000)
          if (pres.ok) {
            const json = await pres.json()
            const f = json.features && json.features[0]
            if (f) {
              lng = f.geometry.coordinates[0]
              lat = f.geometry.coordinates[1]
            }
          }
        } catch {
          // photon da yanıt vermedi
        }
      }
      if (inSapporo(lat, lng)) return { lat, lng }
      await new Promise((r) => setTimeout(r, 250))
    }
    return null
  })
}

async function buildInventory(cache) {
  return cachedJson(cache, 'exflats-inventory:v1', INVENTORY_TTL, async () => {
    const html = await fetchText(`${EXFLATS_BASE}/archives/bukken/monthly`)
    const base = parseListPage(html)
    const seen = new Set()
    const out = []
    for (const item of base) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      let detail = { address: item.district, stations: [], size: 0, capacity: 1, image: item.image }
      try {
        const dhtml = await cachedJson(cache, `exflats-detail:${item.id}`, DETAIL_TTL, async () => {
          const text = await fetchText(`${EXFLATS_BASE}/fudo/${item.id}`)
          return parseDetailPage(text, item.district)
        })
        if (dhtml) detail = dhtml
      } catch {
        // detay çekilemezse liste verisiyle devam et
      }
      let coords = null
      if (detail.address) {
        try {
          coords = await geocode(cache, detail.address, item.district)
        } catch {
          coords = null
        }
      }
      if (!coords) continue
      out.push({
        id: item.id,
        title: item.title,
        priceMonthly: item.price,
        layout: item.layout,
        size: detail.size,
        capacity: detail.capacity,
        address: detail.address,
        stations: detail.stations,
        image: detail.image || item.image,
        lat: coords.lat,
        lng: coords.lng,
        url: `${EXFLATS_BASE}/fudo/${item.id}`,
      })
    }
    return out
  })
}

async function handleBlueground(url) {
  const qs = url.search || ''
  const upstream = `${BLUEGROUND_UPSTREAM}/api/sp${qs}`
  const res = await timeoutFetch(upstream, 20000, { Accept: 'application/json' })
  if (!res.ok) return new Response(await res.text(), { status: res.status, headers: CORS })
  const json = await res.json()
  return new Response(JSON.stringify(json), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Birden fazla property'nin rent-breakdown'unu tek istekte toplar (kira + utility + sigorta toplamı)
async function handleBreakdowns(url) {
  const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const marketCode = url.searchParams.get('marketCode') ?? 'TYO'
  const currency = url.searchParams.get('currency') ?? 'JPY'
  const checkIn = url.searchParams.get('checkIn') ?? ''
  const checkOut = url.searchParams.get('checkOut') ?? ''
  const out = {}
  await Promise.all(
    ids.map(async (id) => {
      try {
        const q = new URLSearchParams({ marketCode, currency, checkIn, checkOut })
        const res = await timeoutFetch(`${BLUEGROUND_UPSTREAM}/api/sp/property/${id}/rent-breakdown?${q}`, 10000, {
          Accept: 'application/json',
        })
        if (res.ok) out[id] = await res.json()
      } catch {
        // tek property başarısızsa atlasın
      }
    }),
  )
  return new Response(JSON.stringify(out), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    try {
      if (url.pathname === '/proxy/blueground') {
        return await handleBlueground(url)
      }
      if (url.pathname === '/proxy/blueground-breakdowns') {
        return await handleBreakdowns(url)
      }
      if (url.pathname === '/sources/exflats') {
        const items = await buildInventory(caches.default)
        return new Response(JSON.stringify({ items }), {
          status: 200,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      return new Response('not found', { status: 404, headers: CORS })
    } catch (e) {
      return new Response(String(e && e.message ? e.message : e), { status: 502, headers: CORS })
    }
  },
}
