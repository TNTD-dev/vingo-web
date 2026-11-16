import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminLayout } from './AdminLayout'

vi.mock('@/auth/auth-context', () => ({
  useAuth: () => ({ user: { full_name: 'Admin Test', email: 'admin@vingo.test' }, logout: vi.fn() }),
}))
vi.mock('@/design/MascotLive', () => ({ MascotLive: () => null }))

function setup() {
  const router = createMemoryRouter(
    [{ path: '/admin', element: <AdminLayout />, children: [{ index: true, element: <p>Nội dung</p> }] }],
    { initialEntries: ['/admin'] },
  )
  render(<RouterProvider router={router} />)
}
const sidebar = () => document.querySelector('.admin-sidebar')!

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('Thanh bên quản trị', () => {
  it('thu gọn còn icon, tên mục vẫn đọc được, mở rộng lại được', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh bên' }))
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByRole('link', { name: 'Đơn hàng' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mở rộng thanh bên' }))
    expect(sidebar()).not.toHaveAttribute('data-collapsed')
  })
  it('nhớ trạng thái thu gọn cho lần mở sau', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thu gọn thanh bên' }))
    cleanup()
    setup()
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true')
  })
  it('⌘B thu gọn và mở rộng thanh bên', () => {
    setup()
    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(sidebar()).toHaveAttribute('data-collapsed', 'true')
    fireEvent.keyDown(window, { key: 'b', metaKey: true })
    expect(sidebar()).not.toHaveAttribute('data-collapsed')
  })
})
