import type { ChatBlock } from '@/api/generated/model'

import { isRecord, num, recList, root, str, strList } from './payloads'

/**
 * Payload các block của Admin Copilot. Contract chỉ có 8 `ChatBlockType` và `payload: object`, không có
 * block bảng duyệt đơn hay form suất diễn, nên web phân biệt bằng `payload.view` (xem docs/agent-mode-notes.md):
 *   review_table (bảng duyệt hàng loạt), showtime_form (form suất mới), seat_lock (chọn ghế để khoá).
 * Đọc lỏng như `payloads.ts`: thiếu trường thì bỏ qua, không văng lỗi.
 */

export type BlockViewKind = 'review_table' | 'showtime_form' | 'seat_lock'

export function blockView(block: ChatBlock): BlockViewKind | undefined {
  const v = str(root(block).view)
  return v === 'review_table' || v === 'showtime_form' || v === 'seat_lock' ? v : undefined
}

export type Tone = 'success' | 'danger' | 'warning' | 'neutral'
const tone = (v: unknown): Tone => (v === 'success' || v === 'danger' || v === 'warning' ? v : 'neutral')

// ---------------------------------------------------------------- StatCards
export type MetricUnit = 'tickets' | 'VND' | 'percent' | 'checkins'
export type StatCard = {
  label: string
  /** Chuỗi hiển thị. Ưu tiên `value_label` do agent tính; không tự cộng/quy đổi ở client. */
  display: string
  delta?: { label: string; tone: Tone }
  compare?: string
}
export type StatCardsPayload = { cards: StatCard[] }

/** Định dạng số liệu theo đơn vị của MetricResult, khi agent không gửi sẵn `value_label`. */
export function formatMetric(value: number, unit?: string): string {
  const n = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
  if (unit === 'percent') return `${n.format(value)}%`
  if (unit === 'VND') {
    if (Math.abs(value) >= 1e9) return `${n.format(value / 1e9)} tỷ ₫`
    if (Math.abs(value) >= 1e6) return `${n.format(value / 1e6)} triệu ₫`
    return `${n.format(value)} ₫`
  }
  return n.format(value)
}

export function parseStatCards(block: ChatBlock): StatCardsPayload {
  const cards = recList(root(block).cards).flatMap((c): StatCard[] => {
    const value = num(c.value)
    const display = str(c.value_label) ?? (value === undefined ? undefined : formatMetric(value, str(c.unit)))
    if (!display) return []
    const d =
      isRecord(c.delta) && str(c.delta.label) ? { label: str(c.delta.label)!, tone: tone(c.delta.tone) } : undefined
    return [{ label: str(c.label) ?? '', display, delta: d, compare: str(c.compare) }]
  })
  return { cards }
}

// ---------------------------------------------------------------- Chart
export type ChartBar = { value: number; highlight: boolean }
export type ChartPayload = {
  title: string
  unitLabel?: string
  groups: { label: string; bars: ChartBar[]; tone: 'ink' | 'danger' }[]
  max: number
}

/** Mỗi nhóm có nhiều cột (các kỳ); cột cuối là kỳ hiện tại (đậm), `tone: 'danger'` tô đỏ cột đó. */
export function parseChart(block: ChatBlock): ChartPayload {
  const p = root(block)
  const groups = recList(p.categories).map((g) => {
    const values = (Array.isArray(g.values) ? g.values : []).filter((v): v is number => typeof v === 'number')
    return {
      label: str(g.label) ?? '',
      bars: values.map((value, i) => ({ value, highlight: i === values.length - 1 })),
      tone: g.tone === 'danger' ? ('danger' as const) : ('ink' as const),
    }
  })
  const max = Math.max(0, ...groups.flatMap((g) => g.bars.map((b) => b.value)))
  return { title: str(p.title) ?? 'Biểu đồ', unitLabel: str(p.unit_label), groups, max }
}

// ---------------------------------------------------------------- ReviewTable
/** Chỉ có hai cách xử lý trên web: phát hành vé hoặc để sau. Không có hoàn tiền (CLAUDE.md §5). */
export type ReviewAction = 'ISSUE_TICKETS' | 'SKIP'
export type ReviewOrder = {
  orderId: string
  code: string
  reason: string
  check?: { label: string; tone: Tone }
  /** Cách xử lý đề xuất. */
  action: ReviewAction
  /** Có được chọn để duyệt không (mặc định theo đề xuất của Vingo). */
  selected: boolean
  /** Nhãn cột cuối: "Sẵn sàng" / "Cần bạn xem". */
  statusLabel?: string
  statusTone: Tone
  tickets?: number
}
export type ReviewTablePayload = { orders: ReviewOrder[] }

