import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import type { SessionInfo } from '@/api/generated/model'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/guards'
import { SESSION_SIGNAL, sessionStore } from '@/auth/token-store'
import { deferred } from '@/test/deferred'
import AccountSecurityPage from './AccountSecurityPage'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
const request = vi.fn<typeof fetch>()
const user = { id: 'buyer', role: 'BUYER' }
const current: SessionInfo = {
  id: 'this',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36',
  last_ip: '192.0.2.10',
  current: true,
  created_at: '2026-11-20T00:00:00Z',
  last_seen_at: '2026-11-25T01:30:00Z',
  expires_at: '2026-12-01T00:00:00Z',
}
const other: SessionInfo = { ...current, id: 'other', current: false, user_agent: null, last_ip: null }
const all = 'Đăng xuất tất cả thiết bị'
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const noContent = () => new Response(null, { status: 204 })
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      {
        path: '/me/security',
        element: (
          <RequireAuth>
            <AccountSecurityPage />
          </RequireAuth>
        ),
      },
      { path: '/login', element: <>Trang đăng nhập</> },
    ],
    { initialEntries: ['/me/security'] },
  )
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return client
}
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', request)
  request.mockResolvedValueOnce(Response.json(user))
})
afterEach(() => {
  cleanup()
  sessionStore.set(null)
  localStorage.clear()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('hiện tải, lỗi có thể thử lại và danh sách rỗng', async () => {
  const pending = deferred<Response>()
  request.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(Response.json([]))
  setup()
  await screen.findByText('Đang tải danh sách thiết bị…')
  pending.resolve(new Response(null, { status: 503 }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được danh sách')
  click('Thử lại')
  await screen.findByText('Không có thiết bị đang đăng nhập.')
})

it.each([204, 404])(
  'thu hồi máy khác nhận %i thì tải lại danh sách, giữ phiên và khoá các nút khi gửi',
  async (status) => {
    const pending = deferred<Response>()
    request
      .mockResolvedValueOnce(Response.json([current, other]))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(Response.json([current]))
    setup()
    const row = (await screen.findByText('Chrome trên Windows')).closest('li')!
    expect(within(row).getByText('Thiết bị này')).toBeVisible()
    expect(row).toHaveTextContent('IP 192.0.2.10')
    expect(row).toHaveTextContent('08:30 25/11/2026')
    const unknown = screen.getByText('Thiết bị không xác định').closest('li')!
    expect(within(unknown).queryByText(/IP/)).toBeNull()
    click('Đăng xuất Thiết bị không xác định')
    await waitFor(() => expect(screen.getByRole('button', { name: all })).toBeDisabled())
    expect(within(row).getByRole('button')).toBeDisabled()
    expect(request.mock.calls[2]).toEqual(['/api/v1/me/sessions/other', expect.objectContaining({ method: 'DELETE' })])
    pending.resolve(new Response(null, { status }))
    await waitFor(() => expect(screen.queryByText('Thiết bị không xác định')).toBeNull())
    expect(screen.getByRole('button', { name: all })).toBeEnabled()
    expect(request.mock.calls[3][0]).toBe('/api/v1/me/sessions')
    expect(sessionStore.get()).toEqual(user)
  },
)

it.each(['Đăng xuất thiết bị này', all])('%s xoá cache và về đăng nhập', async (action) => {
  request.mockResolvedValueOnce(Response.json([current])).mockResolvedValueOnce(noContent())
  const client = setup()
  await screen.findByText('Chrome trên Windows')
  client.setQueryData(['/tickets'], ['private'])
  click(action)
  await screen.findByText('Trang đăng nhập')
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(sessionStore.get()).toBeNull()
  expect(request.mock.calls[2]).toEqual(
    action === all
      ? [
          '/api/v1/auth/logout',
          expect.objectContaining({ method: 'POST', body: JSON.stringify({ all_devices: true }) }),
        ]
      : ['/api/v1/me/sessions/this', expect.objectContaining({ method: 'DELETE' })],
  )
  expect(request).toHaveBeenCalledTimes(3)
})

it('đổi mật khẩu báo thu hồi máy khác và đọc lại danh sách', async () => {
  request
    .mockResolvedValueOnce(Response.json([current, other]))
    .mockResolvedValueOnce(Response.json(user))
    .mockResolvedValueOnce(Response.json([current]))
  setup()
  await screen.findByText('Thiết bị không xác định')
  click('Đổi mật khẩu')
  for (const label of ['Mật khẩu hiện tại', 'Mật khẩu mới', 'Nhập lại mật khẩu mới']) {
    fireEvent.change(screen.getByLabelText(label), {
      target: { value: label === 'Mật khẩu hiện tại' ? 'old-password' : 'new-password' },
    })
  }
  click('Lưu mật khẩu mới')
  await waitFor(() => expect(screen.queryByText('Thiết bị không xác định')).toBeNull())
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('đăng xuất các thiết bị khác'))
  expect(request.mock.calls[2]).toEqual(['/api/v1/me', expect.objectContaining({ method: 'PATCH' })])
  expect(request.mock.calls[3][0]).toBe('/api/v1/me/sessions')
  expect(sessionStore.get()).toEqual(user)
})

it.each([401, 404])('thu hồi máy hiện tại nhận %i thì xử lý đúng phiên và danh sách', async (status) => {
  request
    .mockResolvedValueOnce(Response.json([current]))
    .mockResolvedValueOnce(new Response(null, { status }))
    .mockResolvedValueOnce(Response.json([]))
  setup()
  await screen.findByText('Chrome trên Windows')
  click('Đăng xuất thiết bị này')
  if (status === 401) {
    await screen.findByText('Trang đăng nhập')
    expect(sessionStore.get()).toBeNull()
    expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
    expect(toast.error).not.toHaveBeenCalled()
    expect(request).toHaveBeenCalledTimes(3)
  } else {
    await screen.findByText('Không có thiết bị đang đăng nhập.')
    expect(sessionStore.get()).toEqual(user)
    expect(request.mock.calls[3][0]).toBe('/api/v1/me/sessions')
  }
})

it.each([204, 401])('thu hồi máy hiện tại trả %i sau 401 của request khác vẫn báo các tab', async (status) => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(Response.json([current]))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  const client = setup()
  await screen.findByText('Chrome trên Windows')
  client.setQueryData(['/tickets'], ['old-session-ticket'])
  click('Đăng xuất thiết bị này')
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  await act(async () => {
    await expect(http('/orders')).rejects.toMatchObject({ status: 401 })
  })
  await screen.findByText('Trang đăng nhập')
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeNull()
  await act(async () => pending.resolve(new Response(null, { status })))
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(toast.error).not.toHaveBeenCalled()
})

it('401 thu hồi máy cũ về muộn giữ tài khoản vừa đồng bộ từ tab khác và cache mới', async () => {
  const pending = deferred<Response>()
  const next = { ...user, id: 'new-buyer' }
  request
    .mockResolvedValueOnce(Response.json([current]))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(Response.json(next))
    .mockResolvedValueOnce(Response.json([current]))
  const client = setup()
  await screen.findByText('Chrome trên Windows')
  click('Đăng xuất thiết bị này')
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
  fireEvent(window, new StorageEvent('storage', { key: SESSION_SIGNAL, newValue: 'changed' }))
  await waitFor(() => expect(sessionStore.get()).toEqual(next))
  await screen.findByText('Chrome trên Windows')
  client.setQueryData(['/tickets'], ['new-session-ticket'])
  await act(async () => pending.resolve(new Response(null, { status: 401 })))
  expect(sessionStore.get()).toEqual(next)
  expect(client.getQueryData(['/tickets'])).toEqual(['new-session-ticket'])
  expect(screen.queryByText('Trang đăng nhập')).toBeNull()
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeNull()
  expect(toast.error).not.toHaveBeenCalled()
})

it.each(['mạng', '503'])('thu hồi máy khác lỗi %s thì giữ danh sách và cho gửi lại', async (cause) => {
  request.mockResolvedValueOnce(Response.json([current, other]))
  if (cause === '503') request.mockResolvedValueOnce(new Response(null, { status: 503 }))
  else request.mockRejectedValueOnce(new TypeError('offline'))
  request.mockResolvedValueOnce(noContent()).mockResolvedValueOnce(Response.json([current]))
  setup()
  await screen.findByText('Thiết bị không xác định')
  click('Đăng xuất Thiết bị không xác định')
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('tải lại danh sách')))
  expect(screen.getByRole('button', { name: all })).toBeEnabled()
  expect(sessionStore.get()).toEqual(user)
  click('Đăng xuất Thiết bị không xác định')
  await waitFor(() => expect(screen.queryByText('Thiết bị không xác định')).toBeNull())
})

it.each([
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge trên Windows'],
  ['Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 OPR/115.0', 'Opera trên Windows'],
  ['Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0', 'Firefox trên Linux'],
  ['Mozilla/5.0 (Linux; Android 15) Chrome/130.0 Mobile Safari/537.36', 'Chrome trên Android'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari trên iOS'],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15', 'Safari trên macOS'],
  ['unknown-browser', 'Thiết bị không xác định'],
])('tên thiết bị từ %s là %s', async (agent, label) => {
  request.mockResolvedValueOnce(Response.json([{ ...current, user_agent: agent }]))
  setup()
  expect(await screen.findByText(label)).toBeVisible()
})
