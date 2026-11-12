import { describe, expect, it } from 'vitest'

import { createDeduper } from './dedupe'

describe('createDeduper', () => {
  it('bỏ sự kiện trùng id khi server phát lại', () => {
    const accept = createDeduper()
    expect(accept('a')).toBe(true)
    expect(accept('b')).toBe(true)
    expect(accept('a')).toBe(false)
  })

  it('sự kiện không có id luôn được nhận', () => {
    const accept = createDeduper()
    expect(accept(undefined)).toBe(true)
    expect(accept(undefined)).toBe(true)
  })

  it('chỉ nhớ số id giới hạn', () => {
    const accept = createDeduper(2)
    accept('a')
    accept('b')
    accept('c')
    expect(accept('a')).toBe(true)
  })
})
