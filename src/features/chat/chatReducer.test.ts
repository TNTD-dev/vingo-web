import { describe, expect, it } from 'vitest'

import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'

const run = (actions: ChatAction[], from: ChatState = initialChatState) => actions.reduce(chatReducer, from)
const ev = (type: string, data: Record<string, unknown>): ChatAction => ({ type: 'event', event: { type, data } })

describe('chatReducer', () => {
  it('ghép chat.delta, chat.block, chat.done thành một tin của Vingo', () => {
    const s = run([
      { type: 'userSent', id: 'u1', text: 'Tìm vé HAGL' },
      ev('chat.delta', { message_id: 'm1', text: 'Có 1 trận ' }),
      ev('chat.delta', { message_id: 'm1', text: 'phù hợp.' }),
      ev('chat.block', { message_id: 'm1', block: { id: 'b1', type: 'EventList', payload: {} } }),
      ev('chat.done', { message_id: 'm1', quick_replies: ['Chọn trận này'] }),
    ])
    expect(s.awaiting).toBe(false)
    expect(s.items).toHaveLength(2)
    expect(s.items[1]).toMatchObject({
      kind: 'assistant',
      text: 'Có 1 trận phù hợp.',
      done: true,
      quickReplies: ['Chọn trận này'],
    })
    expect(s.items[1]?.kind === 'assistant' && s.items[1].blocks).toHaveLength(1)
  })

  it('đang chờ agent từ lúc gửi tin tới chat.done', () => {
    const sent = run([{ type: 'userSent', id: 'u1', text: 'Xin chào' }])
    expect(sent.awaiting).toBe(true)
    expect(run([ev('chat.done', { message_id: 'm1' })], sent).awaiting).toBe(false)
  })

  it('block gửi lặp cùng id thì thay thế, không nhân đôi', () => {
    const s = run([
      ev('chat.block', { message_id: 'm1', block: { id: 'b1', type: 'PaymentQR', payload: { status: 'PENDING' } } }),
      ev('chat.block', { message_id: 'm1', block: { id: 'b1', type: 'PaymentQR', payload: { status: 'PAID' } } }),
    ])
    const a = s.items[0]
    expect(a?.kind === 'assistant' && a.blocks).toHaveLength(1)
    expect(a?.kind === 'assistant' && a.blocks[0]?.payload).toEqual({ status: 'PAID' })
  })

  it('bỏ qua tin của cuộc hội thoại khác khi sự kiện ghi rõ conversation_id', () => {
    const base = chatReducer(initialChatState, { type: 'conversation', conversationId: 'c1' })
    const s = run([ev('chat.delta', { message_id: 'm9', conversation_id: 'c2', text: 'không phải của mình' })], base)
    expect(s.items).toHaveLength(0)
  })

  it('sự kiện đơn/vé vừa được ghi nhận vừa thành mốc trong dòng hội thoại', () => {
    const s = run([ev('order.held', { order_code: 'VG-1' }), ev('ticket.issued', {})])
    expect(s.orderEvents.map((e) => e.type)).toEqual(['order.held', 'ticket.issued'])
    expect(s.items.map((i) => i.kind)).toEqual(['event', 'event'])
  })

  it('nạp lịch sử: user và assistant theo thứ tự, mọi tin đã xong', () => {
    const s = run([
      {
        type: 'history',
        messages: [
          { id: 'a', role: 'user', text: 'hi' },
          { id: 'b', role: 'assistant', text: 'chào', blocks: [{ id: 'x', type: 'Ticket' }] },
        ],
      },
    ])
    expect(s.items.map((i) => i.kind)).toEqual(['user', 'assistant'])
    expect(s.items[1]).toMatchObject({ done: true })
  })

  it('ghi nhận trạng thái duyệt/từ chối theo action_id', () => {
    const s = run([
      { type: 'actionState', actionId: 'a1', state: 'confirming' },
      { type: 'actionState', actionId: 'a1', state: 'confirmed' },
      { type: 'actionState', actionId: 'a2', state: 'rejected' },
    ])
    expect(s.actions).toEqual({ a1: 'confirmed', a2: 'rejected' })
  })

  it('lỗi gửi tin dừng trạng thái chờ và giữ thông báo', () => {
    const s = run([
      { type: 'userSent', id: 'u', text: 'x' },
      { type: 'failed', message: 'lỗi' },
    ])
    expect(s).toMatchObject({ awaiting: false, error: 'lỗi' })
  })
})

describe('chatReducer · supersede (Admin Copilot)', () => {
  const confirm = (id: string, actionId: string): ChatAction =>
    ev('chat.block', { message_id: 'm1', block: { id, type: 'ConfirmAction', payload: { action_id: actionId } } })

  it('admin sửa trên block thì ConfirmAction đang chờ hết hiệu lực, không đụng cái đã quyết', () => {
    const s = run([
      confirm('b1', 'act1'),
      confirm('b2', 'act2'),
      { type: 'actionState', actionId: 'act1', state: 'confirmed' },
      { type: 'supersede' },
    ])
    expect(s.actions).toEqual({ act1: 'confirmed', act2: 'expired' })
  })
})
