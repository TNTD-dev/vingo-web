import { describe, expect, it } from 'vitest'

import { agentPath } from '@/features/landing/agentLink'

import { contextLabel, contextMessage, readContext, readInitialQuestion } from './handoff'

describe('readInitialQuestion', () => {
  it('đọc câu hỏi từ ?q= do Landing tạo, kể cả có dấu và ký tự đặc biệt', () => {
    const q = '2 vé HAGL cuối tuần, khán đài B & ngồi cạnh nhau?'
    const search = agentPath(q).slice('/vingo'.length)
    expect(readInitialQuestion(search)).toBe(q)
  })

  it('bỏ qua q rỗng hoặc toàn khoảng trắng, cắt ở 500 ký tự', () => {
    expect(readInitialQuestion('')).toBeUndefined()
    expect(readInitialQuestion('?q=%20%20')).toBeUndefined()
    expect(readInitialQuestion(`?q=${'a'.repeat(900)}`)).toHaveLength(500)
  })
})

describe('ngữ cảnh từ trang chọn ghế', () => {
  const state = { context: { eventTitle: 'HAGL vs Hà Nội', zone: 'B', seats: ['D-14', 'D-15'] } }

  it('đọc context hợp lệ và từ chối state lạ', () => {
    expect(readContext(state)).toMatchObject({ eventTitle: 'HAGL vs Hà Nội', zone: 'B', seats: ['D-14', 'D-15'] })
    expect(readContext(null)).toBeUndefined()
    expect(readContext({ context: { eventTitle: '' } })).toBeUndefined()
    expect(readContext({ context: 'x' })).toBeUndefined()
  })

  it('tạo chip và câu gửi cho agent', () => {
    const c = readContext(state)!
    expect(contextLabel(c)).toBe('Từ trang Chọn ghế · HAGL vs Hà Nội · khu B · 2 ghế đã chọn')
    expect(contextMessage(c)).toContain('D-14, D-15')
  })
})
