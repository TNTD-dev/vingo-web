import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { OtpSession, PhoneVerifyRequest, RefreshResult, TokenPair, User } from '@/api/generated/model'

/**
 * Mock auth trả user cố định để đi được mọi màn. Đổi vai trò bằng VITE_MOCK_ROLE=BUYER|ADMIN (mặc định ADMIN).
 * Gọi /auth/logout xong thì /auth/refresh trả 401 tới khi đăng nhập lại.
 * BUYER mock bắt đầu CHƯA xác minh số điện thoại để thử popup xác minh; mã OTP đúng là 123456, mã khác trả OTP_INVALID.
 */
const role = import.meta.env.VITE_MOCK_ROLE === 'BUYER' ? 'BUYER' : 'ADMIN'
const MOCK_OTP = '123456'
let phoneVerified = false

function currentUser(): User {
  return {
    id: '0193a000-0000-7000-8000-000000000001',
    email: role === 'ADMIN' ? 'admin@vingo.test' : 'buyer@vingo.test',
    full_name: role === 'ADMIN' ? 'Admin Mock' : 'Người mua Mock',
    role,
    status: 'ACTIVE',
    ...(role === 'BUYER' ? { phone: '+84912345678', phone_verified: phoneVerified } : {}),
  }
}
let signedIn = true

export const authHandlers = [
  http.post(`*${API_BASE}/auth/refresh`, () => {
    if (!signedIn)
      return HttpResponse.json({ title: 'Chưa đăng nhập', status: 401, code: 'UNAUTHORIZED' }, { status: 401 })
    return HttpResponse.json<RefreshResult>({ access_token: 'mock-access', expires_in: 900, user: currentUser() })
  }),
  http.post(`*${API_BASE}/auth/login`, () => {
    signedIn = true
    return HttpResponse.json<TokenPair>({
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
      expires_in: 900,
      user: currentUser(),
    })
  }),
  http.post(`*${API_BASE}/auth/logout`, () => {
    signedIn = false
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`*${API_BASE}/me`, () => HttpResponse.json(currentUser())),
  http.post(`*${API_BASE}/me/phone/otp`, () =>
    HttpResponse.json<OtpSession>(
      {
        otp_session_id: '0193a000-0000-7000-8000-0000000000a1',
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        channel: 'SMS',
      },
      // Giống backend SMS_PROVIDER=demo: để thử hộp "Mã demo" khi bật VITE_DEMO_OTP=true.
      { headers: { 'X-Demo-Otp': MOCK_OTP } },
    ),
  ),
  http.post(`*${API_BASE}/me/phone/verify`, async ({ request }) => {
    const body = (await request.json()) as PhoneVerifyRequest
    if (body.otp !== MOCK_OTP) {
      return HttpResponse.json({ title: 'OTP không đúng', status: 400, code: 'OTP_INVALID' }, { status: 400 })
    }
    phoneVerified = true
    return HttpResponse.json<User>(currentUser())
  }),
]
