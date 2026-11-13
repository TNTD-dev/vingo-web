import { describe, expect, it } from 'vitest'

import type { FormField } from './adminPayloads'
import { editedFields, hasEdits, initialValues, isAgentFilled, isComplete } from './formState'

const fields: FormField[] = [
  { key: 'start', label: 'Bắt đầu', value: '17:00', byAgent: true },
  { key: 'end', label: 'Kết thúc', value: '19:00', byAgent: true },
  { key: 'note', label: 'Ghi chú', value: '', byAgent: false },
]

describe('form suất điền sẵn', () => {
  it('ô còn nguyên giá trị Vingo điền thì mang dấu Vingo, sửa rồi thì mất', () => {
    const v = { ...initialValues(fields), start: '18:00' }
    expect(isAgentFilled(fields[0]!, v)).toBe(false)
    expect(isAgentFilled(fields[1]!, v)).toBe(true)
  })

  it('ô admin tự nhập (không phải Vingo điền) không mang dấu Vingo', () => {
    expect(isAgentFilled(fields[2]!, initialValues(fields))).toBe(false)
  })

  it('chỉ báo các ô đã sửa so với bản Vingo điền', () => {
    const v = { ...initialValues(fields), end: '20:00' }
    expect(editedFields(fields, v)).toEqual({ end: '20:00' })
    expect(hasEdits(fields, v)).toBe(true)
    expect(hasEdits(fields, initialValues(fields))).toBe(false)
  })

  it('không cho gửi khi còn ô trống', () => {
    expect(isComplete({ a: '1', b: ' ' })).toBe(false)
    expect(isComplete({ a: '1', b: '2' })).toBe(true)
  })
})
