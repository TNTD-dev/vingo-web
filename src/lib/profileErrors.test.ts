import { describe, expect, it } from 'vitest'

import type { Problem } from '@/api/generated/model'
import { ApiError } from '@/api/problem'

import { profileFieldErrors } from './profileErrors'

const problem = (code: Problem['code'], errors?: Problem['errors']): Problem => ({
  title: 't',
  status: 400,
  code,
  errors,
})

describe('profileFieldErrors', () => {
  it('đổi lỗi field của backend thành câu tiếng Việt theo từng ô', () => {
    const e = new ApiError(
      400,
      problem('VALIDATION_ERROR', [{ field: 'email', message: 'must be a well-formed email address' }]),
    )
    expect(profileFieldErrors(e)).toEqual({ email: 'Email chưa đúng định dạng' })
  })

  it('nhận cả tên field camelCase', () => {
    const e = new ApiError(400, problem('VALIDATION_ERROR', [{ field: 'fullName', message: 'x' }]))
    expect(profileFieldErrors(e).full_name).toBeDefined()
  })

  it('lỗi khác hoặc không phải ApiError thì rỗng', () => {
    expect(profileFieldErrors(new ApiError(500, null))).toEqual({})
    expect(profileFieldErrors(new Error('x'))).toEqual({})
  })
})
