import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { http } from '@/api/http'
import GoogleCallbackPage from '@/features/auth/GoogleCallbackPage'
import LoginPage from '@/features/auth/LoginPage'
import { rememberNext } from '@/features/auth/googleCallback'
import { deferred } from '@/test/deferred'
import { AuthProvider } from './AuthProvider'
import { EntryRedirect } from './EntryRedirect'
import { useAuth } from './auth-context'
import { RequireAuth } from './guards'
import { SESSION_SIGNAL, sessionStore } from './token-store'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
const request = vi.fn<typeof fetch>()
const buyer = { id: 'first', role: 'BUYER' } as const
const other = { id: 'second', role: 'BUYER' } as const
const response = (status: number, body: unknown = {}) => Response.json(body, { status })

const signalChange = () => fireEvent(window, new StorageEvent('storage', { key: SESSION_SIGNAL, newValue: 'changed' }))

function Controls() {
  const { status, user, login, logout } = useAuth()
  const [draft, setDraft] = useState('')
  return (
    <>
      <output>{user?.id ?? 'khách'}</output>
      <output data-testid="session-status">{status}</output>
      <input aria-label="Ghi chú" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button onClick={() => void login({ identifier: 'demo', password: 'test' }).catch(() => {})}>Vào</button>
      <button onClick={() => void logout()}>Ra</button>
      <button onClick={() => void http('/orders').catch(() => {})}>Đọc đơn</button>
    </>
  )
}

function setup(path = '/') {
  const client = new QueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <EntryRedirect>
            <Controls />
          </EntryRedirect>
        ),
      },
      { path: '/auth/google', element: <GoogleCallbackPage /> },
      {
        path: '/orders',
        element: (
          <RequireAuth>
            <Controls />
          </RequireAuth>
        ),
      },
      {
        path: '/login',
        element: (
          <>
            <p>Trang đăng nhập</p>
            <LoginPage />
          </>
        ),
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
  return { client, router }
}

beforeEach(() => {
  vi.stubGlobal('fetch', request)
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  sessionStore.set(null)
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

it('khởi động bằng GET /me, 401 trên trang công khai là khách và giữ nguyên URL', async () => {
  request.mockResolvedValueOnce(response(401))
  const { router } = setup('/?q=1')
  expect(await screen.findByText('khách')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('session-status')).toHaveTextContent('ready'))
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/me',
    expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
  )
  expect(router.state.location.search).toBe('?q=1')
  expect(toast.error).not.toHaveBeenCalled()
})

it.each(['mạng', '503'])('lỗi %s giữ người dùng, chờ thử lại trước khi chạy guard', async (cause) => {
  sessionStore.set(buyer)
  if (cause === '503') request.mockResolvedValueOnce(response(503))
  else request.mockRejectedValueOnce(new TypeError('offline'))
  const { router } = setup('/orders')
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa kiểm tra được phiên')
  expect(sessionStore.get()).toEqual(buyer)
  expect(router.state.location.pathname).toBe('/orders')
  request.mockResolvedValueOnce(response(200, buyer))
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByText(buyer.id)).toBeInTheDocument()
})

