import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'

import GoogleCallbackPage from './GoogleCallbackPage'
import { rememberNext } from './googleCallback'

const signal = vi.hoisted(() => vi.fn())
vi.mock('@/auth/token-store', () => ({ signalSessionChange: signal }))

function renderAt(search: string, user: User | null, ready = true) {
  const router = createMemoryRouter(
    [
      { path: '/auth/google', element: <GoogleCallbackPage /> },
      { path: '/', element: <>trang chủ</> },
      { path: '/events', element: <>sự kiện</> },
      { path: '/admin', element: <>quản trị</> },
      { path: '/orders', element: <>đơn của tôi</> },
      { path: '/login', element: <>trang login</> },
    ],
    { initialEntries: [`/auth/google${search}`] },
  )
  render(
    <AuthContext.Provider
      value={{
        status: ready ? 'ready' : 'loading',
        retry: vi.fn(),
        user,
        login: async () => ({ id: 'u1', role: 'BUYER' }),
        logout: async () => {},
      }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

describe('GoogleCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    signal.mockClear()
  })

  it('đang làm mới phiên thì hiện trạng thái đang đăng nhập', () => {
    renderAt('?google_login=success', null, false)
    expect(screen.getByText('Đang đăng nhập…')).toBeInTheDocument()
  })

  it('đã có phiên thì về trang trước đó', async () => {
    rememberNext('/orders')
    const router = renderAt('?google_login=created', { id: 'u1', role: 'BUYER' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
    expect(signal).toHaveBeenCalled()
  })

  it('không nhớ trang nào thì về sự kiện', async () => {
    const router = renderAt('?google_login=success', { id: 'u1', role: 'BUYER' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/events'))
  })

  it('làm mới phiên thất bại thì báo lỗi, không kẹt ở đang đăng nhập', async () => {
    renderAt('?google_login=success', null)
    expect(await screen.findByText('Chưa đăng nhập được')).toBeInTheDocument()
    expect(screen.queryByText('Đang đăng nhập…')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ })).toHaveAttribute('href', '/login')
  })

  it('email_taken hiện câu báo và không gọi làm mới phiên', () => {
    renderAt('?google_login=email_taken', null)
    expect(screen.getByRole('alert')).toHaveTextContent('đã đăng ký bằng mật khẩu')
    expect(signal).not.toHaveBeenCalled()
  })

  it('failed hiện câu báo kèm nút về /login', () => {
    renderAt('?google_login=failed', null)
    expect(screen.getByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
    expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ })).toHaveAttribute('href', '/login')
  })
})
