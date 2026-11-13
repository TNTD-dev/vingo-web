import { describe, expect, it } from 'vitest'

import { chatReducer, initialChatState, type ChatAction, type ChatItem } from './chatReducer'
import { dedupePills, eventPill, mascotView, pendingConfirmId, stepLines } from './chatView'

const run = (actions: ChatAction[]) => actions.reduce(chatReducer, initialChatState)
const block = (type: string, payload: Record<string, unknown>, id = type) => ({
  type: 'event' as const,
  event: { type: 'chat.block', data: { message_id: 'm1', block: { id, type, payload } } },
})
const confirm = block('ConfirmAction', { action_id: 'act1', kind: 'CREATE_HOLD', title: 'Giữ ghế' })

describe('stepLines', () => {
  it('suy ra dòng tool từ block đã nhận', () => {
    const s = run([block('EventList', { events: [{ title: 'A' }, { title: 'B' }] }), block('PaymentQR', {})])
    const item = s.items[0] as Extract<ChatItem, { kind: 'assistant' }>
    expect(stepLines(item, s.actions).map((l) => `${l.label}|${l.detail}`)).toEqual([
      'SEARCH_EVENTS|2 KẾT QUẢ',
      'CREATE_PAYMENT|VNPAYQR',
    ])
  })

  it('ConfirmAction chỉ thành dòng tool sau khi người dùng đồng ý', () => {
    const s = run([confirm])
    const item = s.items[0] as Extract<ChatItem, { kind: 'assistant' }>
    expect(stepLines(item, s.actions)).toHaveLength(0)
    expect(stepLines(item, { act1: 'confirmed' })[0]).toMatchObject({ label: 'CREATE_HOLD', detail: 'OK' })
  })
})

describe('pendingConfirmId', () => {
  it('trả action đang chờ, hết khi đã đồng ý hoặc từ chối', () => {
    const s = run([confirm])
    expect(pendingConfirmId(s)).toBe('act1')
    expect(pendingConfirmId({ ...s, actions: { act1: 'confirmed' } })).toBeUndefined()
    expect(pendingConfirmId({ ...s, actions: { act1: 'rejected' } })).toBeUndefined()
    expect(pendingConfirmId({ ...s, actions: { act1: 'failed' } })).toBe('act1')
  })
})

describe('mascotView', () => {
  const opts = { typing: false }
  it('đổi trạng thái theo bước agent', () => {
    expect(mascotView(initialChatState, opts).state).toBe('wave')
    expect(mascotView(initialChatState, { typing: true }).state).toBe('listening')
    expect(mascotView(run([{ type: 'userSent', id: 'u', text: 'x' }]), opts).state).toBe('thinking')
    expect(mascotView(run([{ type: 'userSent', id: 'u', text: 'x' }, block('EventList', {})]), opts).state).toBe(
      'working',
    )
    expect(mascotView(run([confirm]), opts).state).toBe('asking')
    expect(mascotView(run([{ type: 'event', event: { type: 'ticket.issued', data: {} } }]), opts).state).toBe(
      'celebrate',
    )
    expect(mascotView(run([{ type: 'failed', message: 'lỗi' }]), opts).state).toBe('sorry')
  })

  it('đang chờ QR thì báo "Chờ bạn quét QR nha"', () => {
    expect(mascotView(run([block('PaymentQR', {})]), opts).bubble).toBe('Chờ bạn quét QR nha')
  })
})

describe('eventPill / dedupePills', () => {
  it('đặt nhãn mốc đơn', () => {
    expect(eventPill('order.held', { seats: ['D-14', 'D-15'], order_code: 'VG-24117' })?.label).toBe(
      'ĐÃ GIỮ D-14, D-15 · ĐƠN #VG-24117',
    )
    expect(eventPill('order.paid', {})?.label).toBe('ORDER.PAID · TICKET.ISSUED')
    expect(eventPill('chat.delta', {})).toBeUndefined()
  })

  it('order.paid và ticket.issued liền kề chỉ hiện một pill', () => {
    const s = run([
      { type: 'event', event: { id: '1', type: 'order.paid', data: {} } },
      { type: 'event', event: { id: '2', type: 'ticket.issued', data: {} } },
    ])
    expect(dedupePills(s.items)).toHaveLength(1)
  })
})
