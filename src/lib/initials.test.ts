import { describe, expect, it } from 'vitest'

import { initials } from './initials'

describe('initials', () => {
  it('lấy chữ đầu của từ đầu và từ cuối', () => {
    expect(initials('Minh Anh')).toBe('MA')
    expect(initials('Nguyễn Văn Bình')).toBe('NB')
  })

  it('một từ thì chỉ lấy một chữ, viết hoa', () => {
    expect(initials('danh')).toBe('D')
  })

  it('bỏ khoảng trắng thừa', () => {
    expect(initials('  trần   luân ')).toBe('TL')
  })

  it('tên rỗng thì trả "?"', () => {
    expect(initials('')).toBe('?')
    expect(initials(undefined)).toBe('?')
  })
})
