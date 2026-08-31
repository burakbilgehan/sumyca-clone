import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const mod = await server.ssrLoadModule('/src/sources/index.ts')
  const form = {
    locationName: 'Tokyo',
    startDate: '',
    endDate: '',
    numGuests: 2,
    maxCost: 300000,
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
  console.log('total listings:', run.listings.length)
  console.log('hasMore:', run.hasMore)
  console.log('notes:', run.notes)
  const bySource = {}
  for (const l of run.listings) bySource[l.source] = (bySource[l.source] ?? 0) + 1
  console.log('by source:', bySource)
  for (const l of run.listings.slice(0, 6)) {
    console.log(`- [${l.source}] ${l.name} | ${l.layoutType} | ${l.size}m² | ¥${Math.round(l.totalDailyCost * 30)}/mo | ${l.location.lat.toFixed(3)},${l.location.lng.toFixed(3)} | ${l.mainImageThumbnailUrl?.slice(0, 60)}`)
  }
} finally {
  await server.close()
}
