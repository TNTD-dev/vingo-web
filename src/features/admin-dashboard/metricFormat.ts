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
export type ChangeTone = 'up' | 'down' | 'flat'
/** So kỳ này với kỳ trước. Bằng nhau → `flat` (huy hiệu trung tính, không tô xanh). Kỳ trước bằng 0 thì không tính được %. */
export function changeText(metric: string, current?: number, previous?: number) {
  if (current === undefined || previous === undefined || (!previous && metric !== 'fill_rate')) return null
  const change = metric === 'fill_rate' ? current - previous : ((current - previous) / previous) * 100
  const rounded = Math.round(change * 10) / 10
  const tone: ChangeTone = rounded === 0 ? 'flat' : rounded > 0 ? 'up' : 'down'
  if (tone === 'flat') return { tone, text: 'Không đổi' }
  return {
    tone,
    text: `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}${metric === 'fill_rate' ? ' điểm' : '%'}`,
  }
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (tính theo lịch, không phụ thuộc múi giờ máy). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
export function dayKeys(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i))
}
export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
}
/** Khoảng [from, to) theo ngày UTC, khớp bucket `day` của API (API nhóm ngày theo UTC). */
export function utcDayBounds(from: string, to: string) {
  return { from: `${from}T00:00:00.000Z`, to: `${addDays(to, 1)}T00:00:00.000Z` }
}
export type ChartPoint = { key: string; value: number }
/** API bỏ các ngày không có dữ liệu: điền 0 để biểu đồ đủ cột liên tục. */
export function fillDays(series: MetricResultSeriesItem[] | undefined, keys: string[]): ChartPoint[] {
  const byKey = new Map((series ?? []).map((p) => [p.key, p.value ?? 0]))
  return keys.map((key) => ({ key, value: byKey.get(key) ?? 0 }))
}
/** Trục Y: đỉnh là số "tròn" (1, 2, 4, 6, 8 × 10^n, để vạch giữa cũng tròn) và 3 vạch 0 / giữa / đỉnh. */
export function niceAxis(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 0.5, 1] }
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  const top = [1, 2, 4, 6, 8, 10].map((m) => m * exp).find((v) => v >= max) ?? 10 * exp
  return { top, ticks: [0, top / 2, top] }
}
export function axisLabel(metric: string, value: number): string {
  if (value === 0) return '0'
  const n = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  if (metric === 'revenue') {
    if (value >= 1e9) return `${n(value / 1e9)} tỷ`
    if (value >= 1e6) return `${n(value / 1e6)}tr`
    if (value >= 1e3) return `${n(value / 1e3)}k`
  }
  return `${n(value)}${metric === 'fill_rate' ? '%' : ''}`
}
/** Nhãn giá trị trên đầu cột: ngắn gọn (9,4tr / 750k / 12). */
export function barLabel(metric: string, value: number): string {
  return axisLabel(metric, value)
}
/** Tên khu/hạng khi không map được từ dữ liệu catalog: rút gọn dễ đọc thay vì UUID đầy đủ. */
export function shortDimensionLabel(kind: 'zone' | 'tier', key: string): string {
  return `${kind === 'zone' ? 'Khu' : 'Hạng'} …${key.replaceAll('-', '').slice(-4)}`
}
