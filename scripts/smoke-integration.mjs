import http from 'node:http'
import { createServer } from 'vite'

globalThis.caches = { default: { async match() { return null }, async put() {} } }

const { default: worker } = await import('../worker/src/index.js')

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8791')
  const wres = await worker.fetch(new Request(url), {})
  res.writeHead(wres.status, Object.fromEntries(wres.headers))
  res.end(Buffer.from(await wres.arrayBuffer()))
})
await new Promise((r) => httpServer.listen(8791, r))
process.env.VITE_WORKER_BASE = 'http://127.0.0.1:8791'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const mod = await server.ssrLoadModule('/src/sources/index.ts')
  const form = {
    locationName: 'Tokyo',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    numGuests: 2,
    maxCost: 400000,
    minCost: 0,
    maxMinuteWalk: 0,
    minSize: 0,
    maxSize: 0,
    buildYearAfter: 0,
    radius: 20,
    instantBooking: false,
    sort: 'costAsc',
    sources: [],
  }
  const run = await mod.searchAllSources(form, 0)
  const bySource = {}
  for (const l of run.listings) bySource[l.source] = (bySource[l.source] ?? 0) + 1
  console.log('total:', run.listings.length, '| by source:', bySource)
  console.log('notes:', run.notes)
  const bg = run.listings.find((l) => l.source === 'blueground')
  if (bg) console.log('BG sample:', bg.name, bg.layoutType, bg.size + 'm²', '¥' + Math.round(bg.totalDailyCost * 30) + '/mo', bg.sourceUrl)
  const hm = run.listings.find((l) => l.source === 'hmlet')
  if (hm) console.log('HM sample:', hm.name, hm.size + 'm²', '¥' + Math.round(hm.totalDailyCost * 30) + '/mo', hm.sourceUrl)

  // filtre skip testi: walk + buildYear + instant
  const strict = { ...form, maxMinuteWalk: 5, buildYearAfter: 2000, instantBooking: true }
  const run2 = await mod.searchAllSources(strict, 0)
  console.log('strict notes:', run2.notes)
  console.log('strict by source:', run2.listings.reduce((a, l) => { a[l.source] = (a[l.source] ?? 0) + 1; return a }, {}))

  // sapporo testi
  const sap = await mod.searchAllSources({ ...form, locationName: 'Sapporo' }, 0)
  const bySource2 = {}
  for (const l of sap.listings) bySource2[l.source] = (bySource2[l.source] ?? 0) + 1
  console.log('sapporo by source:', bySource2, '| notes:', sap.notes)
} finally {
  await server.close()
  httpServer.close()
}
