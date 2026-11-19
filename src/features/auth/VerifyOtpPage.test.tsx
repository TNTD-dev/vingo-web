import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'
import type { OtpDialogProps } from '@/design/OtpDialog'

import { saveOtpSession } from './otpSession'
import VerifyOtpPage from './VerifyOtpPage'

// Dialog có test riêng; ở đây chỉ cần biết trang mở kênh nào với tham số nào.
vi.mock('@/design/OtpDialog', () => ({
  OtpDialog: ({ open, channel = 'SMS', initialPhone, emailSession }: OtpDialogProps) =>
    open ? (
      <div role="dialog" aria-label={`otp-${channel}`}>
        {channel}|{initialPhone ?? ''}|{emailSession?.sessionId ?? ''}
      </div>
    ) : null,
}))

const buyer = (extra: Partial<User> = {}): User => ({
  id: 'u',
  role: 'BUYER',
  email: 'buyer@gmail.com',
  phone: '+84912345678',
  phone_verified: false,
  ...extra,
})

function setup(user: User | null, path = '/verify-otp') {
  const router = createMemoryRouter(
    [
      { path: '/verify-otp', element: <VerifyOtpPage /> },
      { path: '/register', element: <>đăng ký</> },
      { path: '/events', element: <>sự kiện</> },
      { path: '/orders', element: <>đơn của tôi</> },
    ],
    { initialEntries: [path] },
  )
  render(
    <AuthContext.Provider value={{ ready: true, user, login: async () => buyer(), logout: async () => {} }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return router
}

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

describe('VerifyOtpPage', () => {
  it('không có phiên đăng ký và chưa đăng nhập thì về trang đăng ký', () => {
    const router = setup(null)
    expect(router.state.location.pathname).toBe('/register')
  })

  it('vừa đăng ký: email mở dialog kênh EMAIL, SĐT bị khoá tới khi xác thực email', () => {
    saveOtpSession({ sessionId: 'email-session', email: 'buyer@gmail.com', sentAt: 1 })
    setup(null)
    expect(screen.getByText(/đã gửi mã 6 số tới b\*\*\*@gmail.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xác thực số điện thoại/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Xác thực email/ }))
    expect(screen.getByRole('dialog', { name: 'otp-EMAIL' })).toHaveTextContent('EMAIL||email-session')
  })

  it('đăng ký email mới khi vẫn đăng nhập tài khoản cũ: email mới chưa được tính là đã xác thực', () => {
    saveOtpSession({ sessionId: 'new-session', email: 'moi@gmail.com', sentAt: 1 })
    setup(buyer({ email: 'cu@gmail.com', phone_verified: true }))
    expect(screen.queryByText('Đã xác thực')).not.toBeInTheDocument()
    expect(screen.getByText(/đã gửi mã 6 số tới m\*\*\*@gmail.com/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xác thực số điện thoại/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Tiếp tục/ })).not.toBeInTheDocument()
  })

  it('số lưu dạng 0968... vẫn hiển thị +84 968 884 ***', () => {
    setup(buyer({ phone: '0968884966' }))
    expect(screen.getByText(/qua SMS tới \+84 968 884 \*\*\*/)).toBeInTheDocument()
  })

  it('email xong: SĐT mở popup với số đã nhập khi đăng ký', () => {
    setup(buyer())
    expect(screen.getAllByText('Đã xác thực')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Xác thực số điện thoại/ }))
    expect(screen.getByRole('dialog', { name: 'otp-SMS' })).toHaveTextContent('SMS|+84912345678|')
    expect(screen.queryByRole('button', { name: /Tiếp tục/ })).not.toBeInTheDocument()
  })

  it('xong cả hai thì Tiếp tục về trang đích an toàn', () => {
    const router = setup(buyer({ phone_verified: true }), '/verify-otp?next=%2Forders')
    expect(screen.getAllByText('Đã xác thực')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục khám phá sự kiện/ }))
    expect(router.state.location.pathname).toBe('/orders')
  })

  it('next ngoài trang web bị bỏ qua', () => {
    const router = setup(buyer({ phone_verified: true }), '/verify-otp?next=%2F%2Fevil.com')
    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục khám phá sự kiện/ }))
    expect(router.state.location.pathname).toBe('/events')
  })
})
