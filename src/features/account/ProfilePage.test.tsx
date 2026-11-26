import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { deferred } from '@/test/deferred'
import ProfilePage from './ProfilePage'

vi.mock('@/auth/auth-context', () => ({ useAuth: () => ({ user: { full_name: 'Chủ tài khoản' } }) }))
const request = vi.fn<typeof fetch>()
const path = '/api/v1/me/attendees'
const person = { id: 'p1', full_name: 'An', email: 'an@example.test', phone: '+84912345678' }
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const input = (name: RegExp, value: string) =>
  fireEvent.change(within(screen.getByRole('dialog')).getByRole('textbox', { name }), { target: { value } })

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  )
}
beforeEach(() => vi.stubGlobal('fetch', request))
afterEach(() => {
  cleanup()
  request.mockReset()
  vi.unstubAllGlobals()
})

it('hiện tải, lỗi và danh sách rỗng sau khi thử lại', async () => {
  const loading = deferred<Response>()
  request.mockReturnValueOnce(loading.promise).mockResolvedValueOnce(Response.json([]))
  setup()
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách')
  loading.resolve(new Response(null, { status: 503 }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được')
  click('Thử lại')
  await screen.findByText('Chưa có người đi xem đã lưu.')
})

it('kiểm tra từng trường rồi tạo hồ sơ chỉ có tên, khoá các nút khi gửi', async () => {
  const saving = deferred<Response>()
  request
    .mockResolvedValueOnce(Response.json([]))
    .mockReturnValueOnce(saving.promise)
    .mockResolvedValueOnce(Response.json([{ id: 'p1', full_name: 'An' }]))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm người đi xem' }))
  input(/^Họ và tên/, ' ')
  input(/^Email/, 'an@')
  input(/^Số điện thoại/, '123')
  submit()
  for (const field of within(screen.getByRole('dialog')).getAllByRole('textbox')) {
    expect(field).toHaveAttribute('aria-invalid', 'true')
  }
  expect(request).toHaveBeenCalledTimes(1)
  input(/^Họ và tên/, '  An  ')
  input(/^Email/, '')
  input(/^Số điện thoại/, '')
  submit()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeDisabled())
  expect(screen.getByRole('button', { name: 'Huỷ' })).toBeDisabled()
  expect(request.mock.calls[1]).toEqual([path, expect.objectContaining({ method: 'POST', body: '{"full_name":"An"}' })])
  saving.resolve(Response.json({ id: 'p1', full_name: 'An' }, { status: 201 }))
  expect(await screen.findByRole('button', { name: 'Sửa An' })).toBeEnabled()
})

it('hiện thông tin đã lưu, sửa tên, xoá email và chuẩn hoá số điện thoại', async () => {
  const saving = deferred<Response>()
  const edited = { id: person.id, full_name: 'Bình', phone: '+84987654321' }
  request
    .mockResolvedValueOnce(Response.json([person]))
    .mockReturnValueOnce(saving.promise)
    .mockResolvedValueOnce(Response.json([edited]))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Sửa An' }))
  expect(within(screen.getByRole('dialog')).getByLabelText('Email')).toHaveValue(person.email)
  input(/^Họ và tên/, 'Bình')
  input(/^Email/, '')
  input(/^Số điện thoại/, '0987 654 321')
  submit()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeDisabled())
  expect(request.mock.calls[1]).toEqual([
    path + '/p1',
    expect.objectContaining({
      method: 'PUT',
      body: '{"full_name":"Bình","phone":"+84987654321"}',
    }),
  ])
  saving.resolve(Response.json(edited))
  await screen.findByRole('button', { name: 'Sửa Bình' })
  expect(screen.queryByText(person.email, { exact: false })).toBeNull()
})

it('chỉ xoá sau xác nhận và khoá nút trong lúc đang xoá', async () => {
  const deleting = deferred<Response>()
  request
    .mockResolvedValueOnce(Response.json([person]))
    .mockReturnValueOnce(deleting.promise)
    .mockResolvedValueOnce(Response.json([]))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Xoá An' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('An')
  click('Huỷ')
  expect(request).toHaveBeenCalledTimes(1)
  click('Xoá An')
  click('Xác nhận xoá')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận xoá' })).toBeDisabled())
  expect(request.mock.calls[1]).toEqual([path + '/p1', expect.objectContaining({ method: 'DELETE' })])
  deleting.resolve(new Response(null, { status: 204 }))
  await screen.findByText('Chưa có người đi xem đã lưu.')
})

it('báo rõ giới hạn 20 hồ sơ khi nhận 409 và giữ nội dung đang nhập', async () => {
  request
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(Response.json({ code: 'ACTION_STATE_INVALID' }, { status: 409 }))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm người đi xem' }))
  input(/^Họ và tên/, 'An')
  submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('đủ 20 người đi xem')
  expect(within(screen.getByRole('dialog')).getByLabelText('Họ và tên')).toHaveValue('An')
})

it.each([
  ['Sửa An', 'Lưu hồ sơ'],
  ['Xoá An', 'Xác nhận xoá'],
])('%s nhận 404 thì tải lại danh sách', async (action, confirm) => {
  request
    .mockResolvedValueOnce(Response.json([person]))
    .mockResolvedValueOnce(Response.json({ code: 'NOT_FOUND' }, { status: 404 }))
    .mockResolvedValueOnce(Response.json([]))
  setup()
  fireEvent.click(await screen.findByRole('button', { name: action }))
  click(confirm)
  await screen.findByText('Chưa có người đi xem đã lưu.')
  expect(request.mock.calls[2]).toEqual([path, expect.objectContaining({ method: 'GET' })])
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
