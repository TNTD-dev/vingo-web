import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { ChatBlock, ChatMessage } from '@/api/generated/model'

import { emit } from './sse'

/**
 * Mock agent mua vé (kịch bản Figma M2→M5) cho `npm run dev:mock`: tìm sự kiện → chọn trận → sơ đồ ghế
 * + ConfirmAction → (bấm đồng ý) giữ ghế + block thanh toán VNPay → tự "thanh toán" sau vài giây → vé.
 * Nội dung chỉ để dựng UI. Kịch bản thật do vingo-agent quyết định.
 */
const PAY_AFTER_MS = 15_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const store = new Map<string, ChatMessage[]>()
let seq = 0
let activeConv = ''

const rowLabels = ['J', 'K']
const seatRows = rowLabels.map((r, ri) =>
  Array.from({ length: 10 }, (_, i) => {
    const n = 17 + i
    const id = `${r}-${n}`
    const sold = (ri * 3 + i) % 4 === 0
    const held = !sold && (ri + i) % 7 === 0
    return { id, label: id, state: sold ? 'sold' : held ? 'held' : 'available' }
  }),
)

const eventsBlock = (): ChatBlock => ({
  id: `b-${++seq}`,
  type: 'EventList',
  payload: {
    events: [
      {
        event_id: 'ev-1',
        showtime_id: 'st-1',
        title: 'HAGL vs Hà Nội FC',
        subtitle: '17:00 T7 21/11 · SVĐ Thống Nhất',
        badge: { label: '9 CẶP GHẾ', tone: 'success' },
        price_line: 'Khu B · 600.000đ',
        recommended: true,
      },
      {
        event_id: 'ev-2',
        title: 'TP.HCM vs Bình Dương',
        subtitle: '19:00 T7 21/11 · SVĐ Thống Nhất',
        badge: { label: 'SALES CLOSED', tone: 'neutral' },
        price_line: 'Khu B · 250.000đ',
        selectable: false,
      },
      {
        event_id: 'ev-3',
        title: 'HAGL vs Nam Định',
        subtitle: '17:00 CN 29/11 · SVĐ Pleiku',
        badge: { label: 'SCHEDULED', tone: 'info' },
        price_line: 'Mở bán 22/11',
        selectable: false,
      },
    ],
  },
})

const seatMapBlock = (): ChatBlock => ({
  id: `b-${++seq}`,
  type: 'SeatMap',
  payload: {
    zone_label: 'KHU B1',
    row_label: 'HÀNG 2',
    price_label: '600.000đ',
    venue_name: 'SVĐ Thiên Trường',
    remaining_label: 'Khu B1 · còn 214 ghế',
    full_map_url: '/events/ev-1/showtimes/st-1/seats',
    rows: seatRows,
    suggested: ['J-21', 'J-22'],
  },
})

const confirmBlock = (actionId: string): ChatBlock => ({
  id: `b-${++seq}`,
  type: 'ConfirmAction',
  payload: {
    action_id: actionId,
    kind: 'CREATE_HOLD',
    title: 'Giữ J-21, J-22 · khu B1',
    confirm_label: 'Đồng ý giữ ghế',
    reject_label: 'Từ chối',
    rows: [
      { label: 'Suất', value: 'HAGL vs Hà Nội · 17:00 T7 21/11' },
      { label: 'Đơn giá', value: '600.000đ × 2' },
      { label: 'Tổng', value: '1.200.000đ', strong: true },
      { label: 'Giữ chỗ', value: '10 phút sau khi đồng ý' },
      { label: 'Sau đó', value: 'Chuyển bạn sang cổng VNPay để thanh toán' },
    ],
    order: {
      event_title: 'HAGL vs Hà Nội FC',
      subtitle: '17:00 · T7 21/11 · SVĐ Thống Nhất',
      zone: 'B1 · 600.000đ',
      seats: ['J-21', 'J-22'],
      total_amount: 1_200_000,
      full_map_url: '/events/ev-1/showtimes/st-1/seats',
    },
  },
})

function remember(role: 'user' | 'assistant', text: string, blocks: ChatBlock[] = []) {
  const list = store.get(activeConv) ?? []
  list.push({ id: crypto.randomUUID(), role, text, blocks, created_at: new Date().toISOString() })
  store.set(activeConv, list)
}

/** Một lượt trả lời: stream chữ theo cụm, rồi block, rồi done. */
async function reply(text: string, blocks: ChatBlock[] = [], quickReplies?: string[]) {
  const messageId = `m-${++seq}`
  const base = { message_id: messageId, conversation_id: activeConv }
  await sleep(700)
  const words = text.split(' ')
  for (let i = 0; i < words.length; i += 3) {
    emit('chat.delta', { ...base, text: words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '') })
    await sleep(90)
  }
  for (const b of blocks) {
    await sleep(350)
    emit('chat.block', { ...base, block: b })
  }
  emit('chat.done', { ...base, quick_replies: quickReplies })
  remember('assistant', text, blocks)
}

