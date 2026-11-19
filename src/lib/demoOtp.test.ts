import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureDemoOtp, isDemoOtpEnabled, takeDemoOtp } from '@/lib/demoOtp'

const withCode = (code: string) => new Headers({ 'X-Demo-Otp': code })

afterEach(() => {
  takeDemoOtp()
  vi.unstubAllEnvs()
})

describe('demoOtp', () => {
  it('bỏ qua header khi không bật VITE_DEMO_OTP', () => {
    vi.stubEnv('VITE_DEMO_OTP', 'false')
    captureDemoOtp(withCode('123456'))
    expect(isDemoOtpEnabled()).toBe(false)
    expect(takeDemoOtp()).toBeUndefined()
  })

  it('giữ mã từ header khi bật demo và chỉ trả một lần', () => {
    vi.stubEnv('VITE_DEMO_OTP', 'true')
    captureDemoOtp(withCode('123456'))
    expect(takeDemoOtp()).toBe('123456')
    expect(takeDemoOtp()).toBeUndefined()
  })

  it('không bị xoá bởi phản hồi khác không có header', () => {
    vi.stubEnv('VITE_DEMO_OTP', 'true')
    captureDemoOtp(withCode('654321'))
    captureDemoOtp(new Headers())
    expect(takeDemoOtp()).toBe('654321')
  })

  it('từ chối giá trị header không phải mã số', () => {
    vi.stubEnv('VITE_DEMO_OTP', 'true')
    captureDemoOtp(withCode('<script>'))
    expect(takeDemoOtp()).toBeUndefined()
  })
})
