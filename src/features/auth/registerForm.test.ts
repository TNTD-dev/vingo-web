import { describe, expect, it } from 'vitest'

import { validateRegister } from './registerForm'

const ok = { full_name: 'Minh Anh', phone: '0901234821', email: 'a@b.vn', password: 'Abcdefg1!', confirm: 'Abcdefg1!' }

describe('validateRegister', () => {
  it('không có lỗi khi nhập đủ và đúng', () => {
    expect(validateRegister(ok, true)).toEqual({})
  })
  it('báo lỗi mật khẩu nhập lại không khớp và chưa đồng ý điều khoản', () => {
    const e = validateRegister({ ...ok, confirm: 'khac' }, false)
    expect(e.confirm).toBeDefined()
    expect(e.terms).toBeDefined()
  })
})
