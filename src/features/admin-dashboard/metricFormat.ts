import type { MetricResultSeriesItem } from '@/api/generated/model'
import { formatDateTime } from '@/lib/time'

export function metricBucketLabel(key: string | undefined, group?: string) {
  if (!key) return ''
  if (group === 'hour' && Number.isFinite(Date.parse(key))) return formatDateTime(key).slice(0, 5)
  return group === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(8) : key
}

/** Ghép đúng mốc kỳ trước; API có thể bỏ các khoảng không có dữ liệu. */
export function previousPoint(
  series: MetricResultSeriesItem[] | undefined,
  key: string | undefined,
  group?: string,
  offsetMs = 0,
) {
  if (group === 'day' || group === 'hour') {
    const at = Date.parse(key ?? '') - offsetMs
    return series?.find((point) => Date.parse(point.key ?? '') === at)
  }
  return series?.find((point) => point.key === key)
}

export const metricNames = {
  revenue: 'Doanh thu',
  tickets_sold: 'Vé bán',
  fill_rate: 'Lấp đầy',
  checkins: 'Check-in',
} as const
export function metricValue(metric: string, value?: number, compact = false): string {
  if (value === undefined) return '—'
  const number = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: compact ? 2 : 1 })
  if (metric === 'revenue') {
    if (compact && value >= 1e9) return `${number(value / 1e9)} tỷ ₫`
    if (compact && value >= 1e6) return `${number(value / 1e6)}tr ₫`
    return `${number(value)} ₫`
  }
  return `${number(value)}${metric === 'fill_rate' ? '%' : ''}`
}
export function previousRange(from: string, to: string) {
  const a = Date.parse(from),
    b = Date.parse(to)
  return { from: new Date(a - (b - a)).toISOString(), to: new Date(a).toISOString() }
}
export function changeText(metric: string, current?: number, previous?: number) {
  if (current === undefined || previous === undefined || (!previous && metric !== 'fill_rate')) return null
  const change = metric === 'fill_rate' ? current - previous : ((current - previous) / previous) * 100
  return {
    positive: change >= 0,
    text: `${change >= 0 ? '+' : ''}${change.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${metric === 'fill_rate' ? ' điểm' : '%'}`,
  }
}
