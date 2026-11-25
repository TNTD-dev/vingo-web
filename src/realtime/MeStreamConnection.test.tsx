import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '@/auth/auth-context'
import { sessionStore } from '@/auth/token-store'
import { deferred } from '@/test/deferred'
import { useMeStream } from './useMeStream'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sessionStore.set(null)
})

it('nối lại bằng cookie và Last-Event-ID sau EOF, bỏ sự kiện trùng và dừng hẳn khi nhận 401', async () => {
  vi.useFakeTimers()
  const user = { id: 'buyer', role: 'BUYER' } as const
  sessionStore.set(user)
  const frame = 'id: abc\nevent: order.paid\ndata: {}\n\n'
  const response = () => new Response(frame, { headers: { 'Content-Type': 'text/event-stream' } })
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  vi.stubGlobal('fetch', request)
  const opened = vi.fn()
  const onEvent = vi.fn()
  function Stream() {
    useMeStream(onEvent, opened)
    return null
  }
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{
          status: 'ready',
          retry: vi.fn(),
          user,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <Stream />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(35000)
  })
  expect(request).toHaveBeenCalledTimes(3)
  const [url, init] = request.mock.calls[0]
  expect(url).toBe('/api/v1/me/stream')
  expect(init?.credentials).toBe('same-origin')
  expect([...new Headers(init?.headers)]).toEqual([['accept', 'text/event-stream']])
  expect(new Headers(request.mock.calls[1][1]?.headers).get('last-event-id')).toBe('abc')
  expect(opened).toHaveBeenCalledTimes(2)
  expect(onEvent).toHaveBeenCalledExactlyOnceWith({ id: 'abc', type: 'order.paid', data: {} })
  expect(sessionStore.get()).toBeNull()
})

it.each([200, 401, 503])(
  'SSE cũ trả %i sau khi đổi phiên không phát sự kiện, không xoá phiên và không nối lại',
  async (status) => {
    vi.useFakeTimers()
    const user = { id: 'old', role: 'BUYER' } as const
    const next = { id: 'new', role: 'BUYER' } as const
    sessionStore.set(user)
    const pending = deferred<Response>()
    const request = vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    vi.stubGlobal('fetch', request)
    const onOpen = vi.fn()
    const onEvent = vi.fn()
    function Stream() {
      useMeStream(onEvent, onOpen)
      return null
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={{ status: 'ready', retry: vi.fn(), user, login: vi.fn(), logout: vi.fn() }}>
          <Stream />
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
    sessionStore.set(next)
    await act(async () => {
      pending.resolve(
        new Response('id: old\nevent: ticket.issued\ndata: {}\n\n', {
          status,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      await vi.advanceTimersByTimeAsync(35000)
    })
    expect(sessionStore.get()).toEqual(next)
    expect(onOpen).not.toHaveBeenCalled()
    expect(onEvent).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(1)
  },
)
