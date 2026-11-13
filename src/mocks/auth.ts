import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { RefreshResult, TokenPair, User } from '@/api/generated/model'

/**
 * Mock auth trả user cố định để đi được mọi màn. Đổi vai trò bằng VITE_MOCK_ROLE=BUYER|ADMIN (mặc định ADMIN).
 * Gọi /auth/logout xong thì /auth/refresh trả 401 tới khi đăng nhập lại.
 */
const role = import.meta.env.VITE_MOCK_ROLE === 'BUYER' ? 'BUYER' : 'ADMIN'
const user: User = {
  id: '0193a000-0000-7000-8000-000000000001',
  email: role === 'ADMIN' ? 'admin@vingo.test' : 'buyer@vingo.test',
  full_name: role === 'ADMIN' ? 'Admin Mock' : 'Người mua Mock',
  role,
  status: 'ACTIVE',
}
let signedIn = true

export const authHandlers = [
  http.post(`*${API_BASE}/auth/refresh`, () => {
    if (!signedIn)
      return HttpResponse.json({ title: 'Chưa đăng nhập', status: 401, code: 'UNAUTHORIZED' }, { status: 401 })
    return HttpResponse.json<RefreshResult>({ access_token: 'mock-access', expires_in: 900, user })
  }),
  http.post(`*${API_BASE}/auth/login`, () => {
    signedIn = true
    return HttpResponse.json<TokenPair>({
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
      expires_in: 900,
      user,
    })
  }),
  http.post(`*${API_BASE}/auth/logout`, () => {
    signedIn = false
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`*${API_BASE}/me`, () => HttpResponse.json(user)),
]
