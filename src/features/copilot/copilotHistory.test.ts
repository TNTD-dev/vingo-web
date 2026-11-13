import { describe, expect, it } from 'vitest'

import { chatReducer, initialChatState, type ChatAction } from '@/features/chat/chatReducer'
import type { HistoryEntry } from '@/features/chat/history'

import { describeSession, filterHistory } from './copilotHistory'

const run = (actions: ChatAction[]) => actions.reduce(chatReducer, initialChatState)
const confirm = (id: string, kind: string): ChatAction => ({
  type: 'event',
  event: {
    type: 'chat.block',
    data: { message_id: 'm', block: { id: `b-${id}`, type: 'ConfirmAction', payload: { action_id: id, kind } } },
  },
})

describe('kết quả phiên Copilot', () => {
  it('không có thao tác ghi thì chỉ đọc', () => {
    expect(describeSession(initialChatState)).toEqual({ tag: 'READ_ONLY', kinds: [], pending: 0 })
  })

  it('còn đề xuất chưa quyết thì chờ duyệt, đếm số đề xuất', () => {
    const s = run([confirm('a', 'RESOLVE_REVIEW'), confirm('b', 'BLOCK_SEATS')])
    expect(describeSession(s)).toEqual({ tag: 'AWAITING', kinds: ['RESOLVE_REVIEW', 'BLOCK_SEATS'], pending: 2 })
  })

  it('đã duyệt thì đã thực thi; từ chối hết thì đã từ chối', () => {
    const ok = run([confirm('a', 'CREATE_SHOWTIME'), { type: 'actionState', actionId: 'a', state: 'confirmed' }])
    expect(describeSession(ok).tag).toBe('EXECUTED')
    const no = run([confirm('a', 'CANCEL_SHOWTIME'), { type: 'actionState', actionId: 'a', state: 'rejected' }])
    expect(describeSession(no).tag).toBe('REJECTED')
  })

  it('đề xuất bị thay bằng bản mới (admin sửa) không tính là chờ duyệt', () => {
    const s = run([
      confirm('a', 'RESOLVE_REVIEW'),
      { type: 'supersede' },
      confirm('b', 'RESOLVE_REVIEW'),
      { type: 'actionState', actionId: 'b', state: 'confirmed' },
    ])
    expect(describeSession(s)).toMatchObject({ tag: 'EXECUTED', pending: 0 })
  })
})

describe('bộ lọc lịch sử', () => {
  const e = (id: string, tag: HistoryEntry['tag'], title: string, kinds?: string[]): HistoryEntry => ({
    id,
    title,
    preview: '',
    tag,
    kinds,
    updatedAt: 1,
  })
  const list = [
    e('1', 'AWAITING', 'Xử lý 4 đơn cần duyệt', ['RESOLVE_REVIEW']),
    e('2', 'EXECUTED', 'Khoá ghế khách mời', ['BLOCK_SEATS']),
    e('3', 'READ_ONLY', 'Báo cáo doanh thu tuần'),
    e('4', 'REJECTED', 'Huỷ suất 29/11', ['CANCEL_SHOWTIME']),
  ]

  it('"Tất cả" giữ mọi phiên', () => {
    expect(filterHistory(list, 'all')).toHaveLength(4)
  })

  it('"Có thao tác ghi" bỏ phiên chỉ đọc, giữ cả đã thực thi, chờ duyệt và đã từ chối', () => {
    expect(filterHistory(list, 'write').map((x) => x.id)).toEqual(['1', '2', '4'])
  })

  it('"Chờ duyệt" chỉ giữ phiên còn đề xuất chưa quyết', () => {
    expect(filterHistory(list, 'pending').map((x) => x.id)).toEqual(['1'])
  })

  it('tìm theo tiêu đề hoặc tên thao tác, kết hợp với bộ lọc', () => {
    expect(filterHistory(list, 'all', 'khoá').map((x) => x.id)).toEqual(['2'])
    expect(filterHistory(list, 'all', 'block_seats').map((x) => x.id)).toEqual(['2'])
    expect(filterHistory(list, 'pending', 'khoá')).toEqual([])
  })
})
