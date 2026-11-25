import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import type { ProblemCode, User } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { SESSION_SIGNAL, sessionStore } from '@/auth/token-store'
import { OtpDialog } from '@/design/OtpDialog'

vi.mock('@/api/generated/endpoints/auth/auth', () => ({ verifyOtp: vi.fn(), resendOtp: vi.fn() }))

const OTP = '482615'
const buyer: User = { id: 'buyer', role: 'BUYER' }
const result = { user: buyer }
const apiError = (status: number, code: ProblemCode, retryAfter?: number) =>
  new ApiError(status, { title: 'Lỗi', status, code }, retryAfter)

afterEach(() => {
  cleanup()
  sessionStore.set(null)
  localStorage.clear()
  vi.resetAllMocks()
})

function setup(sentAt = 0) {
  const onVerified = vi.fn()
  const onResent = vi.fn()
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <OtpDialog
          open={open}
          onOpenChange={setOpen}
          onVerified={onVerified}
          onResent={onResent}
          session={{ sessionId: 'email-session', email: 'buyer@gmail.com', sentAt }}
        />
        <button type="button" onClick={() => setOpen(true)}>
          Mở lại
        </button>
      </>
    )
  }
  render(<Harness />)
  return { onVerified, onResent }
}

const press = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }))

function enterOtp(value = OTP) {
  const inputs = screen.getAllByRole('textbox', { name: /Chữ số/ })
  ;[...value].forEach((digit, i) => fireEvent.change(inputs[i], { target: { value: digit } }))
}

describe('OtpDialog xác thực email', () => {
  it('che email, đếm ngược gửi lại, xác thực xong thì đăng nhập và báo khi bấm Tiếp tục', async () => {
    vi.mocked(verifyOtp).mockResolvedValue(result)
    const { onVerified } = setup(Date.now())
    expect(screen.getByRole('dialog')).toHaveTextContent('b***@gmail.com')
    expect(screen.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
    enterOtp()
    await press('Xác thực')
    expect(await screen.findByRole('heading', { name: 'Đã xác thực email' })).toBeInTheDocument()
    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ otp_session_id: 'email-session', otp: OTP })
    expect(sessionStore.get()).toEqual(buyer)
    expect(localStorage.getItem(SESSION_SIGNAL)).toMatch(/^[\da-f-]{36}$/i)
    expect(localStorage.length).toBe(1)
    expect(onVerified).not.toHaveBeenCalled()
    await press('Tiếp tục')
    expect(onVerified).toHaveBeenCalledExactlyOnceWith(buyer)
  })

  it('gửi lại mã xong thì xác thực bằng phiên mới và báo người gọi lưu phiên mới', async () => {
    vi.mocked(resendOtp).mockResolvedValue({ otp_session_id: 'new-session', expires_at: '2026-11-25T03:05:00Z' })
    vi.mocked(verifyOtp).mockResolvedValue(result)
    const { onResent } = setup()
    await press('Gửi lại mã')
    expect(resendOtp).toHaveBeenCalledExactlyOnceWith({ otp_session_id: 'email-session' })
    expect(await screen.findByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
    expect(onResent).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'new-session',
      sentAt: expect.any(Number),
      expiresAt: '2026-11-25T03:05:00Z',
    })
    enterOtp()
    await press('Xác thực')
    expect(verifyOtp).toHaveBeenCalledExactlyOnceWith({ otp_session_id: 'new-session', otp: OTP })
  })

  it('gửi lại lỗi thì giữ phiên cũ và chờ theo Retry-After', async () => {
    vi.mocked(resendOtp).mockRejectedValue(apiError(429, 'RATE_LIMITED', 45))
    vi.mocked(verifyOtp).mockResolvedValue(result)
    const { onResent } = setup()
    await press('Gửi lại mã')
    expect(await screen.findByRole('alert')).toHaveTextContent('45 giây')
    expect(screen.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
    expect(onResent).not.toHaveBeenCalled()
    enterOtp()
    await press('Xác thực')
    expect(verifyOtp).toHaveBeenCalledWith({ otp_session_id: 'email-session', otp: OTP })
  })

  it.each(['OTP_INVALID', 'OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS'] as const)('%s hiện lỗi và xoá ô mã', async (code) => {
    vi.mocked(verifyOtp).mockRejectedValue(apiError(400, code))
    const { onVerified } = setup()
    enterOtp()
    await press('Xác thực')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    for (const input of screen.getAllByRole('textbox', { name: /Chữ số/ })) expect(input).toHaveValue('')
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('đóng rồi mở lại vẫn giữ mã đang nhập, chưa đủ sáu số thì không gửi được', async () => {
    setup()
    enterOtp('4826')
    expect(screen.getByRole('button', { name: 'Xác thực' })).toBeDisabled()
    await press('Để sau')
    await press('Mở lại')
    expect(screen.getByRole('textbox', { name: 'Chữ số 4' })).toHaveValue('6')
    expect(resendOtp).not.toHaveBeenCalled()
  })
})