let step: 'search' | 'seats' | 'hold' = 'search'

async function onUserTurn(text: string | undefined, blockType: string | undefined) {
  if (blockType === 'eventlist.select') {
    step = 'seats'
    await reply(
      'Khu B còn ghế liền nhau. Mình đề xuất J-21, J-22: liền nhau, ngay trục giữa sân. Chạm ghế khác nếu bạn muốn đổi.',
      [seatMapBlock(), confirmBlock(`act-${++seq}`)],
    )
    return
  }
  if (blockType === 'seatmap.select') {
    await reply('Mình cập nhật theo ghế bạn chọn, bạn xác nhận giúp mình nhé.', [confirmBlock(`act-${++seq}`)])
    return
  }
  if (text?.includes('trang chọn ghế')) {
    step = 'seats'
    await reply(
      'Mình thấy bạn đang xem khu B và đã chọn D-14, D-15. Bạn muốn mình tìm 2 ghế đẹp hơn, hay chỉ giữ luôn 2 ghế này?',
      [],
      ['Đúng, 2 ghế liền nhau giữa sân', 'Gần lối ra cho tiện về', 'Đổi sang khu A có mái'],
    )
    return
  }
  if (step === 'seats') {
    step = 'hold'
    await reply('Mình đề xuất J-21, J-22: liền nhau, ngay trục giữa sân.', [
      seatMapBlock(),
      confirmBlock(`act-${++seq}`),
    ])
    return
  }
  await reply('Có 1 trận đang mở bán phù hợp, khu B còn 9 cặp ghế liền nhau. Mình để thêm 2 trận gần đó để bạn so:', [
    eventsBlock(),
  ])
}

async function afterConfirm() {
  const base = { conversation_id: activeConv }
  await sleep(600)
  emit('order.held', { ...base, order_code: 'VG-24117', seats: ['J-21', 'J-22'] })
  const expires = new Date(Date.now() + 10 * 60_000).toISOString()
  const qr: ChatBlock = {
    id: `b-${++seq}`,
    type: 'PaymentQR',
    payload: {
      order_id: 'ord-1',
      order_code: 'VG-24117',
      total_amount: 1_200_000,
      expires_at: expires,
      status: 'PENDING',
      payment_url: 'https://sandbox.vnpayment.vn/',
    },
  }
  await reply(
    'Đã giữ ghế J-21, J-22. Bấm “Thanh toán qua VNPay” để sang cổng thanh toán — vé sẽ tự phát hành khi VNPay xác nhận.',
    [qr],
  )
  await sleep(PAY_AFTER_MS)
  emit('order.paid', { ...base, order_code: 'VG-24117' })
  emit('ticket.issued', { ...base, order_code: 'VG-24117' })
  const ticket = (seat: string): ChatBlock => ({
    id: `b-${++seq}`,
    type: 'Ticket',
    payload: {
      ticket_code: `VG-8F2K-${seat}`,
      order_code: 'VG-8F2K',
      event_title: 'HAGL vs Hà Nội FC',
      date_label: 'T7 21/11',
      time_label: '17:00',
      zone: 'B',
      seat,
      email_masked: 'm***@gmail.com',
      status: 'ISSUED',
    },
  })
  await reply(
    'Xong rồi! 2 vé đã phát hành và gửi về email của bạn. Cổng mở 15:30, khán đài B vào cổng số 3.',
    [ticket('J-21'), ticket('J-22')],
    ['Ghế J-21 vào cổng nào?', 'Thêm vào lịch', 'Chuyển 1 vé cho bạn đi cùng'],
  )
}

export const agentHandlers = [
  http.post(`*${API_BASE}/chat/conversations`, () => {
    activeConv = crypto.randomUUID()
    step = 'search'
    store.set(activeConv, [])
    return HttpResponse.json(
      { id: activeConv, agent: 'BUYER_AGENT', created_at: new Date().toISOString() },
      { status: 201 },
    )
  }),
  http.get(`*${API_BASE}/chat/conversations/:id/messages`, ({ params }) =>
    HttpResponse.json({ data: store.get(String(params.id)) ?? [], next_cursor: null }),
  ),
  http.post(`*${API_BASE}/chat/conversations/:id/messages`, async ({ request, params }) => {
    activeConv = String(params.id)
    const body = (await request.json()) as { text?: string; block_event?: { type?: string } }
    if (body.text) remember('user', body.text)
    void onUserTurn(body.text, body.block_event?.type)
    return HttpResponse.json({ message_id: crypto.randomUUID() }, { status: 202 })
  }),
  http.post(`*${API_BASE}/chat/actions/:id/confirm`, () => {
    void afterConfirm()
    return new HttpResponse(null, { status: 200 })
  }),
  http.post(`*${API_BASE}/chat/actions/:id/reject`, () => {
    void reply('Ok, mình chưa giữ ghế nào cả. Bạn muốn đổi ghế hay xem trận khác?')
    return new HttpResponse(null, { status: 204 })
  }),
]
