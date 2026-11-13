import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import { ApiError, isApiError } from '@/api/problem'
import { tokenStore } from '@/auth/token-store'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('http', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    tokenStore.set({ accessToken: 'old', refreshToken: 'r1', user: { id: 'u1', role: 'BUYER' } })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    tokenStore.set(null)
  })

  it('gắn base path và Bearer token', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))

    await expect(http('/me')).resolves.toEqual({ ok: true })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/me')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer old')
  })

  it('401 thì refresh một lần rồi gọi lại với token mới', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { title: 'Chưa đăng nhập', status: 401, code: 'UNAUTHORIZED' }))
      .mockResolvedValueOnce(json(200, { access_token: 'new', expires_in: 900, user: { id: 'u1' } }))
      .mockResolvedValueOnce(json(200, { ok: true }))

    await expect(http('/orders')).resolves.toEqual({ ok: true })

    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ refresh_token: 'r1' })
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer new')
  })

  it('refresh thất bại thì xoá phiên và ném ApiError 401', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { title: 'x', status: 401, code: 'UNAUTHORIZED' }))
      .mockResolvedValueOnce(json(401, { title: 'x', status: 401, code: 'UNAUTHORIZED' }))

    await expect(http('/orders')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(tokenStore.get()).toBeNull()
  })

  it('lỗi nghiệp vụ ném ApiError mang code từ ProblemDetail', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { title: 'Ghế đã có người giữ', status: 409, code: 'SEAT_TAKEN', detail: 'A12 vừa bị giữ' }),
    )

    const error = await http('/showtimes/s1/holds', { method: 'POST', body: '{}' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(isApiError(error, 'SEAT_TAKEN')).toBe(true)
    expect((error as ApiError).message).toBe('A12 vừa bị giữ')
  })
})
