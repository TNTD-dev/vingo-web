import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import { getListAttendeesQueryKey } from '@/api/generated/endpoints/attendees/attendees'
import { deferred } from '@/test/deferred'
import CheckoutPage from './CheckoutPage'

vi.mock('@/realtime/useMeStream', () => ({ useMeStream: () => {} }))
vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ user: null }) }))
const original = { full_name: 'Tên trên đơn', email: 'order@example.test', phone: '+84912345678' }
const people = [
  { id: 'full', full_name: 'Minh An', email: 'an@example.test', phone: '+84976543210' },
  { id: 'partial', full_name: 'Bình An', email: null, phone: null },
  { id: 'email', full_name: 'Linh An', email: 'linh@example.test' },
  { id: 'phone', full_name: 'Ngọc An', phone: '+84987654321' },
]
const choose = (id: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value: id } })
const pay = () => fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }))
const edit = (field: string, value: string) => fireEvent.change(screen.getByLabelText(field), { target: { value } })
const ordersPath = '/api/v1/orders/order1'

function setup(profiles: () => Response | Promise<Response>) {
  const payment = vi.fn<() => Response>().mockImplementation(() => new Response(null, { status: 503 }))
  const request = vi.fn<typeof fetch>(async (url) => {
    if (url === ordersPath)
      return Response.json({
        id: 'order1',
        status: 'PENDING',
        expires_at: new Date(Date.now() + 600000).toISOString(),
        buyer: original,
      })
    if (url === '/api/v1/me/attendees') return profiles()
    if (url === ordersPath + '/payments') return payment()
    throw new Error('Đường dẫn API ngoài dự kiến')
  })
  vi.stubGlobal('fetch', request)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/orders/order1/checkout']}>
        <Routes>
          <Route path="/orders/:orderId/checkout" element={<CheckoutPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const payments = () =>
    request.mock.calls
      .filter(([url]) => url === ordersPath + '/payments')
      .map(([, init]) => ({
        key: new Headers(init?.headers).get('Idempotency-Key'),
        body: JSON.parse(String(init?.body)),
      }))
  return { client, payment, payments }
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('chỉ điền khi chọn, giữ từng ô tuỳ chọn bỏ trống và giữ phần sửa tay khi tải lại', async () => {
  const loading = deferred<Response>()
  const list = vi
    .fn<() => Promise<Response>>()
    .mockReturnValueOnce(loading.promise)
    .mockImplementation(async () => Response.json(people))
  const { client, payment } = setup(list)
  await screen.findByDisplayValue(original.full_name)
  edit('Email nhận vé', 'typed@example.test')
  expect(screen.queryByRole('combobox')).toBeNull()
  loading.resolve(Response.json(people))
  await screen.findByRole('combobox', { name: 'Chọn người nhận đã lưu' })
  expect(screen.getByLabelText('Họ và tên')).toHaveValue(original.full_name)
  choose('partial')
  expect(screen.getByLabelText('Họ và tên')).toHaveValue('Bình An')
  expect(screen.getByLabelText('Email nhận vé')).toHaveValue('typed@example.test')
  expect(screen.getByLabelText('Số điện thoại')).toHaveValue(original.phone)
  choose('email')
  expect(screen.getByLabelText('Email nhận vé')).toHaveValue('linh@example.test')
  expect(screen.getByLabelText('Số điện thoại')).toHaveValue(original.phone)
  choose('phone')
  expect(screen.getByLabelText('Email nhận vé')).toHaveValue('linh@example.test')
  expect(screen.getByLabelText('Số điện thoại')).toHaveValue('+84987654321')
  choose('full')
  expect(screen.getByLabelText('Email nhận vé')).toHaveValue(people[0].email)
  expect(screen.getByLabelText('Số điện thoại')).toHaveValue(people[0].phone)
  edit('Họ và tên', 'Tên sửa tay')
  await act(() => client.invalidateQueries({ queryKey: getListAttendeesQueryKey() }))
  expect(screen.getByLabelText('Họ và tên')).toHaveValue('Tên sửa tay')
  expect(payment).not.toHaveBeenCalled()
  pay()
  await waitFor(() => expect(payment).toHaveBeenCalledTimes(1))
})

it.each([200, 503])('ẩn ô chọn khi danh sách rỗng hoặc lỗi (%i), vẫn gửi buyer của đơn', async (status) => {
  const { client, payments } = setup(() => Response.json([], { status }))
  await screen.findByDisplayValue(original.full_name)
  await waitFor(() =>
    expect(client.getQueryState(getListAttendeesQueryKey())?.status).toBe(status === 200 ? 'success' : 'error'),
  )
  expect(screen.queryByRole('combobox')).toBeNull()
  pay()
  await waitFor(() => expect(payments()).toMatchObject([{ body: { buyer: original } }]))
})

it('retry cùng buyer dùng lại khoá, chọn hồ sơ hoặc sửa tay đổi buyer thì đổi khoá, chỉ gửi buyer', async () => {
  const { payments } = setup(() => Response.json(people))
  await screen.findByRole('combobox')
  async function payAndWait(count: number) {
    pay()
    await waitFor(() => expect(payments()).toHaveLength(count))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thanh toán' })).toBeEnabled())
  }
  await payAndWait(1)
  await payAndWait(2)
  choose('full')
  await payAndWait(3)
  edit('Số điện thoại', '0976 543 210')
  await payAndWait(4)
  edit('Họ và tên', 'Tên khác')
  await payAndWait(5)
  const [first, retry, chosen, formatted, edited] = payments()
  expect(first.key).toBeTruthy()
  expect(retry.key).toBe(first.key)
  expect(chosen.key).toBeTruthy()
  expect(chosen.key).not.toBe(first.key)
  expect(formatted.key).toBe(chosen.key)
  expect(edited.key).toBeTruthy()
  expect(edited.key).not.toBe(chosen.key)
  expect(chosen.body).toEqual({ buyer: { full_name: 'Minh An', email: people[0].email, phone: people[0].phone } })
  expect(edited.body).toEqual({ buyer: { ...chosen.body.buyer, full_name: 'Tên khác' } })
})

it('mở lại thanh toán đã tạo cho cùng buyer và gửi yêu cầu mới khi đổi người nhận', async () => {
  const { payment } = setup(() => Response.json(people))
  payment.mockImplementation(() => Response.json({ order_id: 'order1', payment_url: 'https://example.test/pay' }))
  await screen.findByRole('combobox')
  pay()
  fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
  pay()
  fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
  expect(payment).toHaveBeenCalledTimes(1)
  choose('full')
  pay()
  await screen.findByRole('dialog')
  expect(payment).toHaveBeenCalledTimes(2)
})
