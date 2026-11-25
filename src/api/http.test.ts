import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import { ApiError, isApiError } from '@/api/problem'
import { deferred } from '@/test/deferred'
import { sessionStore } from '@/auth/token-store'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('http', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    sessionStore.set({ id: 'u1', role: 'BUYER' })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    sessionStore.set(null)
  })

  it('gửi cookie cùng origin và giữ nguyên header nghiệp vụ', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    await expect(http('/me', { headers: { 'X-Test': 'ok' } })).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/me')
    expect(init).toMatchObject({ credentials: 'same-origin', mode: 'same-origin' })
    expect([...new Headers(init?.headers)]).toEqual([['x-test', 'ok']])
  })

  it('401 đồng thời chỉ kết thúc phiên một lần, giữ nguyên lỗi API và không gửi lại', async () => {
    fetchMock.mockImplementation(async () => json(401, { code: 'UNAUTHORIZED' }))
    const changed = vi.fn()
    const unsubscribe = sessionStore.subscribe(changed)
    try {
      await Promise.all(
        ['/orders', '/tickets'].map((url) =>
          expect(http(url)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' }),
        ),
      )
      expect(changed).toHaveBeenCalledTimes(1)
      expect(sessionStore.get()).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      unsubscribe()
    }
  })

  it('401 trả về sau khi đăng nhập lại cùng tài khoản giữ phiên mới', async () => {
    const response = deferred<Response>()
    fetchMock.mockReturnValueOnce(response.promise)
    const request = http('/orders')
    const account = sessionStore.get()
    sessionStore.set(account)
    response.resolve(json(401, { code: 'UNAUTHORIZED' }))
    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(sessionStore.get()).toBe(account)
  })

  it.each(['/auth/login', '/events', '/showtimes/s/availability', '/payments/vnpay/return'])(
    '401 ở %s giữ nguyên người dùng',
    async (url) => {
      fetchMock.mockResolvedValueOnce(json(401, { code: 'INVALID_CREDENTIALS' }))
      await expect(http(url, { method: url === '/auth/login' ? 'POST' : 'GET' })).rejects.toMatchObject({ status: 401 })
      expect(sessionStore.get()?.id).toBe('u1')
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('lỗi nghiệp vụ ném ApiError mang code từ ProblemDetail', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { title: 'Ghế đã có người giữ', status: 409, code: 'SEAT_TAKEN', detail: 'A12 vừa bị giữ' }),
    )

    const error = await http('/showtimes/s1/holds', { method: 'POST', body: '{}' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(isApiError(error, 'SEAT_TAKEN')).toBe(true)
    expect((error as ApiError).message).toBe('A12 vừa bị giữ')
  })
  it.each(['/tickets', '/auth/login', '/auth/otp/verify'])(
    'không trả kết quả %s về muộn của phiên cũ cho phiên mới',
    async (path) => {
      const response = deferred<Response>()
      fetchMock.mockReturnValueOnce(response.promise)
      const request = http(path)
      sessionStore.set({ id: 'u2', role: 'BUYER' })
      response.resolve(json(200, { data: ['old-account-ticket'] }))
      await expect(request).rejects.toMatchObject({ name: 'AbortError' })
      expect(sessionStore.get()?.id).toBe('u2')
    },
  )

  it.each(['mạng', '503'])('lỗi %s của request riêng giữ nguyên phiên', async (cause) => {
    if (cause === '503') fetchMock.mockResolvedValueOnce(json(503, {}))
    else fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(http('/orders')).rejects.toThrow()
    expect(sessionStore.get()?.id).toBe('u1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
