import { describe, expect, it } from 'vitest'

import { isCopilotShortcut } from './copilotShortcut'

const key = (over: Partial<Parameters<typeof isCopilotShortcut>[0]>) => ({
  key: 'j',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
})

describe('phím tắt Copilot', () => {
  it('⌘J và Ctrl+J mở Copilot, không phân biệt hoa thường', () => {
    expect(isCopilotShortcut(key({ metaKey: true }))).toBe(true)
    expect(isCopilotShortcut(key({ ctrlKey: true, key: 'J' }))).toBe(true)
  })

  it('J trơn, hoặc kèm Shift/Alt, hoặc phím khác thì không bắt', () => {
    expect(isCopilotShortcut(key({}))).toBe(false)
    expect(isCopilotShortcut(key({ metaKey: true, shiftKey: true }))).toBe(false)
    expect(isCopilotShortcut(key({ metaKey: true, altKey: true }))).toBe(false)
    expect(isCopilotShortcut(key({ metaKey: true, key: 'k' }))).toBe(false)
  })
})
