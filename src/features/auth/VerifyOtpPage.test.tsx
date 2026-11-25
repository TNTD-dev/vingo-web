import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'
import type { OtpDialogProps } from '@/design/OtpDialog'

import { loadOtpSession, saveOtpSession } from './otpSession'
import VerifyOtpPage from './VerifyOtpPage'

const buyer: User = { id: 'buyer', role: 'BUYER', email: 'buyer@gmail.com' }

vi.mock('@/design/OtpDialog', () => ({
  OtpDialog: ({ open, session, onResent, onVerified }: OtpDialogProps) =>
    open ? (
      <div role="dialog" data-session={session.sessionId}>
        <button type="button" onClick={() => onResent({ sessionId: 'resent', sentAt: 9 })}>
          gửi lại
        </button>
        <button type="button" onClick={() => onVerified({ id: 'buyer', role: 'BUYER' })}>
          xong
        </button>
      </div>
    ) : null,
}))

afterEach(() => sessionStorage.clear())

function setup(user: User | null, path = '/verify-otp') {
  const router = createMemoryRouter(
    [
      { path: '/verify-otp', element: <VerifyOtpPage /> },
      { path: '/register', element: <>đăng ký</> },
      { path: '/events', element: <>sự kiện</> },
      { path: '/orders', element: <>đơn</> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider
      value={{ status: 'ready', retry: vi.fn(), user, login: async () => buyer, logout: async () => {} }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

describe('VerifyOtpPage', () => {
  it('không có phiên và chưa đăng nhập thì về đăng ký', () => {
    expect(setup(null).state.location.pathname).toBe('/register')
  })

  it('không có phiên nhưng đã đăng nhập thì sang trang đích', () => {
    expect(setup(buyer, '/verify-otp?next=%2Forders').state.location.pathname).toBe('/orders')
  })

  it('chỉ yêu cầu email; xác thực xong xoá phiên và sang trang đích', () => {
    saveOtpSession({ sessionId: 's1', email: 'buyer@gmail.com', sentAt: 1, next: '/orders' })
    const router = setup(null)
    expect(screen.getByText(/b\*\*\*@gmail.com/)).toBeInTheDocument()
    expect(screen.queryByText(/số điện thoại/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực email' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-session', 's1')
    fireEvent.click(screen.getByRole('button', { name: 'xong' }))
    expect(loadOtpSession()).toBeNull()
    expect(router.state.location.pathname).toBe('/orders')
  })

  it('gửi lại mã thì lưu phiên mới để tải lại trang vẫn dùng được', () => {
    saveOtpSession({ sessionId: 's1', email: 'buyer@gmail.com', sentAt: 1, next: '/orders' })
    setup(null)
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực email' }))
    fireEvent.click(screen.getByRole('button', { name: 'gửi lại' }))
    expect(loadOtpSession()).toMatchObject({
      sessionId: 'resent',
      sentAt: 9,
      email: 'buyer@gmail.com',
      next: '/orders',
    })
  })

  it('phiên mới vẫn bắt xác thực dù trình duyệt còn đăng nhập tài khoản cũ', () => {
    saveOtpSession({ sessionId: 's2', email: 'moi@gmail.com', sentAt: 1 })
    setup(buyer)
    expect(screen.getByRole('button', { name: 'Xác thực email' })).toBeInTheDocument()
  })
})
