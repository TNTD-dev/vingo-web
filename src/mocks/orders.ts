import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { BuyerProfile, Order, PaymentIntent } from '@/api/generated/model'

import { detailOf, EVENTS } from './events'
import { held } from './holds'
import { issueTickets } from './tickets'

/*
 * Mock đơn hàng, thanh toán và hồ sơ người mua cho màn Thanh toán (Figma B4).
 * Đơn do mock giữ ghế tạo ra. Sau khi tạo thanh toán 15 giây, đơn tự chuyển PAID để thử luồng chờ VNPay.
 */

const orders = new Map<string, Order>()
const paymentStartedAt = new Map<string, number>()
export const PAY_AFTER_MS = 15_000

let profile: BuyerProfile | null = { full_name: 'Nguyễn Minh Anh', phone: '0901234821', email: 'minhanh@gmail.com' }

/** Đơn có sẵn để thử danh sách đơn và vé (Figma B6, B7, B10). */
function seed() {
  const day = 86_400_000
  const mk = (i: number, status: Order['status'], daysAgo: number, qty: number, ev: number) => {
    const event = EVENTS[ev]
    const showtime = detailOf(event).showtimes?.[0]
    const created = Date.now() - daysAgo * day
    const unit = i % 2 ? 600_000 : 300_000
    const order: Order = {
      id: `0193c000-0000-7000-8000-00000000000${i}`,
      code: `VG-${20000 + i * 137}`,
      status,
      event,
      showtime,
      items: Array.from({ length: qty }, (_, k) => ({
        id: crypto.randomUUID(),
        zone: i % 2 ? 'B2' : 'A3',
        row: String.fromCharCode(65 + i),
        number: 10 + k,
        seat_id: crypto.randomUUID(),
        tier: i % 2 ? 'Hạng 2' : 'Hạng 3',
        unit_price: unit,
        quantity: 1,
      })),
      total_amount: unit * qty,
      currency: 'VND',
      expires_at: new Date(created + 10 * 60_000).toISOString(),
      paid_at: status === 'PAID' ? new Date(created + 5 * 60_000).toISOString() : null,
      buyer: profile ?? undefined,
      created_at: new Date(created).toISOString(),
    }
    orders.set(order.id!, order)
    if (status === 'PAID') issueTickets(order)
  }
  mk(1, 'PAID', 2, 2, 0)
  mk(2, 'PAID', 9, 1, 1)
  mk(3, 'EXPIRED', 12, 2, 2)
  mk(4, 'CANCELLED', 20, 1, 3)
  mk(5, 'NEEDS_REVIEW', 1, 3, 0)
}

export function saveOrder(order: Order) {
  orders.set(order.id!, order)
}

const problem = (status: number, code: string, title: string, detail?: string) =>
  HttpResponse.json({ title, status, code, detail }, { status })

/** Đọc đơn kèm các chuyển trạng thái theo thời gian (hết hạn giữ ghế, thanh toán xong). */
function current(id: string): Order | undefined {
  const order = orders.get(id)
  if (!order || order.status !== 'PENDING') return order
  const started = paymentStartedAt.get(id)
  if (started && Date.now() - started >= PAY_AFTER_MS) {
    const paid: Order = { ...order, status: 'PAID', paid_at: new Date().toISOString() }
    orders.set(id, paid)
    issueTickets(paid)
    return paid
  }
  if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
    const expired: Order = { ...order, status: 'EXPIRED' }
    orders.set(id, expired)
    release(expired)
    return expired
  }
  return order
}

function release(order: Order) {
  for (const item of order.items ?? []) if (item.seat_id) held.delete(item.seat_id)
}

seed()

export const orderHandlers = [
  http.get(`*${API_BASE}/orders`, ({ request }) => {
    const status = new URL(request.url).searchParams.get('status')
    const data = [...orders.keys()]
      .map((id) => current(id)!)
      .filter((o) => !status || o.status === status)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    return HttpResponse.json({ data, next_cursor: null })
  }),

  http.get(`*${API_BASE}/orders/:orderId`, ({ params }) => {
    const order = current(String(params.orderId))
    return order ? HttpResponse.json<Order>(order) : problem(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng')
  }),

  http.post(`*${API_BASE}/orders/:orderId/cancel`, ({ params }) => {
    const order = current(String(params.orderId))
    if (!order) return problem(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng')
    if (order.status !== 'PENDING')
      return problem(409, 'ORDER_STATE_INVALID', 'Đơn không còn ở trạng thái chờ thanh toán')
    const cancelled: Order = { ...order, status: 'CANCELLED' }
    orders.set(cancelled.id!, cancelled)
    release(cancelled)
    return HttpResponse.json<Order>(cancelled)
  }),

  http.post(`*${API_BASE}/orders/:orderId/payments`, ({ params, request }) => {
    if (!request.headers.get('Idempotency-Key')) return problem(400, 'VALIDATION_ERROR', 'Thiếu Idempotency-Key')
    const order = current(String(params.orderId))
    if (!order) return problem(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng')
    if (order.status === 'EXPIRED') return problem(409, 'HOLD_EXPIRED', 'Hết hạn giữ ghế')
    if (order.status !== 'PENDING')
      return problem(409, 'ORDER_STATE_INVALID', 'Đơn không còn ở trạng thái chờ thanh toán')
    if (!profile) return problem(409, 'PROFILE_REQUIRED', 'Cần hồ sơ người mua trước khi thanh toán')
    if (!paymentStartedAt.has(order.id!)) paymentStartedAt.set(order.id!, Date.now())
    return HttpResponse.json<PaymentIntent>(
      {
        id: crypto.randomUUID(),
        order_id: order.id,
        txn_ref: `${String(order.id).slice(0, 6).toUpperCase()}-1`,
        amount: order.total_amount,
        status: 'OPEN',
        payment_url: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?mock=1',
        expires_at: order.expires_at,
        last_response_code: null,
      },
      { status: 201 },
    )
  }),

  http.get(`*${API_BASE}/me/profile`, () =>
    profile ? HttpResponse.json<BuyerProfile>(profile) : problem(404, 'NOT_FOUND', 'Chưa có hồ sơ người mua'),
  ),
  http.put(`*${API_BASE}/me/profile`, async ({ request }) => {
    profile = (await request.json()) as BuyerProfile
    return HttpResponse.json<BuyerProfile>(profile)
  }),
]
