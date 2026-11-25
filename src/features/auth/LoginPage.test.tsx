import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/api/generated/model'
import { AuthContext, type AuthState } from '@/auth/auth-context'
import LoginPage from './LoginPage'

function setup(role: User['role'], path = '/login', status: AuthState['status'] = 'ready') {
  const retry = vi.fn()
  const login = vi.fn().mockResolvedValue({ id: 'u', role })
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/admin', element: <>dashboard</> },
      { path: '/admin/orders', element: <>quản lý đơn</> },
      { path: '/events', element: <>sự kiện</> },
      { path: '/orders', element: <>đơn của tôi</> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ status, retry, user: null, login, logout: async () => {} }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { router, login, retry }
}
async function submit(admin = false) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: admin ? 'Email công việc' : 'Email' }), 'admin@vingo.test')
  await user.type(screen.getByLabelText('Mật khẩu'), 'example-password')
  await user.click(screen.getByRole('button', { name: /^Đăng nhập$/ }))
}
describe('điều hướng sau login', () => {
  it.each([
    ['ADMIN', '/login', '/admin'],
    ['BUYER', '/login', '/events'],
    ['ADMIN', '/login?next=%2Fadmin%2Forders', '/admin/orders'],
    ['BUYER', '/login?next=%2Forders', '/orders'],
    ['BUYER', '/login?next=%2Fadmin', '/events'],
  ] as const)('%s đăng nhập tại %s về %s từ response mới', async (role, path, target) => {
    const { router } = setup(role, path)
    await submit()
    await waitFor(() => expect(router.state.location.pathname).toBe(target))
    expect(router.state.historyAction).toBe('REPLACE')
  })
})

it('chưa biết phiên thì đợi kiểm tra trước khi nhận mật khẩu', () => {
  const { login, router } = setup('BUYER', '/login?next=%2Forders', 'loading')
  expect(screen.getByLabelText('Đang tải')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
  expect(router.state.location.search).toBe('?next=%2Forders')
  expect(login).not.toHaveBeenCalled()
})

it('lỗi kiểm phiên có nút thử lại và giữ nguyên địa chỉ quay lại', () => {
  const { retry, login, router } = setup('BUYER', '/login?next=%2Forders', 'error')
  expect(screen.getByRole('alert')).toHaveTextContent('Chưa kiểm tra được phiên')
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(login).not.toHaveBeenCalled()
  expect(router.state.location.pathname + router.state.location.search).toBe('/login?next=%2Forders')
})
