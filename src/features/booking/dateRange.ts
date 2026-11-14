import { vnStartOfDay } from '@/lib/time'

/** Ngày dạng "YYYY-MM-DD" theo giờ Việt Nam; so sánh chuỗi cũng đúng thứ tự thời gian. */
export type Ymd = string

export type DateRange = { from?: Ymd; to?: Ymd }

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseYmd(v: string | null | undefined): { year: number; month: number; day: number } | undefined {
  const m = v ? YMD.exec(v) : null
  if (!m) return undefined
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  // Loại ngày không có thật (31/02) bằng cách dựng lại rồi so.
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? { year, month, day }
    : undefined
}

export function toYmd(year: number, month: number, day: number): Ymd {
  const d = new Date(Date.UTC(year, month - 1, day))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

/** Khoảng [từ 00:00 ngày đầu, 00:00 ngày sau ngày cuối) dạng ISO UTC cho API. */
export function rangeToIso(from: Ymd, to: Ymd): { from: string; to: string } | undefined {
  const a = parseYmd(from)
  const b = parseYmd(to)
  if (!a || !b || from > to) return undefined
  return { from: vnStartOfDay(a.year, a.month, a.day), to: vnStartOfDay(b.year, b.month, b.day + 1) }
}

/** Bấm một ngày: chưa có điểm đầu (hoặc đã đủ khoảng) thì đặt điểm đầu mới; có điểm đầu thì chốt điểm cuối (đảo nếu bấm trước điểm đầu). */
export function pickDate(current: DateRange, day: Ymd): DateRange {
  if (!current.from || current.to) return { from: day }
  return day < current.from ? { from: day, to: current.from } : { from: current.from, to: day }
}

export type Cell = { ymd: Ymd; day: number; inMonth: boolean }

/** Lưới tháng, thứ Hai đứng đầu tuần, luôn đủ tuần (6 hàng tối đa). month: 1–12. */
export function monthGrid(year: number, month: number): Cell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const total = Math.ceil((lead + daysIn) / 7) * 7
  const cells: Cell[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - lead + i))
    cells.push({
      ymd: toYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1,
    })
  }
  const weeks: Cell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** "21/11" hoặc "21/11/2026" khi khác năm hiện tại. */
export function labelYmd(v: Ymd, currentYear: number): string {
  const p = parseYmd(v)
  if (!p) return ''
  const dm = `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`
  return p.year === currentYear ? dm : `${dm}/${p.year}`
}
