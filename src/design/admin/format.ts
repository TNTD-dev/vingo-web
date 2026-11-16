import { vnDate } from '@/lib/time'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEKDAY_LONG = ['CHỦ NHẬT', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY']
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Ngày lịch Việt Nam của một mốc ISO → "2026-11-16". */
export function vnDayKey(iso: string): string {
  const d = vnDate(new Date(iso))
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`
}
/** "14:28" theo giờ Việt Nam. */
export function vnTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
/** "21/11" theo giờ Việt Nam. */
export function vnShortDate(iso: string): string {
  const d = vnDate(new Date(iso))
  return `${pad(d.day)}/${pad(d.month)}`
}
/** "T7 21/11" */
export function vnWeekdayDate(iso: string): string {
  const d = vnDate(new Date(iso))
  return `${WEEKDAY_SHORT[d.weekday]} ${pad(d.day)}/${pad(d.month)}`
}

/** Thời gian đã trôi qua, làm tròn xuống đơn vị lớn nhất: "7 ngày", "5 giờ", "12 phút". */
export function elapsedText(fromIso: string, now: Date): string {
  const ms = now.getTime() - Date.parse(fromIso)
  if (!Number.isFinite(ms) || ms < 60_000) return 'vừa xong'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ`
  return `${Math.floor(hours / 24)} ngày`
}
/** Còn bao lâu tới một mốc tương lai: "6 phút", "2 giờ", "5 ngày"; đã qua thì null. */
export function remainingText(toIso: string, now: Date): string | null {
  const ms = Date.parse(toIso) - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const minutes = Math.max(1, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ`
  return `${Math.floor(hours / 24)} ngày`
}

/** "HÔM NAY · THỨ HAI 16/11", "HÔM QUA · CHỦ NHẬT 15/11", còn lại "THỨ BẢY 14/11". */
export function dayGroupLabel(dayKey: string, todayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const base = `${WEEKDAY_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${pad(d)}/${pad(m)}`
  const diff = Math.round((Date.parse(todayKey) - Date.parse(dayKey)) / 86400000)
  return diff === 0 ? `HÔM NAY · ${base}` : diff === 1 ? `HÔM QUA · ${base}` : base
}
/** Gom theo ngày (giờ VN) giữ nguyên thứ tự gặp đầu tiên; mỗi mục nằm đúng một nhóm. */
export function groupByDay<T>(items: T[], iso: (item: T) => string | undefined): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = []
  for (const item of items) {
    const at = iso(item)
    const key = at && Number.isFinite(Date.parse(at)) ? vnDayKey(at) : ''
    const last = groups.at(-1)
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}
/** Che số điện thoại: "0912345678" → "09•• ••• 678". */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\s/g, '')
  if (digits.length < 6) return '••••'
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`
}
/** Chữ cái đầu cho avatar: "Nguyễn Văn Mua" → "NM". */
export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const letters = parts.length === 1 ? parts[0][0] : parts[0][0] + parts.at(-1)![0]
  return letters.toLocaleUpperCase('vi-VN')
}