export function parseReviewTable(block: ChatBlock): ReviewTablePayload {
  const orders = recList(root(block).orders).flatMap((o, i): ReviewOrder[] => {
    const orderId = str(o.order_id) ?? str(o.code)
    if (!orderId) return []
    const action: ReviewAction = o.proposal === 'ISSUE_TICKETS' ? 'ISSUE_TICKETS' : 'SKIP'
    const check =
      isRecord(o.check) && str(o.check.label) ? { label: str(o.check.label)!, tone: tone(o.check.tone) } : undefined
    return [
      {
        orderId,
        code: str(o.code) ?? `#${i + 1}`,
        reason: str(o.reason) ?? '',
        check,
        action,
        // Dòng đang "để sau" thì không thể được chọn để duyệt.
        selected: action === 'ISSUE_TICKETS' && o.selected !== false,
        statusLabel: str(o.status_label),
        statusTone: tone(o.status_tone),
        tickets: num(o.tickets),
      },
    ]
  })
  return { orders }
}

// ---------------------------------------------------------------- ShowtimeForm
export type FormField = { key: string; label: string; value: string; byAgent: boolean }
export type PriceChip = { key: string; label: string; value: string; changed: boolean }
export type ShowtimeFormPayload = {
  title: string
  statusLabel: string
  fields: FormField[]
  priceTitle?: string
  prices: PriceChip[]
}

export function parseShowtimeForm(block: ChatBlock): ShowtimeFormPayload {
  const p = root(block)
  return {
    title: str(p.title) ?? 'Suất mới',
    statusLabel: str(p.status_label) ?? 'DRAFT',
    fields: recList(p.fields).flatMap((f): FormField[] => {
      const key = str(f.key)
      return key ? [{ key, label: str(f.label) ?? key, value: str(f.value) ?? '', byAgent: f.by_agent !== false }] : []
    }),
    priceTitle: str(p.price_title),
    prices: recList(p.prices).flatMap((c): PriceChip[] => {
      const key = str(c.key)
      return key ? [{ key, label: str(c.label) ?? key, value: str(c.value) ?? '', changed: c.changed === true }] : []
    }),
  }
}

// ---------------------------------------------------------------- SeatLock
export type SeatLockPayload = {
  header: string
  /** Nhãn hàng theo thứ tự `rows`. */
  rowNames: string[]
  rows: { id: string; label: string; state: 'available' | 'held' | 'sold' }[][]
  /** Ghế Vingo đề xuất khoá (đã loại ghế đã bán/đang giữ). */
  selected: string[]
}

export function parseSeatLock(block: ChatBlock, parsedRows: SeatLockPayload['rows']): SeatLockPayload {
  const p = root(block)
  const names = strList(p.row_names)
  const rowNames = parsedRows.map((row, i) => names[i] ?? row[0]?.id.split('-')[0] ?? '')
  const proposed = strList(p.selected).length ? strList(p.selected) : strList(p.suggested)
  return {
    header: str(p.zone_label) ?? str(p.zone) ?? 'Khu ghế',
    rowNames,
    rows: parsedRows,
    selected: sanitizeLockSelection(proposed, parsedRows),
  }
}

/** Ghế chỉ khoá được khi còn trống. */
export function lockable(state: 'available' | 'held' | 'sold'): boolean {
  return state === 'available'
}

/** Bỏ ghế đã bán / đang giữ / không có trong sơ đồ khỏi danh sách ghế định khoá. */
export function sanitizeLockSelection(ids: string[], rows: SeatLockPayload['rows']): string[] {
  const free = new Set(
    rows
      .flat()
      .filter((s) => lockable(s.state))
      .map((s) => s.id),
  )
  return [...new Set(ids)].filter((id) => free.has(id))
}

/** Chạm ghế: thêm hoặc bớt khỏi danh sách khoá. Ghế đã bán/đang giữ luôn bị bỏ qua. */
export function toggleLockSeat(
  selected: string[],
  seat: { id: string; state: 'available' | 'held' | 'sold' },
): string[] {
  if (!lockable(seat.state)) return selected
  return selected.includes(seat.id) ? selected.filter((s) => s !== seat.id) : [...selected, seat.id]
}

/** "A-06, A-07" hoặc, khi nhiều ghế, "A-06 → A-11 · 6 ghế" (theo thứ tự sơ đồ). */
export function describeSeats(labels: string[]): string {
  if (labels.length === 0) return 'Chưa chọn ghế'
  if (labels.length <= 3) return labels.join(', ')
  return `${labels[0]} → ${labels.at(-1)} · ${labels.length} ghế`
}
