import type { Ticket } from '@/api/generated/model'
import { seatLabel } from '@/design/ticket/seat'

export interface TicketGroup {
  key: string
  tickets: Ticket[]
}

/** Gom các vé cùng một suất diễn thành một thẻ (Figma B6: "2 VÉ", "Khu B · B-14, B-15"). */
export function groupTickets(tickets: Ticket[]): TicketGroup[] {
  const map = new Map<string, Ticket[]>()
  for (const t of tickets) {
    const key = `${t.event?.id ?? ''}:${t.showtime?.id ?? t.id}`
    map.set(key, [...(map.get(key) ?? []), t])
  }
  return [...map.entries()].map(([key, list]) => ({ key, tickets: list }))
}

/** "Khu B · B-14, B-15"; nhiều khu thì ngăn bằng " · ". */
export function seatSummary(tickets: Ticket[]): string {
  const byZone = new Map<string, string[]>()
  for (const t of tickets) byZone.set(t.zone ?? '', [...(byZone.get(t.zone ?? '') ?? []), seatLabel(t)])
  return [...byZone.entries()].map(([zone, seats]) => `Khu ${zone} · ${seats.join(', ')}`).join(' · ')
}
