import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'

import GoogleCallbackPage from './GoogleCallbackPage'
import { rememberNext } from './googleCallback'

const refreshSession = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
vi.mock('@/api/http', () => ({ refreshSession }))

function renderAt(search: string, user: User | null) {
  const router = createMemoryRouter(
    [
      { path: '/auth/google', element: <GoogleCallbackPage /> },
      { path: '/', element: <>trang chủ</> },
      { path: '/orders', element: <>đơn của tôi</> },
      { path: '/login', element: <>trang login</> },
    ],
    { initialEntries: [`/auth/google${search}`] },
  )
  render(
    <AuthContext.Provider value={{ ready: true, user, login: async () => {}, logout: async () => {} }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

describe('GoogleCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    refreshSession.mockReset()
  })

  it('đang làm mới phiên thì hiện trạng thái đang đăng nhập', () => {
    refreshSession.mockReturnValue(new Promise(() => {}))
    renderAt('?google_login=success', null)
    expect(screen.getByText('Đang đăng nhập…')).toBeInTheDocument()
  })

  it('đã có phiên thì về trang trước đó', async () => {
    rememberNext('/orders')
    refreshSession.mockResolvedValue(true)
    const router = renderAt('?google_login=created', { id: 'u1', role: 'BUYER' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
  })

  it('không nhớ trang nào thì về trang chủ', async () => {
    refreshSession.mockResolvedValue(true)
    const router = renderAt('?google_login=success', { id: 'u1', role: 'BUYER' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('làm mới phiên thất bại thì báo lỗi, không kẹt ở đang đăng nhập', async () => {
    refreshSession.mockResolvedValue(false)
    renderAt('?google_login=success', null)
    expect(await screen.findByText('Chưa đăng nhập được')).toBeInTheDocument()
    expect(screen.queryByText('Đang đăng nhập…')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ })).toHaveAttribute('href', '/login')
  })

  it('email_taken hiện câu báo và không gọi làm mới phiên', () => {
    renderAt('?google_login=email_taken', null)
    expect(screen.getByRole('alert')).toHaveTextContent('đã đăng ký bằng mật khẩu')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('failed hiện câu báo kèm nút về /login', () => {
    renderAt('?google_login=failed', null)
    expect(screen.getByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
    expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ })).toHaveAttribute('href', '/login')
  })
})
