const TZ = 'Asia/Ho_Chi_Minh'
/** Việt Nam không có giờ mùa hè: luôn UTC+7. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function vnParts(iso: string) {
  return Object.fromEntries(dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

/** API trả ISO 8601 UTC; hiển thị theo giờ Việt Nam. "2026-11-14T12:30:00Z" → "19:30 14/11/2026" */
export function formatDateTime(iso: string): string {
  const parts = vnParts(iso)
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Ngày lịch Việt Nam của một thời điểm. */
export function vnDate(at: Date): { year: number; month: number; day: number; weekday: number } {
  const local = new Date(at.getTime() + VN_OFFSET_MS)
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  }
}

/** 00:00 giờ Việt Nam của ngày (năm, tháng 1–12, ngày) → ISO UTC. Tháng/ngày tràn tự cuộn (ngày 32 → sang tháng sau). */
export function vnStartOfDay(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS).toISOString()
}

/** Giờ suất diễn trên thẻ sự kiện. "2026-11-21T10:00:00Z" → "17:00 · T7, 21/11/2026" */
export function formatEventDateTime(iso: string): string {
  const parts = vnParts(iso)
  const weekday = WEEKDAY[vnDate(new Date(iso)).weekday]
  return `${parts.hour}:${parts.minute} · ${weekday}, ${parts.day}/${parts.month}/${parts.year}`
}

/**
 * Khoảng ngày [from, to) theo giờ Việt Nam, `to` là mốc loại trừ (00:00 ngày sau ngày cuối).
 * Cùng năm: "21/11 – 23/11/2026"; khác năm: "28/12/2026 – 03/01/2027".
 */
export function formatDateRange(fromIso: string, toIsoExclusive: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const a = vnDate(new Date(fromIso))
  const b = vnDate(new Date(new Date(toIsoExclusive).getTime() - DAY_MS))
  const right = `${pad(b.day)}/${pad(b.month)}/${b.year}`
  const left = a.year === b.year ? `${pad(a.day)}/${pad(a.month)}` : `${pad(a.day)}/${pad(a.month)}/${a.year}`
  return `${left} – ${right}`
}

/** Khoảng giờ của một suất: "17:00 – 19:00" (giờ Việt Nam). Thiếu giờ kết thúc thì chỉ ghi giờ bắt đầu. */
export function formatTimeRange(startIso: string, endIso?: string): string {
  const hm = (iso: string) => {
    const p = vnParts(iso)
    return `${p.hour}:${p.minute}`
  }
  return endIso ? `${hm(startIso)} – ${hm(endIso)}` : hm(startIso)
}

/** Ô ngày trên thẻ suất diễn: "2026-11-21T10:00:00Z" → { weekday: "T7", day: "21", month: "THG 11" } */
export function showtimeDayBox(iso: string): { weekday: string; day: string; month: string } {
  const d = vnDate(new Date(iso))
  return { weekday: WEEKDAY[d.weekday], day: String(d.day), month: `THG ${d.month}` }
}

/** "22/11, 10:00" — mốc mở bán. */
export function formatDayMonthTime(iso: string): string {
  const p = vnParts(iso)
  return `${p.day}/${p.month}, ${p.hour}:${p.minute}`
}

/** "T7 21/11" — ô NGÀY trên vé. */
export function formatWeekdayDayMonth(iso: string): string {
  const p = vnParts(iso)
  return `${WEEKDAY[vnDate(new Date(iso)).weekday]} ${p.day}/${p.month}`
}

/** "17:34" — giờ Việt Nam. */
export function formatHm(iso: string): string {
  const p = vnParts(iso)
  return `${p.hour}:${p.minute}`
}

/** "17:00 T7 21/11" — dòng phụ tiêu đề màn chọn ghế. */
export function formatShortDateTime(iso: string): string {
  const p = vnParts(iso)
  return `${p.hour}:${p.minute} ${WEEKDAY[vnDate(new Date(iso)).weekday]} ${p.day}/${p.month}`
}

/** "21/11 17:31" — ngày giờ đặt đơn (giờ Việt Nam). */
export function formatDayMonthHm(iso: string): string {
  const p = vnParts(iso)
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`
}
