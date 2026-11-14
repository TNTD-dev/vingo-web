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

/** "Khu B · B-14, B-15"; vé đứng gộp thành "3 vé đứng"; nhiều khu thì ngăn bằng " · ". */
export function seatSummary(tickets: Ticket[]): string {
  const byZone = new Map<string, Ticket[]>()
  for (const t of tickets) byZone.set(t.zone ?? '', [...(byZone.get(t.zone ?? '') ?? []), t])
  return [...byZone.entries()]
    .map(([zone, list]) => {
      const seated = list.filter((t) => t.row && t.number != null).map(seatLabel)
      const standing = list.length - seated.length
      const parts = [...seated, ...(standing > 0 ? [standing === 1 ? 'Đứng' : `${standing} vé đứng`] : [])]
      return `Khu ${zone} · ${parts.join(', ')}`
    })
    .join(' · ')
}
