import type { QuoteResult, Listing } from './types'

export interface PricedEntry {
  listing: Listing
  quote?: QuoteResult
}

export function fmtYen(v: number): string {
  return `¥${v.toLocaleString('en-US')}`
}

export function compactYen(v: number): string {
  if (v >= 100000) return `¥${Math.round(v / 1000)}K`
  if (v >= 1000) return `¥${(v / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `¥${v}`
}

// Aylık toplam: 30 gecelik kanonik kotalasyon, yoksa günlük kira * 30
export function monthlyAmount(e: PricedEntry): number {
  return e.quote?.afterTotal ?? e.listing.totalDailyCost * 30
}

export function monthlySuffix(): string {
  return '/month 〜'
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
