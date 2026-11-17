import type { Ticket } from '@/api/generated/model'

/** "Khu A · Hàng A · Ghế 15"; khu đứng không có hàng/ghế nên ghi "vé tự do". */
export function seatText(t: Pick<Ticket, 'zone' | 'row' | 'number'>): string {
  if (t.row) return `${t.zone} · Hàng ${t.row} · Ghế ${t.number}`
  return `${t.zone ?? '—'} · vé tự do`
}
