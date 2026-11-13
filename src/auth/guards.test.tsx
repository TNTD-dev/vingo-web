import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { User } from '@/api/generated/model'

import { AuthContext, type AuthState } from './auth-context'
import { RequireAuth } from './guards'

function renderAt(path: string, user: User | null) {
  const auth: AuthState = { ready: true, user, login: async () => {}, logout: async () => {} }
  const router = createMemoryRouter(
    [
      { path: '/admin', element: <RequireAuth allow="ADMIN">trang admin</RequireAuth> },
      { path: '/orders', element: <RequireAuth>đơn của tôi</RequireAuth> },
      { path: '/login', element: <>trang login</> },
      { path: '/admin/login', element: <>đăng nhập quản trị</> },
      { path: '/403', element: <>không có quyền</> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

describe('RequireAuth', () => {
  it('chưa đăng nhập vào admin thì dùng trang đăng nhập quản trị và giữ địa chỉ quay lại', () => {
    const router = renderAt('/admin?tab=events', null)
    expect(screen.getByText('đăng nhập quản trị')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2Fadmin%3Ftab%3Devents')
  })

  it('chưa đăng nhập thì chuyển về /login kèm next', () => {
    const router = renderAt('/orders', null)
    expect(screen.getByText('trang login')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?next=%2Forders')
  })

  it('BUYER vào /admin thì bị chuyển sang /403', () => {
    renderAt('/admin', { id: 'u1', role: 'BUYER' })
    expect(screen.getByText('không có quyền')).toBeInTheDocument()
  })

  it('ADMIN vào được /admin', () => {
    renderAt('/admin', { id: 'u2', role: 'ADMIN' })
    expect(screen.getByText('trang admin')).toBeInTheDocument()
  })
})
