import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { LoginResult, LogoutBody, SessionInfo, UpdateMeBody, User } from '@/api/generated/model'

/**
 * Mock auth trả user cố định để đi được mọi màn. Đổi vai trò bằng VITE_MOCK_ROLE=BUYER|ADMIN (mặc định ADMIN).
 */
const role = import.meta.env.VITE_MOCK_ROLE === 'BUYER' ? 'BUYER' : 'ADMIN'

function currentUser(): User {
  return {
    id: '0193a000-0000-7000-8000-000000000001',
    email: role === 'ADMIN' ? 'admin@vingo.test' : 'buyer@vingo.test',
    full_name: role === 'ADMIN' ? 'Admin Mock' : 'Người mua Mock',
    role,
    ...(role === 'BUYER' ? { phone: '+84912345678' } : {}),
  }
}
// Chỉ lưu cờ demo để các tab mock cùng thấy trạng thái đăng nhập.
const signedOut = 'vingo.mock.signed-out'
const otherRevoked = 'vingo.mock.other-revoked'
export const mockSignedIn = () => localStorage.getItem(signedOut) !== '1'
export const unauthorized = () =>
  HttpResponse.json({ title: 'Chưa đăng nhập', status: 401, code: 'UNAUTHORIZED' }, { status: 401 })

const now = Date.now()
const current: SessionInfo = {
  id: '0193a000-0000-7000-8000-000000000002',
  user_agent: navigator.userAgent,
  last_ip: null,
  created_at: new Date(now).toISOString(),
  last_seen_at: new Date(now).toISOString(),
  expires_at: new Date(now + 86400000).toISOString(),
  current: true,
}
const other: SessionInfo = {
  ...current,
  id: '0193a000-0000-7000-8000-000000000003',
  user_agent: 'Chrome/130 Windows',
  last_ip: '192.0.2.1',
  current: false,
}
const activeSessions = () => (localStorage.getItem(otherRevoked) ? [current] : [current, other])

function signIn() {
  localStorage.removeItem(signedOut)
  return HttpResponse.json<LoginResult>({ user: currentUser() })
}
export const authHandlers = [
  http.post(`*${API_BASE}/auth/login`, signIn),
  http.post(`*${API_BASE}/auth/otp/verify`, signIn),
  http.post(`*${API_BASE}/auth/logout`, async ({ request }) => {
    if (!mockSignedIn()) return unauthorized()
    const body = (await request.text()) || '{}'
    const options = JSON.parse(body) as LogoutBody
    if (options.all_devices) localStorage.setItem(otherRevoked, '1')
    localStorage.setItem(signedOut, '1')
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`*${API_BASE}/me`, () => (mockSignedIn() ? HttpResponse.json(currentUser()) : unauthorized())),
  http.patch(`*${API_BASE}/me`, async ({ request }) => {
    if (!mockSignedIn()) return unauthorized()
    const data = (await request.json()) as UpdateMeBody
    if (data.new_password) localStorage.setItem(otherRevoked, '1')
    return HttpResponse.json(currentUser())
  }),
  http.get(`*${API_BASE}/me/sessions`, () => (mockSignedIn() ? HttpResponse.json(activeSessions()) : unauthorized())),
  http.delete(`*${API_BASE}/me/sessions/:id`, ({ params }) => {
    if (!mockSignedIn()) return unauthorized()
    const session = activeSessions().find((s) => s.id === params.id)
    if (!session) return HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 })
    localStorage.setItem(session.current ? signedOut : otherRevoked, '1')
    return new HttpResponse(null, { status: 204 })
  }),
]