it('mất phiên khi đọc đơn thì xoá cache và guard giữ đầy đủ đường dẫn quay lại', async () => {
  request.mockResolvedValueOnce(response(200, buyer)).mockResolvedValueOnce(response(401))
  const { client, router } = setup('/orders?tab=open#seat')
  await screen.findByText(buyer.id)
  client.setQueryData(['ticket-qr', 'old'], 'private')
  fireEvent.click(screen.getByText('Đọc đơn'))
  await screen.findByText('Trang đăng nhập')
  expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/orders?tab=open#seat')
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

it('login chỉ nhận user, xoá cache tài khoản trước và phát tín hiệu không chứa user', async () => {
  request.mockResolvedValueOnce(response(200, buyer)).mockResolvedValueOnce(response(200, { user: other }))
  const { client } = setup()
  await screen.findByText(buyer.id)
  client.setQueryData(['/orders'], ['private'])
  fireEvent.click(screen.getByText('Vào'))
  await screen.findByText(other.id)
  expect(sessionStore.get()).toEqual(other)
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(localStorage.getItem(SESSION_SIGNAL)).toMatch(/^[\da-f-]{36}$/i)
  expect(localStorage.length).toBe(1)
})

it.each(['204', '401', 'mạng'])('logout trả %s vẫn xoá user và cache', async (result) => {
  request.mockResolvedValueOnce(response(200, buyer))
  if (result === 'mạng') request.mockRejectedValueOnce(new TypeError('offline'))
  else request.mockResolvedValueOnce(new Response(null, { status: Number(result) }))
  const { client } = setup()
  await screen.findByText(buyer.id)
  client.setQueryData(['/me/sessions'], ['private'])
  fireEvent.click(screen.getByText('Ra'))
  await screen.findByText('khách')
  expect(request.mock.calls[1]).toEqual(['/api/v1/auth/logout', expect.objectContaining({ method: 'POST' })])
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
  if (result === 'mạng') expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('máy chủ'))
  else expect(toast.error).not.toHaveBeenCalled()
})

it('tab nhận đọc lại /me cho mỗi tín hiệu, loại dữ liệu cũ ngay cả khi hai tín hiệu chồng nhau', async () => {
  const late = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(response(200, other))
    .mockResolvedValueOnce(response(401))
  const { client } = setup()
  await screen.findByText(buyer.id)
  const signal = () => fireEvent(window, new StorageEvent('storage', { key: SESSION_SIGNAL, newValue: 'changed' }))
  client.setQueryData(['/tickets'], ['old'])
  signal()
  expect(screen.getByText(buyer.id)).toBeInTheDocument()
  expect(client.getQueryData(['/tickets'])).toEqual(['old'])
  signal()
  await screen.findByText(other.id)
  expect(client.getQueryData(['/tickets'])).toBeUndefined()
  await act(async () => late.resolve(response(401)))
  expect(sessionStore.get()).toEqual(other)
  client.setQueryData(['/tickets'], ['new'])
  signal()
  await waitFor(() => expect(screen.getByText('khách')).toBeInTheDocument())
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(localStorage.length).toBe(0)
  expect(request.mock.calls.map(([url]) => url)).toEqual(Array(4).fill('/api/v1/me'))
})

it('login sai mật khẩu không xoá phiên, cache hay chuyển trang', async () => {
  request.mockResolvedValueOnce(response(200, buyer)).mockResolvedValueOnce(response(401))
  const { client, router } = setup('/orders?tab=open')
  await screen.findByText(buyer.id)
  client.setQueryData(['/tickets'], ['private'])
  fireEvent.click(screen.getByText('Vào'))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  expect(sessionStore.get()).toEqual(buyer)
  expect(client.getQueryData(['/tickets'])).toEqual(['private'])
  expect(router.state.location.pathname + router.state.location.search).toBe('/orders?tab=open')
  expect(localStorage.length).toBe(0)
})

it('logout vẫn báo các tab khác nếu request khác đã nhận 401 trong lúc chờ', async () => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(401))
  const { client } = setup()
  await screen.findByText(buyer.id)
  client.setQueryData(['/tickets'], ['private'])
  fireEvent.click(screen.getByText('Ra'))
  fireEvent.click(screen.getByText('Đọc đơn'))
  await screen.findByText('khách')
  await act(async () => pending.resolve(new Response(null, { status: 204 })))
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

it('logout trả muộn không xoá phiên vừa đăng nhập lại', async () => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(200, { user: other }))
  const { client } = setup()
  await screen.findByText(buyer.id)
  fireEvent.click(screen.getByText('Ra'))
  fireEvent.click(screen.getByText('Vào'))
  await screen.findByText(other.id)
  const signal = localStorage.getItem(SESSION_SIGNAL)
  client.setQueryData(['/tickets'], ['new'])
  await act(async () => pending.resolve(response(401)))
  expect(sessionStore.get()).toEqual(other)
  expect(client.getQueryData(['/tickets'])).toEqual(['new'])
  expect(localStorage.getItem(SESSION_SIGNAL)).toBe(signal)
})

