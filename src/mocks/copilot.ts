import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { ChatBlock, ChatMessage } from '@/api/generated/model'

import { emit } from './sse'

/**
 * Mock Admin Copilot (kịch bản Figma C2–C5) cho `npm run dev:mock`. Chỉ nhận hội thoại tạo từ trang /admin/copilot
 * (đọc referrer, vì contract tạo hội thoại theo vai trò token chứ không có tham số agent); còn lại để mock buyer xử lý.
 * Quy ước web ↔ agent giả định (xem docs/agent-mode-notes.md): block mở rộng chọn bằng `payload.view`, sửa trên block
 * gửi `block_event` (review.change / showtime.edit / seatmap.select) và agent trả ConfirmAction mới.
 * Nội dung chỉ để dựng UI; kịch bản thật do agent quyết định.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const store = new Map<string, ChatMessage[]>()
let seq = 0
let activeConv = ''
const vnd = new Intl.NumberFormat('vi-VN')
const money = (n: number) => `${vnd.format(n)}₫`

const isAdminConv = (id: string) => store.has(id)

function remember(role: 'user' | 'assistant', text: string, blocks: ChatBlock[] = []) {
  const list = store.get(activeConv) ?? []
  list.push({ id: crypto.randomUUID(), role, text, blocks, created_at: new Date().toISOString() })
  store.set(activeConv, list)
}

async function reply(text: string, blocks: ChatBlock[] = [], quickReplies?: string[]) {
  const base = { message_id: `cp-m-${++seq}`, conversation_id: activeConv }
  await sleep(700)
  const words = text.split(' ')
  for (let i = 0; i < words.length; i += 3) {
    emit('chat.delta', { ...base, text: words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '') })
    await sleep(80)
  }
  for (const b of blocks) {
    await sleep(300)
    emit('chat.block', { ...base, block: b })
  }
  emit('chat.done', { ...base, quick_replies: quickReplies })
  remember('assistant', text, blocks)
}

const block = (type: ChatBlock['type'], payload: Record<string, unknown>): ChatBlock => ({
  id: `cp-b-${++seq}`,
  type,
  payload,
})

// ------------------------------------------------------------------ C2 · báo cáo
const reportBlocks = (): ChatBlock[] => [
  block('StatCards', {
    source: 'REVENUE · FROM=05/11 · GROUP_BY=ZONE',
    task_title: 'Báo cáo doanh thu tuần',
    admin_url: '/admin/reports',
    cards: [
      {
        label: 'DOANH THU TUẦN',
        value_label: '1,94 tỷ ₫',
        delta: { label: '+12%', tone: 'success' },
        compare: 'so với tuần trước',
      },
      { label: 'VÉ BÁN', value_label: '4.812', delta: { label: '+9%', tone: 'success' }, compare: 'so với tuần trước' },
      {
        label: 'LẤP ĐẦY KHU C',
        value_label: '48%',
        delta: { label: '−6 ĐIỂM', tone: 'danger' },
        compare: 'so với tuần trước',
      },
    ],
  }),
  block('Chart', {
    title: 'DOANH THU THEO KHU · 7 NGÀY',
    unit_label: 'Triệu ₫',
    categories: [
      { label: 'Khu A', values: [310, 360, 420] },
      { label: 'Khu B', values: [240, 270, 340] },
      { label: 'Khu C', values: [150, 140, 105], tone: 'danger' },
      { label: 'Khu D', values: [190, 210, 230] },
    ],
  }),
]

// ------------------------------------------------------------------ C3 · duyệt hàng loạt
type MockOrder = { id: string; code: string; reason: string; ok: boolean; check: string; amount: number }
const ORDERS: MockOrder[] = [
  {
    id: 'o-23802',
    code: '#VG-23802',
    reason: 'Trả sau hạn 4 phút',
    ok: true,
    check: 'Ghế trống · tiền khớp',
    amount: 500_000,
  },
  {
    id: 'o-23701',
    code: '#VG-23701',
    reason: 'Trả sau khi huỷ',
    ok: true,
    check: 'Ghế trống · tiền khớp',
    amount: 400_000,
  },
  {
    id: 'o-23655',
    code: '#VG-23655',
    reason: 'Trả sau hạn 2 phút',
    ok: true,
    check: 'Ghế trống · tiền khớp',
    amount: 400_000,
  },
  { id: 'o-23744', code: '#VG-23744', reason: 'Lệch số tiền', ok: false, check: 'Thiếu 400.000₫', amount: 600_000 },
]

const tableBlock = (): ChatBlock =>
  block('OrderSummary', {
    view: 'review_table',
    orders: ORDERS.map((o) => ({
      order_id: o.id,
      code: o.code,
      reason: o.reason,
      check: { label: o.check, tone: o.ok ? 'success' : 'danger' },
      proposal: o.ok ? 'ISSUE_TICKETS' : 'SKIP',
      status_label: o.ok ? 'Sẵn sàng' : 'Cần bạn xem',
      status_tone: o.ok ? 'success' : 'warning',
      tickets: 2,
    })),
  })

function reviewConfirm(pickedIds: string[]): ChatBlock {
  const picked = ORDERS.filter((o) => pickedIds.includes(o.id))
  const rest = ORDERS.filter((o) => !pickedIds.includes(o.id))
  return block('ConfirmAction', {
    action_id: `cp-act-${++seq}`,
    kind: 'RESOLVE_REVIEW',
    title: picked.length ? `Phát hành vé cho ${picked.length} đơn` : 'Chưa chọn đơn nào',
    task_title: `Xử lý ${ORDERS.length} đơn NEEDS_REVIEW`,
    admin_url: '/admin/orders',
    summary_rows: [
      { label: 'Đề xuất phát hành', value: `${picked.length} đơn` },
      { label: 'Cần bạn xem', value: `${rest.length} đơn` },
      { label: 'Idempotency', value: 'mỗi đơn 1 key' },
    ],
    rows: [
      { label: 'Hành động', value: `RESOLVE_REVIEW · ISSUE_TICKETS × ${picked.length}` },
      { label: 'Số vé', value: `${picked.length * 2} vé` },
      { label: 'Tổng tiền', value: money(picked.reduce((s, o) => s + o.amount, 0)), strong: true },
      { label: 'Còn lại', value: rest.length ? `${rest.map((o) => o.code).join(', ')} · chờ bạn` : 'Không còn đơn' },
    ],
    confirm_label: `Duyệt ${picked.length} đơn`,
    reject_label: 'Từ chối',
  })
}

// ------------------------------------------------------------------ C4 · tạo suất
type Fields = Record<string, string>
const FORM_DEFAULT: Fields = {
  start: '17:00 · T7 28/11/2026',
  end: '19:00 · T7 28/11/2026',
  layout: 'Sân chính · layout v4',
  sale: '21/11 10:00 → 28/11 15:00',
}
const FORM_LABEL: Record<string, string> = { start: 'Bắt đầu', end: 'Kết thúc', layout: 'Sơ đồ / Hall', sale: 'Mở bán' }

const formBlock = (): ChatBlock =>
  block('EventList', {
    view: 'showtime_form',
    source: 'V12',
    title: 'Suất mới · HAGL vs Nam Định',
    status_label: 'DRAFT',
    fields: Object.entries(FORM_DEFAULT).map(([key, value]) => ({
      key,
      label: FORM_LABEL[key],
      value,
      by_agent: true,
    })),
    price_title: 'Giá theo khu (copy vòng 12, giảm khu C theo báo cáo)',
    prices: [
      { key: 'a', label: 'Khu A', value: '1.200.000đ' },
      { key: 'b', label: 'Khu B', value: '600.000đ' },
      { key: 'c', label: 'Khu C', value: '220.000đ (−12%)', changed: true },
      { key: 'd', label: 'Khu D', value: '120.000đ' },
    ],
  })

function showtimeConfirm(f: Fields): ChatBlock {
  return block('ConfirmAction', {
    action_id: `cp-act-${++seq}`,
    kind: 'CREATE_SHOWTIME',
    title: 'Tạo & lên lịch suất 28/11',
    task_title: 'Tạo suất HAGL vs Nam Định',
    admin_url: '/admin/events',
    summary_rows: [
      { label: 'Sự kiện', value: 'V.League 2026 · V13' },
      { label: 'Trạng thái sau khi tạo', value: 'SCHEDULED' },
      { label: 'Sơ đồ', value: f.layout ?? '' },
    ],
    rows: [
      { label: 'Hành động', value: 'CREATE_SHOWTIME · SCHEDULED' },
      { label: 'Bắt đầu', value: f.start ?? '' },
      { label: 'Mở bán', value: f.sale ?? '' },
      { label: 'Sơ đồ', value: 'v4 · 1.240 ghế', strong: true },
      { label: 'Giá', value: '4 khu (khu C −12%)' },
    ],
    confirm_label: 'Tạo suất',
    reject_label: 'Từ chối',
  })
}

// ------------------------------------------------------------------ C5 · khoá ghế
const SOLD = new Set(['A-01', 'A-16', 'B-07', 'B-13', 'C-03', 'C-08', 'C-14', 'D-02', 'D-10', 'D-15'])
const seatRows = ['A', 'B', 'C', 'D'].map((r) =>
  Array.from({ length: 16 }, (_, i) => {
    const id = `${r}-${String(i + 1).padStart(2, '0')}`
    return { id, label: id, state: SOLD.has(id) ? 'sold' : 'available' }
  }),
)
const PROPOSED = ['A-06', 'A-07', 'A-08', 'A-09', 'A-10', 'A-11']

const lockBlock = (): ChatBlock =>
  block('SeatMap', {
    view: 'seat_lock',
    zone_label: 'Khu A · có mái · HAGL vs HN 21/11',
    row_names: ['A', 'B', 'C', 'D'],
    rows: seatRows,
    selected: PROPOSED,
  })

function lockConfirm(seats: string[]): ChatBlock {
  // Ghế đã bán luôn bị bỏ qua, kể cả khi client gửi lên.
  const ids = seats.filter((s) => !SOLD.has(s)).sort()
  const range = ids.length > 3 ? `${ids[0]} → ${ids.at(-1)}` : ids.join(', ')
  return block('ConfirmAction', {
    action_id: `cp-act-${++seq}`,
    kind: 'BLOCK_SEATS',
    title: ids.length ? `Khoá ${range}` : 'Chưa chọn ghế nào',
    task_title: 'Khoá ghế khách mời',
    admin_url: '/admin/events',
    summary_rows: [
      { label: 'Suất', value: 'HAGL vs HN · 21/11' },
      { label: 'Ghế', value: range || '—' },
      { label: 'Lý do', value: 'Khách mời CLB' },
    ],
    rows: [
      { label: 'Hành động', value: `BLOCK_SEATS · ${ids.length} ghế` },
      { label: 'Suất', value: 'HAGL vs HN · 21/11' },
      { label: 'Ảnh hưởng', value: 'Không đơn nào', strong: true },
      { label: 'Ghi chú', value: 'Khách mời CLB' },
    ],
    confirm_label: `Khoá ${ids.length} ghế`,
    reject_label: 'Từ chối',
  })
}

// ------------------------------------------------------------------ điều phối
const actions = new Map<string, string>() // action_id → kind
const noteActions = (b: ChatBlock) => {
  const p = b.payload as { action_id?: string; kind?: string } | undefined
  if (p?.action_id && p.kind) actions.set(p.action_id, p.kind)
  return b
}

const has = (t: string, ...words: string[]) => words.some((w) => t.toLowerCase().includes(w))

async function onUserTurn(
  text: string | undefined,
  ev: { type?: string; payload?: Record<string, unknown> } | undefined,
) {
  if (ev?.type === 'review.change') {
    const ids = ((ev.payload?.decisions as { order_id: string }[] | undefined) ?? []).map((d) => d.order_id)
    await reply('Mình đã tính lại theo lựa chọn của bạn, bạn xác nhận giúp mình nhé.', [
      noteActions(reviewConfirm(ids)),
    ])
    return
  }
  if (ev?.type === 'showtime.edit') {
    const sent = (ev.payload?.fields as Fields | undefined) ?? FORM_DEFAULT
    await reply('Mình đã cập nhật suất theo chỉnh sửa của bạn. Bạn kiểm tra lại rồi duyệt nhé.', [
      noteActions(showtimeConfirm({ ...FORM_DEFAULT, ...sent })),
    ])
    return
  }
  if (ev?.type === 'seatmap.select') {
    const seats = (ev.payload?.seats as string[] | undefined) ?? []
    await reply('Mình đã cập nhật danh sách ghế khoá (ghế đã bán luôn được bỏ qua). Bạn xác nhận giúp mình nhé.', [
      noteActions(lockConfirm(seats)),
    ])
    return
  }
  const t = text ?? ''
  if (has(t, 'doanh thu', 'báo cáo')) {
    await reply(
      'Tuần này đạt 1,94 tỷ ₫ (+12%). Khu A và B tăng đều; khu C giảm 3 tuần liền và đang lấp 48% — đó là khu bán chậm nhất.',
      reportBlocks(),
      ['Giảm 15% khu C cho trận 29/11?', 'Xuất CSV báo cáo', 'So với cùng kỳ tháng trước'],
    )
  } else if (has(t, 'needs_review', 'duyệt', 'đơn')) {
    await reply(
      'Mình đã đọc 4 đơn NEEDS_REVIEW và kiểm tra ghế, số tiền. 3 đơn trả sau hạn nhưng ghế còn trống, tiền khớp — đề xuất phát hành vé. Đơn #VG-23744 lệch số tiền, bạn quyết định.',
      [tableBlock(), noteActions(reviewConfirm(ORDERS.filter((o) => o.ok).map((o) => o.id)))],
    )
  } else if (has(t, 'suất', 'vòng')) {
    await reply(
      'Mình sao chép cấu hình từ vòng 12: giờ, sơ đồ, giá theo khu; khu C giảm 12% vì đang bán chậm. Kiểm tra lại rồi duyệt nhé.',
      [formBlock(), noteActions(showtimeConfirm(FORM_DEFAULT))],
    )
  } else if (has(t, 'khoá', 'khóa', 'ghế')) {
    await reply('Hàng A còn 6 ghế liền nhau ở giữa: A-06 → A-11. Ghế đã bán sẽ không bị ảnh hưởng.', [
      lockBlock(),
      noteActions(lockConfirm(PROPOSED)),
    ])
  } else {
    await reply(
      'Mình có thể duyệt đơn NEEDS_REVIEW, tạo suất, khoá ghế hoặc báo cáo doanh thu. Bạn muốn làm việc nào?',
      [],
      ['Xử lý 4 đơn NEEDS_REVIEW', 'Doanh thu tuần này theo khu'],
    )
  }
}

async function afterConfirm(kind: string | undefined) {
  await sleep(500)
  if (kind === 'RESOLVE_REVIEW') {
    await reply(
      'Đã phát hành vé và gửi cho khách. Đơn còn lại vẫn chờ bạn xem, mình chưa động tới.',
      [],
      ['Xem đơn #VG-23744'],
    )
  } else if (kind === 'CREATE_SHOWTIME') {
    await reply('Đã tạo suất 28/11, trạng thái SCHEDULED, mở bán 21/11 10:00. Thao tác đã ghi vào Nhật ký audit.')
  } else if (kind === 'BLOCK_SEATS') {
    await reply('Đã khoá ghế, không đơn nào bị ảnh hưởng. Thao tác đã ghi vào Nhật ký audit.')
  } else {
    await reply('Đã thực hiện xong.')
  }
}

export const copilotHandlers = [
  // Màn chào Copilot đếm đơn NEEDS_REVIEW: trả đúng 4 đơn của kịch bản; lọc khác thì để handler Orval sinh xử lý.
  http.get(`*${API_BASE}/admin/orders`, ({ request }) => {
    if (new URL(request.url).searchParams.get('status') !== 'NEEDS_REVIEW') return undefined
    return HttpResponse.json({
      data: ORDERS.map((o) => ({ id: o.id, code: o.code, status: 'NEEDS_REVIEW', total_amount: o.amount })),
      next_cursor: null,
    })
  }),
  http.post(`*${API_BASE}/chat/conversations`, ({ request }) => {
    // Chỉ nhận khi gọi từ trang Copilot; mock buyer xử lý phần còn lại.
    if (!request.referrer.includes('/admin/copilot')) return undefined
    activeConv = crypto.randomUUID()
    store.set(activeConv, [])
    return HttpResponse.json(
      { id: activeConv, agent: 'ADMIN_COPILOT', created_at: new Date().toISOString() },
      { status: 201 },
    )
  }),
  http.get(`*${API_BASE}/chat/conversations/:id/messages`, ({ params }) => {
    const id = String(params.id)
    return isAdminConv(id) ? HttpResponse.json({ data: store.get(id), next_cursor: null }) : undefined
  }),
  http.post(`*${API_BASE}/chat/conversations/:id/messages`, async ({ request, params }) => {
    const id = String(params.id)
    if (!isAdminConv(id)) return undefined
    activeConv = id
    const body = (await request.json()) as {
      text?: string
      block_event?: { type?: string; payload?: Record<string, unknown> }
    }
    if (body.text) remember('user', body.text)
    void onUserTurn(body.text, body.block_event)
    return HttpResponse.json({ message_id: crypto.randomUUID() }, { status: 202 })
  }),
  http.post(`*${API_BASE}/chat/actions/:id/confirm`, ({ params }) => {
    const id = String(params.id)
    if (!actions.has(id)) return undefined
    void afterConfirm(actions.get(id))
    return new HttpResponse(null, { status: 200 })
  }),
  http.post(`*${API_BASE}/chat/actions/:id/reject`, ({ params }) => {
    if (!actions.has(String(params.id))) return undefined
    void reply('Ok, mình chưa làm gì cả. Bạn muốn chỉnh gì thì nói mình nhé.')
    return new HttpResponse(null, { status: 204 })
  }),
]
