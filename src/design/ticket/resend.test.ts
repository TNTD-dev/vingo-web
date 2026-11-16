import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/problem'

import { formatWait, resendErrorMessage } from './resend'

const problem = (code: string, detail = '') => ({ code, detail, status: 0, title: '' }) as never

describe('resendErrorMessage', () => {
  it('429 báo thời gian chờ theo Retry-After', () => {
    const e = new ApiError(429, problem('RATE_LIMITED'), 1651)
    expect(resendErrorMessage(e)).toContain('sau 28 phút')
  })
  it('429 không có Retry-After vẫn có câu báo', () => {
    expect(resendErrorMessage(new ApiError(429, problem('RATE_LIMITED')))).toContain('sau ít phút')
  })
  it('409 hiện lý do backend trả về', () => {
    const e = new ApiError(409, problem('ORDER_STATE_INVALID', 'Đơn không có email để gửi vé'))
    expect(resendErrorMessage(e)).toBe('Đơn không có email để gửi vé')
  })
  it('404 báo không tìm thấy vé', () => {
    expect(resendErrorMessage(new ApiError(404, problem('NOT_FOUND')))).toBe('Không tìm thấy vé.')
  })
  it('lỗi khác dùng câu chung', () => {
    expect(resendErrorMessage(new Error('mạng'))).toContain('Chưa gửi được')
  })
})

describe('formatWait', () => {
  it('chọn đơn vị phù hợp', () => {
    expect(formatWait(30)).toBe('30 giây')
    expect(formatWait(61)).toBe('2 phút')
    expect(formatWait(3600)).toBe('1 giờ')
  })
})
