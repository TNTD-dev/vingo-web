import { describe, expect, it } from 'vitest'

import type { ProblemCode } from '@/api/generated/model'
import { ApiError } from '@/api/problem'

import { registerErrorMessage } from './otpErrors'

const err = (status: number, code?: ProblemCode, retryAfter?: number) =>
  new ApiError(status, code ? ({ type: 'x', title: 't', status, code } as never) : null, retryAfter)

describe('registerErrorMessage', () => {
  it('EMAIL_TAKEN gợi ý đăng nhập', () => {
    expect(registerErrorMessage(err(409, 'EMAIL_TAKEN'))).toMatch(/Email.*đăng nhập/)
  })
  it('503 nói email chưa gửi được', () => {
    expect(registerErrorMessage(err(503, 'SERVICE_UNAVAILABLE'))).toMatch(/Chưa gửi được email/)
    expect(registerErrorMessage(err(503))).toMatch(/Chưa gửi được email/)
  })
  it('429 hiện số giây chờ khi có Retry-After', () => {
    expect(registerErrorMessage(err(429, 'RATE_LIMITED', 30))).toContain('30 giây')
  })
  it('VALIDATION_ERROR và lỗi lạ có câu mặc định', () => {
    expect(registerErrorMessage(err(400, 'VALIDATION_ERROR'))).toMatch(/chưa hợp lệ/)
    expect(registerErrorMessage(new Error('x'))).toMatch(/Chưa tạo được/)
  })
})