it.each([buyer, other])('401 của request cũ không xoá phiên đăng nhập lại của $id, cache hay URL', async (account) => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(200, { user: account }))
  const { client, router } = setup('/orders?tab=open#seat')
  await screen.findByText(buyer.id)
  fireEvent.click(screen.getByText('Đọc đơn'))
  fireEvent.click(screen.getByText('Vào'))
  await waitFor(() => expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy())
  client.setQueryData(['/tickets'], ['new-session-ticket'])
  const signal = localStorage.getItem(SESSION_SIGNAL)
  await act(async () => pending.resolve(response(401)))
  expect(sessionStore.get()).toEqual(account)
  expect(screen.getByText(account.id)).toBeInTheDocument()
  expect(client.getQueryData(['/tickets'])).toEqual(['new-session-ticket'])
  expect(router.state.location.pathname + router.state.location.search + router.state.location.hash).toBe(
    '/orders?tab=open#seat',
  )
  expect(localStorage.getItem(SESSION_SIGNAL)).toBe(signal)
  expect(request).toHaveBeenCalledTimes(3)
  expect(toast.error).not.toHaveBeenCalled()
})

it('logout huỷ query đang chạy và không cho phản hồi muộn nạp lại cache riêng', async () => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  const { client } = setup()
  await screen.findByText(buyer.id)
  const query = client.fetchQuery({
    queryKey: ['/tickets'],
    queryFn: ({ signal }) => http('/tickets', { signal }),
  })
  const cancelled = expect(query).rejects.toThrow('CancelledError')
  const signal = request.mock.calls[1][1]?.signal
  fireEvent.click(screen.getByText('Ra'))
  await screen.findByText('khách')
  await cancelled
  expect(signal?.aborted).toBe(true)
  await act(async () => pending.resolve(response(200, ['old-session-ticket'])))
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(client.getMutationCache().getAll()).toHaveLength(0)
})

it('Google redirect đọc GET /me, báo các tab khác rồi về đúng trang đã nhớ', async () => {
  request.mockResolvedValueOnce(response(200, buyer))
  rememberNext('/orders?tab=open#seat')
  const { router } = setup('/auth/google?google_login=success')
  await screen.findByText(buyer.id)
  expect(router.state.location.pathname + router.state.location.search + router.state.location.hash).toBe(
    '/orders?tab=open#seat',
  )
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/me',
    expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
  )
  expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
  expect(sessionStorage.length).toBe(0)
})

