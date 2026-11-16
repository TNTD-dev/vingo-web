import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'
import LoginPage from './LoginPage'
import AdminLoginPage from '@/features/admin-ops/AdminLoginPage'

function setup(role: User['role'], path = '/login') {
  const login = vi.fn().mockResolvedValue({ id: 'u', role })
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/admin/login', element: <AdminLoginPage /> },
      { path: '/admin', element: <>dashboard</> },
      { path: '/admin/orders', element: <>quản lý đơn</> },
      { path: '/events', element: <>sự kiện</> },
      { path: '/orders', element: <>đơn của tôi</> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ ready: true, user: null, login, logout: async () => {} }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { router, login }
}
async function submit(admin = false) {
  const user = userEvent.setup()
  await user.type(
    screen.getByRole('textbox', { name: admin ? 'Email công việc' : 'Email hoặc số điện thoại' }),
    'admin@vingo.test',
  )
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
  it('cổng admin vẫn chuyển ADMIN về dashboard', async () => {
    const { router } = setup('ADMIN', '/admin/login')
    await submit(true)
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  })
  it('BUYER đăng nhập cổng admin được báo không có quyền', async () => {
    const { router } = setup('BUYER', '/admin/login')
    await submit(true)
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền ADMIN')
    expect(router.state.location.pathname).toBe('/admin/login')
  })
})
