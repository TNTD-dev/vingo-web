import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@/api/generated/model'
import { AuthContext, type AuthState } from './auth-context'
import { EntryRedirect } from './EntryRedirect'

function setup(path: string, user: User | null, ready = true) {
  const router = createMemoryRouter(
    [
      ...['/', '/login', '/admin/login'].map((path) => ({ path, element: <EntryRedirect>trang gốc</EntryRedirect> })),
      { path: '/admin', element: <>dashboard</> },
      { path: '/admin/orders', element: <>quản lý đơn</> },
    ],
    { initialEntries: [path] },
  )
  const auth: AuthState = {
    status: ready ? 'ready' : 'loading',
    retry: vi.fn(),
    user,
    login: async () => ({ id: 'a', role: 'ADMIN' }),
    logout: async () => {},
  }
  const view = (value: AuthState) => (
    <AuthContext.Provider value={value}>
      <RouterProvider router={router} />
    </AuthContext.Provider>
  )
  const result = render(view(auth))
  return {
    router,
    restore: (user: User | null) => result.rerender(view({ ...auth, status: 'ready', retry: vi.fn(), user })),
  }
}
describe('EntryRedirect', () => {
  it.each(['/', '/login', '/admin/login'])('ADMIN có phiên tại %s được chuyển về dashboard', async (path) => {
    const { router } = setup(path, { id: 'a', role: 'ADMIN' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
    expect(router.state.historyAction).toBe('REPLACE')
  })
  it('landing hiện ngay, khôi phục ADMIN xong mới điều hướng', async () => {
    const { router, restore } = setup('/', null, false)
    expect(screen.getByText('trang gốc')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    restore({ id: 'a', role: 'ADMIN' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'))
  })
  it.each([null, { id: 'b', role: 'BUYER' } as User])('khách hoặc BUYER vẫn xem trang chủ', (user) => {
    setup('/', user)
    expect(screen.getByText('trang gốc')).toBeInTheDocument()
  })
  it('giữ deep link khi ADMIN đã đăng nhập', async () => {
    const { router } = setup('/admin/login?next=%2Fadmin%2Forders%3Fstatus%3DPAID', { id: 'a', role: 'ADMIN' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/orders'))
    expect(router.state.location.search).toBe('?status=PAID')
  })
  it('phiên hết hạn vẫn xem được trang đăng nhập', () => {
    const { restore, router } = setup('/login', null, false)
    restore(null)
    expect(screen.getByText('trang gốc')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})