it.each(['mạng', '500'])('đồng bộ tab lỗi %s giữ user, form và cache; tín hiệu sau vẫn cập nhật', async (cause) => {
  request.mockResolvedValueOnce(response(200, buyer))
  if (cause === 'mạng') request.mockRejectedValueOnce(new TypeError('offline'))
  else request.mockResolvedValueOnce(response(500))
  request.mockResolvedValueOnce(response(200, other))
  const { client, router } = setup('/orders')
  await screen.findByText(buyer.id)
  client.setQueryData(['/tickets'], ['old'])
  const input = screen.getByRole('textbox', { name: 'Ghi chú' })
  fireEvent.change(input, { target: { value: 'A12, A13' } })
  await act(async () => signalChange())
  expect(sessionStore.get()).toEqual(buyer)
  expect(router.state.location.pathname).toBe('/orders')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByTestId('session-status')).toHaveTextContent('ready')
  expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBe(input)
  expect(input).toHaveValue('A12, A13')
  expect(client.getQueryData(['/tickets'])).toEqual(['old'])
  signalChange()
  await screen.findByText(other.id)
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

it('trang công khai hiện ngay khi /me còn treo và vẫn hiện khi /me trả 500', async () => {
  const pending = deferred<Response>()
  request.mockReturnValueOnce(pending.promise)
  const { router } = setup('/?q=events')
  const input = screen.getByRole('textbox', { name: 'Ghi chú' })
  fireEvent.change(input, { target: { value: 'vé đang chọn' } })
  expect(screen.getByTestId('session-status')).toHaveTextContent('loading')
  expect(screen.queryByLabelText('Đang tải')).not.toBeInTheDocument()
  await act(async () => pending.resolve(response(500)))
  expect(screen.getByTestId('session-status')).toHaveTextContent('error')
  expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBe(input)
  expect(input).toHaveValue('vé đang chọn')
  expect(router.state.location.pathname + router.state.location.search).toBe('/?q=events')
})

it('guard chờ /me, lỗi không chuyển trang, thử lại thành công mới hiện trang riêng', async () => {
  const pending = deferred<Response>()
  request.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(200, buyer))
  const { router } = setup('/orders?tab=open#seat')
  expect(screen.getByLabelText('Đang tải')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/orders')
  await act(async () => pending.resolve(response(500)))
  expect(screen.getByRole('alert')).toHaveTextContent('Chưa kiểm tra được phiên')
  expect(router.state.location.pathname).toBe('/orders')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  await screen.findByText(buyer.id)
  expect(router.state.location.pathname + router.state.location.search + router.state.location.hash).toBe(
    '/orders?tab=open#seat',
  )
})

it('guard chỉ chuyển khách về login sau khi /me xác nhận 401', async () => {
  const pending = deferred<Response>()
  request.mockReturnValueOnce(pending.promise)
  const { router } = setup('/orders?tab=open#seat')
  expect(screen.getByLabelText('Đang tải')).toBeInTheDocument()
  await act(async () => pending.resolve(response(401)))
  expect(router.state.location.pathname).toBe('/login')
  expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/orders?tab=open#seat')
  expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
})

it.each([buyer, null])('đồng bộ cùng tài khoản %j giữ nguyên component và cả hai cache', async (account) => {
  const pending = deferred<Response>()
  request.mockResolvedValueOnce(response(account ? 200 : 401, account)).mockReturnValueOnce(pending.promise)
  const { client } = setup(account ? '/orders' : '/')
  await waitFor(() => expect(screen.getByTestId('session-status')).toHaveTextContent('ready'))
  const input = screen.getByRole('textbox', { name: 'Ghi chú' })
  fireEvent.change(input, { target: { value: 'ghế A12' } })
  client.setQueryData(['/tickets'], ['cached'])
  const mutation = client.getMutationCache().build(client, { mutationKey: ['draft'] })
  signalChange()
  expect(screen.getByTestId('session-status')).toHaveTextContent('ready')
  expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBe(input)
  expect(input).toHaveValue('ghế A12')
  expect(client.getQueryData(['/tickets'])).toEqual(['cached'])
  await act(async () => pending.resolve(response(account ? 200 : 401, account)))
  expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBe(input)
  expect(input).toHaveValue('ghế A12')
  expect(client.getQueryData(['/tickets'])).toEqual(['cached'])
  expect(client.getMutationCache().getAll()).toEqual([mutation])
})

it('đổi user qua tab khác xoá cache và huỷ query; phản hồi cũ không nạp cache của user mới', async () => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(200, other))
  const { client } = setup('/orders')
  await screen.findByText(buyer.id)
  client.setQueryData(['/me/sessions'], ['old'])
  client.getMutationCache().build(client, { mutationKey: ['old-mutation'] })
  const query = client.fetchQuery({ queryKey: ['/tickets'], queryFn: ({ signal }) => http('/tickets', { signal }) })
  const cancelled = expect(query).rejects.toThrow('CancelledError')
  signalChange()
  await screen.findByText(other.id)
  await cancelled
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(client.getMutationCache().getAll()).toHaveLength(0)
  client.setQueryData(['/tickets'], ['new'])
  await act(async () => pending.resolve(response(200, ['old'])))
  expect(client.getQueryData(['/tickets'])).toEqual(['new'])
})

