import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AdminLayout } from './AdminLayout'

vi.mock('@/auth/auth-context', () => ({
  useAuth: () => ({ user: { full_name: 'Admin Test', email: 'admin@vingo.test' }, logout: vi.fn() }),
}))
vi.mock('@/design/MascotLive', () => ({ MascotLive: () => null }))

function setup(path = '/admin') {
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <p>Nội dung</p> },
          { path: 'venues/:venueId', element: <p>Sơ đồ</p> },
        ],
      },
      { path: '/admin/copilot', element: <p>Trang Copilot</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
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

describe('Nút Copilot nổi', () => {
  const launcher = () => screen.getByRole<HTMLAnchorElement>('link', { name: /Mở Copilot/ })

  it('kéo chạm để di chuyển, rơi xuống mép dưới và nhớ vị trí khi đổi màn', async () => {
    const router = setup()
    const link = launcher()
    const floating = link.parentElement!
    vi.spyOn(floating, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 400, 220, 91))
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    floating.animate = animate
    fireEvent.pointerDown(link, { button: 0, pointerId: 1, pointerType: 'touch', clientX: 330, clientY: 430 })
    fireEvent.pointerMove(link, { pointerId: 1, pointerType: 'touch', clientX: -300, clientY: -300 })
    expect(floating.style.transform).toBe('translate3d(-288px, -388px, 0px)')
    fireEvent.pointerUp(link, { pointerId: 1, pointerType: 'touch', clientX: -300, clientY: -300 })
    fireEvent.click(link, { detail: 1 })
    expect(router.state.location.pathname).toBe('/admin')
    expect(floating.style.transform).toBe('')
    expect(floating.style.translate).toBe('0% -100%')
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ transform: expect.stringMatching(/^translateY\(-\d+px\)$/), offset: 0 }),
        { transform: 'translateY(0)', offset: 1 },
      ]),
      expect.any(Number),
    )

    cleanup()
    setup('/admin/venues/v1')
    expect(launcher().parentElement!.style.translate).toBe('0% -100%')
    fireEvent.keyDown(launcher(), { key: 'Home' })
    expect(launcher().parentElement!.style.translate).toBe('')
    fireEvent.click(launcher())
    expect(await screen.findByText('Trang Copilot')).toBeInTheDocument()
  })

  it('ẩn rồi hiện lại ô Mở Copilot, và nhớ lựa chọn qua lần mở sau', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn ô Mở Copilot' }))
    expect(screen.queryByText('Mở Copilot', { exact: true })).not.toBeInTheDocument()
    expect(launcher()).toHaveAttribute('href', '/admin/copilot')

    cleanup()
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện ô Mở Copilot' }))
    expect(screen.getByText('Mở Copilot', { exact: true })).toBeInTheDocument()
  })
})
