import type { Ticket } from '@/api/generated/model'

/** Nhãn ghế trên vé: "B-14", vé đứng thì "Đứng". */
export function seatLabel(t: Pick<Ticket, 'row' | 'number'>) {
  return t.row && t.number != null ? `${t.row}-${t.number}` : 'Đứng'
}
