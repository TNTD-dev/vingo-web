import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { Order, Ticket } from '@/api/generated/model'

/*
 * Mock vé của tôi (Figma B5, B6, B11). Vé được phát hành khi đơn chuyển PAID (xem orders.ts) kèm vài vé có sẵn.
 * Ảnh QR là SVG giả sinh từ mã vé, không quét được; backend thật trả PNG.
 */

export const tickets = new Map<string, Ticket>()

/** Phát hành vé cho một đơn đã thanh toán, mỗi ghế (hoặc mỗi vé đứng) một vé. */
export function issueTickets(order: Order) {
  let n = 0
  for (const item of order.items ?? []) {
    for (let i = 0; i < (item.quantity ?? 1); i++) {
      const id = crypto.randomUUID()
      n += 1
      tickets.set(id, {
        id,
        code: `${order.code}-${n}`,
        status: 'ISSUED',
        qr_token: `qr.${id}`,
        order_code: order.code,
        event: order.event,
        showtime: order.showtime,
        venue: order.showtime?.venue,
        zone: item.zone,
        row: item.row ?? null,
        number: item.number ?? null,
        tier: item.tier,
        used_at: null,
      })
    }
  }
}

function fakeQr(seed: string): string {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const n = 21
  let cells = ''
  const corners = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      h = Math.imul(h ^ (x * 31 + y), 16777619)
      let on = (h >>> 7) % 2 === 0
      for (const [ox, oy] of corners) {
        const lx = x - ox
        const ly = y - oy
        if (lx < -1 || ly < -1 || lx > 7 || ly > 7) continue
        const inside = lx >= 0 && ly >= 0 && lx <= 6 && ly <= 6
        on = inside && (lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4))
      }
      if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#1a1a1a">${cells}</g></svg>`
}

const problem = (status: number, code: string, title: string) => HttpResponse.json({ title, status, code }, { status })

export const ticketHandlers = [
  http.get(`*${API_BASE}/tickets`, ({ request }) => {
    const url = new URL(request.url)
    const when = url.searchParams.get('when')
    const status = url.searchParams.get('status')
    const now = Date.now()
    const data = [...tickets.values()].filter((t) => {
      if (status && t.status !== status) return false
      const start = new Date(t.showtime?.starts_at ?? 0).getTime()
      if (when === 'upcoming') return start >= now && t.status !== 'USED'
      if (when === 'past') return start < now || t.status === 'USED'
      return true
    })
    return HttpResponse.json({ data, next_cursor: null })
  }),
  http.get(`*${API_BASE}/tickets/:ticketId/qr.png`, ({ params }) => {
    if (!tickets.has(String(params.ticketId))) return problem(404, 'NOT_FOUND', 'Không tìm thấy vé')
    return new HttpResponse(fakeQr(String(params.ticketId)), { headers: { 'Content-Type': 'image/svg+xml' } })
  }),
  http.post(`*${API_BASE}/tickets/:ticketId/resend`, ({ params }) =>
    tickets.has(String(params.ticketId))
      ? new HttpResponse(null, { status: 204 })
      : problem(404, 'NOT_FOUND', 'Không tìm thấy vé'),
  ),
  http.get(`*${API_BASE}/tickets/:ticketId`, ({ params }) => {
    const t = tickets.get(String(params.ticketId))
    return t ? HttpResponse.json<Ticket>(t) : problem(404, 'NOT_FOUND', 'Không tìm thấy vé')
  }),
]