it('401 cũ sau tín hiệu tab không xoá user đang kiểm; /me mới quyết định tài khoản', async () => {
  const old = deferred<Response>()
  const check = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(check.promise)
  const { client } = setup('/orders')
  await screen.findByText(buyer.id)
  client.setQueryData(['/tickets'], ['old'])
  fireEvent.click(screen.getByText('Đọc đơn'))
  signalChange()
  await act(async () => old.resolve(response(401)))
  expect(screen.getByText(buyer.id)).toBeInTheDocument()
  expect(client.getQueryData(['/tickets'])).toEqual(['old'])
  await act(async () => check.resolve(response(200, other)))
  expect(screen.getByText(other.id)).toBeInTheDocument()
  expect(client.getQueryCache().getAll()).toHaveLength(0)
})

it.each(['/login', '/auth/google?google_login=success'])(
  'lỗi kiểm phiên tại %s cho thử lại mà không mất next',
  async (path) => {
    request.mockResolvedValueOnce(response(500)).mockResolvedValueOnce(response(path === '/login' ? 401 : 200, buyer))
    rememberNext('/orders?tab=open#seat')
    const { router } = setup(path)
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa kiểm tra được phiên')
    expect(router.state.location.pathname).toBe(path.split('?')[0])
    expect(sessionStorage.length).toBe(1)
    expect(localStorage.length).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    if (path === '/login') {
      expect(await screen.findByRole('textbox', { name: 'Email' })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/login')
    } else {
      await screen.findByText(buyer.id)
      expect(router.state.location.pathname + router.state.location.search + router.state.location.hash).toBe(
        '/orders?tab=open#seat',
      )
      expect(sessionStorage.length).toBe(0)
      expect(localStorage.getItem(SESSION_SIGNAL)).toBeTruthy()
    }
  },
)

it('đăng nhập cũ trả muộn sau khi đổi user không ghi lại user hay cache của phiên trước', async () => {
  const pending = deferred<Response>()
  request
    .mockResolvedValueOnce(response(200, buyer))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(200, other))
  const { client } = setup()
  await screen.findByText(buyer.id)
  fireEvent.click(screen.getByText('Vào'))
  signalChange()
  await screen.findByText(other.id)
  client.setQueryData(['/tickets'], ['new'])
  await act(async () => pending.resolve(response(200, { user: buyer })))
  expect(sessionStore.get()).toEqual(other)
  expect(client.getQueryData(['/tickets'])).toEqual(['new'])
  expect(localStorage.length).toBe(0)
})

it('đồng bộ đăng xuất xoá hai cache và để guard giữ đường dẫn về lại', async () => {
  request.mockResolvedValueOnce(response(200, buyer)).mockResolvedValueOnce(response(401))
  const { client, router } = setup('/orders?tab=open#seat')
  await screen.findByText(buyer.id)
  client.setQueryData(['/tickets'], ['old'])
  client.getMutationCache().build(client, { mutationKey: ['old'] })
  signalChange()
  await screen.findByRole('textbox', { name: 'Email' })
  expect(router.state.location.pathname).toBe('/login')
  expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/orders?tab=open#seat')
  expect(client.getQueryCache().getAll()).toHaveLength(0)
  expect(client.getMutationCache().getAll()).toHaveLength(0)
})

it.each([200, 401, 500])(
  '/me ban đầu trả muộn %i không thay user vừa đăng nhập, cache hoặc trạng thái',
  async (status) => {
    const pending = deferred<Response>()
    request.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(200, { user: other }))
    const { client } = setup()
    fireEvent.click(screen.getByText('Vào'))
    await screen.findByText(other.id)
    client.setQueryData(['/tickets'], ['new'])
    await act(async () => pending.resolve(response(status, buyer)))
    expect(screen.getByTestId('session-status')).toHaveTextContent('ready')
    expect(sessionStore.get()).toEqual(other)
    expect(client.getQueryData(['/tickets'])).toEqual(['new'])
  },
)
