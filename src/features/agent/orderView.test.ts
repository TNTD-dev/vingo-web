import { describe, expect, it } from 'vitest'

import { chatReducer, initialChatState, type ChatAction } from '@/features/chat/chatReducer'

import { deriveOrderPanel } from './orderView'

const run = (actions: ChatAction[]) => actions.reduce(chatReducer, initialChatState)
const block = (type: string, payload: Record<string, unknown>): ChatAction => ({
  type: 'event',
  event: { type: 'chat.block', data: { message_id: 'm1', block: { id: type, type, payload } } },
})
const status = (v: ReturnType<typeof deriveOrderPanel>) => Object.fromEntries(v.steps.map((s) => [s.code, s.status]))

describe('deriveOrderPanel', () => {
  it('chưa có gì: nháp, chưa chọn sự kiện', () => {
    const v = deriveOrderPanel(initialChatState)
    expect(v).toMatchObject({ stage: 'search', status: 'NHÁP' })
    expect(v.order.eventTitle).toBeUndefined()
  })

  it('có danh sách sự kiện: bước tìm xong, chờ bạn chọn trận', () => {
    const v = deriveOrderPanel(run([block('EventList', { events: [{ title: 'A' }] })]))
    expect(v.stage).toBe('select')
    expect(status(v)).toMatchObject({ SEARCH_EVENTS: 'done', GET_SEATMAP: 'active', CREATE_HOLD: 'todo' })
    expect(v.steps[1]?.title).toBe('Chờ bạn chọn trận')
  })

  it('có ConfirmAction đang chờ: chờ xác nhận, lấy đơn và tiền từ payload (không tự cộng)', () => {
    const v = deriveOrderPanel(
      run([
        block('ConfirmAction', {
          action_id: 'a1',
          kind: 'CREATE_HOLD',
          order: { event_title: 'HAGL vs Hà Nội FC', seats: ['J-21', 'J-22'], total_amount: 1_200_000 },
        }),
      ]),
    )
    expect(v).toMatchObject({ stage: 'confirm', status: 'CHỜ XÁC NHẬN' })
    expect(v.order).toMatchObject({ eventTitle: 'HAGL vs Hà Nội FC', seats: ['J-21', 'J-22'], totalAmount: 1_200_000 })
    expect(status(v)).toMatchObject({ GET_SEATMAP: 'done', CREATE_HOLD: 'active' })
  })

  it('có QR chưa trả: PENDING; có order.paid: PAID và đủ các bước', () => {
    const qr = run([block('PaymentQR', { total_amount: 1_200_000, expires_at: '2030-01-01T00:00:00Z' })])
    expect(deriveOrderPanel(qr)).toMatchObject({ stage: 'payment', status: 'PENDING' })
    const paid = chatReducer(qr, { type: 'event', event: { type: 'order.paid', data: {} } })
    const v = deriveOrderPanel(paid)
    expect(v).toMatchObject({ stage: 'paid', status: 'PAID' })
    expect(v.steps.every((s) => s.status === 'done' || s.code === 'SEARCH_EVENTS' || s.code === 'GET_SEATMAP')).toBe(
      true,
    )
    expect(status(v).TICKET_ISSUED ?? status(v)['TICKET.ISSUED']).toBe('done')
  })

  it('mang ngữ cảnh từ trang chọn ghế: bước đầu là nhận ngữ cảnh, đơn có ghế đã chọn', () => {
    const v = deriveOrderPanel(
      run([{ type: 'context', id: 'c', label: 'x', info: { eventTitle: 'HAGL', zone: 'B', seats: ['D-14', 'D-15'] } }]),
    )
    expect(v.steps[0]).toMatchObject({ code: 'SHOWTIME · ZONE · GHẾ', status: 'done' })
    expect(v.order).toMatchObject({ eventTitle: 'HAGL', zone: 'B', seats: ['D-14', 'D-15'] })
  })
})
