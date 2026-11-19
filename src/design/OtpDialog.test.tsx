import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, useSyncExternalStore } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resendOtp, verifyOtp } from '@/api/generated/endpoints/auth/auth'
import { requestPhoneOtp, verifyPhoneOtp } from '@/api/generated/endpoints/me/me'
import type { OtpSession, PhoneOtpRequest, PhoneVerifyRequest, ProblemCode, User } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { AuthContext, useAuth } from '@/auth/auth-context'
import { tokenStore } from '@/auth/token-store'
import { OtpDialog, type OtpDialogProps } from '@/design/OtpDialog'
import { captureDemoOtp, takeDemoOtp } from '@/lib/demoOtp'

vi.mock('@/api/generated/endpoints/me/me', () => ({
  requestPhoneOtp: vi.fn(),
  verifyPhoneOtp: vi.fn(),
}))
vi.mock('@/api/generated/endpoints/auth/auth', () => ({
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}))

const PHONE = '+84912345678'
const OTP = '482615'
const buyer: User = { id: 'buyer', role: 'BUYER', phone: PHONE, phone_verified: false }
const verified: User = { ...buyer, phone_verified: true }
const session = { accessToken: 'test-access', refreshToken: 'test-refresh', user: buyer }
const otpSession: OtpSession = {
  otp_session_id: 'phone-session',
  expires_at: '2026-11-18T03:05:00Z',
  channel: 'SMS',
}
const apiError = (status: number, code?: ProblemCode, retryAfter?: number) =>
  new ApiError(status, code ? { title: 'Lỗi', status, code } : null, retryAfter)
const clients: QueryClient[] = []

beforeEach(() => {
  vi.mocked(requestPhoneOtp).mockResolvedValue({
    ...otpSession,
    expires_at: new Date(Date.now() + 300_000).toISOString(),
  })
  vi.mocked(verifyPhoneOtp).mockResolvedValue(verified)
  tokenStore.set(session)
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  tokenStore.set(null)
  vi.unstubAllEnvs()
  takeDemoOtp()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

function AuthProbe() {
  const { user } = useAuth()
  return <output aria-label="Trạng thái xác minh trong useAuth">{String(user?.phone_verified)}</output>
}

function setup(props: Partial<OtpDialogProps> = {}) {
  const onOpenChange = vi.fn()
  const onVerified = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)

  function Harness() {
    const [open, setOpen] = useState(props.open ?? true)
    // Cùng cơ chế đăng ký tokenStore như AuthProvider, không gọi refresh khi dựng test.
    const current = useSyncExternalStore(tokenStore.subscribe, tokenStore.get)
    return (
      <AuthContext.Provider
        value={{ ready: true, user: current?.user ?? null, login: async () => buyer, logout: async () => {} }}
      >
        <OtpDialog
          {...props}
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next)
            setOpen(next)
          }}
          onVerified={onVerified}
        />
        <AuthProbe />
      </AuthContext.Provider>
    )
  }

  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { onOpenChange, onVerified }
}

function enterPhone(phone = '0912 345 678') {
  fireEvent.change(screen.getByRole('textbox', { name: /Số điện thoại/i }), { target: { value: phone } })
}

function enterOtp(code = OTP) {
  for (const [index, digit] of [...code].entries()) {
    fireEvent.change(screen.getByRole('textbox', { name: `Chữ số ${index + 1}` }), {
      target: { value: digit },
    })
  }
}

async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
  })
}

async function requestCode(phone?: string) {
  enterPhone(phone)
  await press('Gửi mã xác minh')
  // Không dùng waitFor với fake timers để tránh treo khi hành vi chưa được cài.
  if (vi.isFakeTimers()) expect(screen.getByRole('heading', { name: 'Nhập mã gồm 6 số' })).toBeInTheDocument()
  else await screen.findByRole('heading', { name: 'Nhập mã gồm 6 số' })
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function startClock() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-18T03:00:00Z'))
  vi.mocked(requestPhoneOtp).mockResolvedValue(otpSession)
}

describe('OtpDialog', () => {
  it('mở bước nhập số, có tiền tố +84 và điền sẵn initialPhone', () => {
    setup({ initialPhone: PHONE })
    expect(screen.getByRole('dialog', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(screen.getByText('// XÁC MINH SỐ ĐIỆN THOẠI')).toBeInTheDocument()
    expect(screen.getByText('+84')).toBeInTheDocument()
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /Số điện thoại/i })
    expect(input.value.replace(/[\s.-]/g, '').replace(/^(\+84|84|0)/, '')).toBe('912345678')
    expect(screen.getByRole('button', { name: 'Gửi mã xác minh' })).toBeEnabled()
    expect(requestPhoneOtp).not.toHaveBeenCalled()
  })

  it('open=false không hiển thị popup và không gọi API', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requestPhoneOtp).not.toHaveBeenCalled()
    expect(verifyPhoneOtp).not.toHaveBeenCalled()
  })

  it.each(['', '123', '0212345678', '+84112345678', '+12025550123', '0912abc678'])(
    'chặn số không hợp lệ %s trước khi gọi API',
    async (phone) => {
      setup()
      enterPhone(phone)
      expect(screen.getByRole('button', { name: 'Gửi mã xác minh' })).toBeDisabled()
      await press('Gửi mã xác minh')
      expect(requestPhoneOtp).not.toHaveBeenCalled()
    },
  )

  it.each(['0912 345 678', '0912.345-678', '+84 912 345 678', '84 912 345 678', '912 345 678'])(
    'gửi số %s qua client sinh sau khi chuẩn hoá và chuyển bước nhập mã',
    async (phone) => {
      setup()
      await requestCode(phone)
      expect(requestPhoneOtp).toHaveBeenCalledTimes(1)
      const body: PhoneOtpRequest = vi.mocked(requestPhoneOtp).mock.calls[0][0]
      // Contract nhận cả 0, 84 và +84; không ép cách chuẩn hoá tiền tố của giao diện.
      expect(body.phone).toMatch(/^(?:0|\+?84)912345678$/)
      expect(body.phone).not.toMatch(/[\s.-]/)
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent?.replace(/\s/g, '')).toContain('+84912345***')
      expect(dialog).toHaveTextContent('có hiệu lực 5 phút')
      expect(dialog).not.toHaveTextContent(PHONE)
    },
  )

  it('vô hiệu nút gửi trong lúc request đang chờ để không gửi trùng', async () => {
    let resolveRequest!: (value: OtpSession) => void
    vi.mocked(requestPhoneOtp).mockReturnValueOnce(
      new Promise<OtpSession>((resolve) => {
        resolveRequest = resolve
      }),
    )
    setup()
    enterPhone()
    const send = screen.getByRole('button', { name: 'Gửi mã xác minh' })
    await press('Gửi mã xác minh')
    expect(send).toBeDisabled()
    fireEvent.click(send)
    expect(requestPhoneOtp).toHaveBeenCalledTimes(1)
    await act(async () => resolveRequest(otpSession))
  })

  it('sendOnOpen gửi mã ngay tới số đã có đúng một lần và vào thẳng bước nhập mã', async () => {
    setup({ initialPhone: PHONE, sendOnOpen: true })
    await screen.findByRole('heading', { name: 'Nhập mã gồm 6 số' })
    expect(requestPhoneOtp).toHaveBeenCalledTimes(1)
    expect(vi.mocked(requestPhoneOtp).mock.calls[0][0]).toEqual({ phone: PHONE })
  })

  it('sendOnOpen gặp PHONE_TAKEN thì ở lại bước nhập số để đổi số', async () => {
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(409, 'PHONE_TAKEN'))
    setup({ initialPhone: PHONE, sendOnOpen: true })
    expect(await screen.findByRole('alert')).toHaveTextContent('đã được tài khoản khác xác minh')
    expect(screen.getByRole('textbox', { name: /Số điện thoại/i })).toBeInTheDocument()
  })

  it('EMAIL vào thẳng bước nhập mã, xác thực thì đăng nhập bằng cặp token mới', async () => {
    tokenStore.set(null)
    vi.mocked(verifyOtp).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 900,
      user: verified,
    })
    const { onVerified } = setup({
      channel: 'EMAIL',
      emailSession: { sessionId: 'email-session', email: 'buyer@gmail.com', sentAt: Date.now() },
    })
    expect(screen.getByRole('dialog')).toHaveTextContent('b***@gmail.com')
    expect(screen.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
    enterOtp()
    await press('Xác thực')
    expect(verifyOtp).toHaveBeenCalledWith({ otp_session_id: 'email-session', otp: OTP })
    expect(tokenStore.get()).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh', user: verified })
    expect(screen.getByRole('heading', { name: 'Đã xác thực email' })).toBeInTheDocument()
    await press('Tiếp tục')
    expect(onVerified).toHaveBeenCalledWith(verified)
    expect(requestPhoneOtp).not.toHaveBeenCalled()
  })

  it('EMAIL gửi lại mã qua resendOtp với đúng phiên', async () => {
    vi.mocked(resendOtp).mockResolvedValue(undefined as never)
    setup({ channel: 'EMAIL', emailSession: { sessionId: 'email-session', email: 'buyer@gmail.com', sentAt: 0 } })
    await press('Gửi lại mã')
    expect(resendOtp).toHaveBeenCalledWith({ otp_session_id: 'email-session' })
    expect(screen.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
  })

  it('chế độ demo: hiện mã từ header lên màn hình và nút Điền mã điền sẵn ô OTP', async () => {
    vi.stubEnv('VITE_DEMO_OTP', 'true')
    vi.mocked(requestPhoneOtp).mockImplementationOnce(async () => {
      captureDemoOtp(new Headers({ 'X-Demo-Otp': OTP }))
      return otpSession
    })
    setup()
    await requestCode()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('status')).toHaveTextContent(`Mã demo (không gửi SMS): ${OTP}`)
    expect(screen.getByRole('button', { name: 'Xác minh' })).toBeDisabled()
    await press('Điền mã')
    expect(screen.getByRole('button', { name: 'Xác minh' })).toBeEnabled()
  })

  it('không bật demo thì không hiện hộp mã dù có header', async () => {
    vi.stubEnv('VITE_DEMO_OTP', 'false')
    vi.mocked(requestPhoneOtp).mockImplementationOnce(async () => {
      captureDemoOtp(new Headers({ 'X-Demo-Otp': OTP }))
      return otpSession
    })
    setup()
    await requestCode()
    expect(screen.queryByText(/Mã demo/)).not.toBeInTheDocument()
  })

  it('nút Xác minh bị vô hiệu khi chưa đủ sáu chữ số', async () => {
    setup()
    await requestCode()
    expect(screen.getByRole('button', { name: /^Xác minh$/ })).toBeDisabled()
    enterOtp('48261')
    expect(screen.getByRole('button', { name: /^Xác minh$/ })).toBeDisabled()
    await press(/^Xác minh$/)
    expect(verifyPhoneOtp).not.toHaveBeenCalled()
  })

  it('gửi đúng otp_session_id và otp khi bấm Xác minh', async () => {
    setup()
    await requestCode()
    enterOtp()
    expect(screen.getByRole('button', { name: /^Xác minh$/ })).toBeEnabled()
    await press(/^Xác minh$/)
    const expected: PhoneVerifyRequest = { otp_session_id: 'phone-session', otp: OTP }
    expect(verifyPhoneOtp).toHaveBeenCalledTimes(1)
    expect(vi.mocked(verifyPhoneOtp).mock.calls[0][0]).toEqual(expected)
  })

  it('Enter ở ô OTP cũng gửi xác minh đúng một lần', async () => {
    setup()
    await requestCode()
    enterOtp()
    // userEvent mô phỏng cả hành vi submit mặc định của Enter, fireEvent.keyDown không làm việc đó.
    const user = userEvent.setup()
    await user.click(screen.getByRole('textbox', { name: 'Chữ số 6' }))
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { name: 'Đã xác minh số điện thoại' })
    expect(verifyPhoneOtp).toHaveBeenCalledTimes(1)
    expect(vi.mocked(verifyPhoneOtp).mock.calls[0][0]).toEqual({ otp_session_id: 'phone-session', otp: OTP })
  })

  it('thành công cập nhật user ngay, giữ token và chỉ gọi onVerified khi bấm Tiếp tục', async () => {
    const { onOpenChange, onVerified } = setup()
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    await screen.findByRole('heading', { name: 'Đã xác minh số điện thoại' })
    expect(tokenStore.get()).toEqual({ ...session, user: verified })
    expect(screen.getByLabelText('Trạng thái xác minh trong useAuth')).toHaveTextContent('true')
    expect(screen.getByRole('dialog')).toHaveTextContent('Bạn có thể giữ ghế ngay bây giờ.')
    expect(screen.getByRole('dialog').textContent?.replace(/\s/g, '')).toContain('+84912345***')
    expect(onVerified).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    await press('Tiếp tục')
    expect(onVerified).toHaveBeenCalledExactlyOnceWith(verified)
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
    expect(onVerified.mock.invocationCallOrder[0]).toBeLessThan(onOpenChange.mock.invocationCallOrder[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mode=change bỏ câu về giữ ghế ở bước thành công', async () => {
    setup({ mode: 'change', initialPhone: PHONE })
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    await screen.findByRole('heading', { name: 'Đã xác minh số điện thoại' })
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Bạn có thể giữ ghế ngay bây giờ.')
  })

  it('OTP_INVALID hiện lỗi, xoá sáu ô, đánh dấu lỗi và giữ bước nhập mã', async () => {
    vi.mocked(verifyPhoneOtp).mockRejectedValueOnce(apiError(400, 'OTP_INVALID'))
    const { onVerified } = setup()
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã chưa đúng. Kiểm tra lại mã trong tin nhắn.')
    const inputs = screen.getAllByRole('textbox', { name: /Chữ số/ })
    expect(inputs).toHaveLength(6)
    for (const input of inputs) {
      expect(input).toHaveValue('')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    }
    expect(screen.getByRole('heading', { name: 'Nhập mã gồm 6 số' })).toBeInTheDocument()
    expect(tokenStore.get()).toEqual(session)
    expect(onVerified).not.toHaveBeenCalled()
  })

  it.each([
    ['OTP_EXPIRED', 'Mã đã hết hạn (hiệu lực 5 phút). Hãy gửi lại mã mới.'],
    ['OTP_TOO_MANY_ATTEMPTS', 'Bạn đã nhập sai quá 5 lần. Hãy gửi lại mã mới để tiếp tục.'],
  ] as const)('%s hiện gợi ý gửi lại và vẫn ở bước nhập mã', async (code, message) => {
    vi.mocked(verifyPhoneOtp).mockRejectedValueOnce(apiError(400, code))
    setup()
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByRole('heading', { name: 'Nhập mã gồm 6 số' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gửi lại/ })).toBeInTheDocument()
  })

  it('PHONE_TAKEN khi gửi giữ bước nhập số cùng thông điệp', async () => {
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(409, 'PHONE_TAKEN'))
    setup()
    enterPhone()
    await press('Gửi mã xác minh')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Số điện thoại này đã được tài khoản khác xác minh. Hãy dùng số khác.',
    )
    expect(screen.getByRole('heading', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(verifyPhoneOtp).not.toHaveBeenCalled()
  })

  it('PHONE_TAKEN khi xác minh quay về nhập số cùng thông điệp', async () => {
    vi.mocked(verifyPhoneOtp).mockRejectedValueOnce(apiError(409, 'PHONE_TAKEN'))
    setup()
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Số điện thoại này đã được tài khoản khác xác minh. Hãy dùng số khác.',
    )
    expect(screen.getByRole('heading', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Chữ số 1' })).not.toBeInTheDocument()
    expect(tokenStore.get()).toEqual(session)
  })

  it('HTTP 503 khi gửi hiển thị thông điệp SMS', async () => {
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(503))
    setup()
    enterPhone()
    await press('Gửi mã xác minh')
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa gửi được SMS. Vui lòng thử lại sau ít phút.')
  })

  it('Đổi số điện thoại quay về bước nhập số', async () => {
    setup()
    await requestCode()
    fireEvent.click(screen.getByText('Đổi số điện thoại'))
    expect(screen.getByRole('heading', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(verifyPhoneOtp).not.toHaveBeenCalled()
  })

  it('Để sau đóng popup mà không xác minh', () => {
    const { onOpenChange, onVerified } = setup()
    fireEvent.click(screen.getByText('Để sau'))
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
    expect(onVerified).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('nút X đóng popup', () => {
    const { onOpenChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^(Đóng|Close)$/i }))
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('luồng gửi, lỗi, xác minh không log SĐT/OTP, ghi storage hay đưa vào URL', async () => {
    const methods = Object.getOwnPropertyNames(console).filter(
      (name): name is Exclude<keyof Console, 'Console'> =>
        name !== 'Console' && typeof console[name as keyof Console] === 'function',
    )
    const spies = methods.map((method) => vi.spyOn(console, method).mockImplementation(() => {}))
    // Storage.prototype bao phủ cả localStorage và sessionStorage.
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const pushState = vi.spyOn(window.history, 'pushState')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    vi.mocked(verifyPhoneOtp).mockRejectedValueOnce(apiError(400, 'OTP_INVALID')).mockResolvedValueOnce(verified)
    setup()
    const urlBefore = window.location.href
    await requestCode()
    enterOtp()
    await press(/^Xác minh$/)
    await screen.findByRole('alert')
    enterOtp()
    await press(/^Xác minh$/)
    await screen.findByRole('heading', { name: 'Đã xác minh số điện thoại' })
    await press('Tiếp tục')
    const logged = JSON.stringify(
      spies.flatMap((spy) => spy.mock.calls),
      (_key, value: unknown) => (value instanceof Error ? { message: value.message, stack: value.stack } : value),
    ).replace(/[\s.-]/g, '')
    for (const secret of [PHONE, '0912345678', '912345678', OTP]) expect(logged).not.toContain(secret)
    expect(setItem).not.toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
    expect(window.location.href).toBe(urlBefore)
  })
})

describe('OtpDialog đếm ngược gửi lại', () => {
  it('khoá gửi lại đủ 60 giây rồi bật nút', async () => {
    startClock()
    setup()
    await requestCode()
    expect(screen.getByRole('button', { name: /Gửi lại sau 0?1:00/ })).toBeDisabled()
    await elapse(59_000)
    expect(screen.getByRole('button', { name: /Gửi lại sau 0?0:01/ })).toBeDisabled()
    expect(requestPhoneOtp).toHaveBeenCalledTimes(1)
    await elapse(1000)
    expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toBeEnabled()
  })

  it('gửi lại cùng số qua requestPhoneOtp và đặt lại 60 giây trên cùng phiên', async () => {
    startClock()
    setup()
    await requestCode()
    const firstBody = vi.mocked(requestPhoneOtp).mock.calls[0][0]
    await elapse(60_000)
    vi.mocked(requestPhoneOtp).mockResolvedValueOnce({
      ...otpSession,
      expires_at: new Date(Date.now() + 300_000).toISOString(),
    })
    await press('Gửi lại mã')
    expect(requestPhoneOtp).toHaveBeenCalledTimes(2)
    expect(vi.mocked(requestPhoneOtp).mock.calls[1][0]).toEqual(firstBody)
    expect(screen.getByRole('button', { name: /Gửi lại sau 0?1:00/ })).toBeDisabled()
    enterOtp('739204')
    await press(/^Xác minh$/)
    expect(vi.mocked(verifyPhoneOtp).mock.calls[0][0]).toEqual({ otp_session_id: 'phone-session', otp: '739204' })
  })

  it.each([30, 90])('RATE_LIMITED lúc gửi lại thay cooldown bằng Retry-After=%s giây', async (seconds) => {
    startClock()
    setup()
    await requestCode()
    await elapse(60_000)
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(429, 'RATE_LIMITED', seconds))
    await press('Gửi lại mã')
    expect(screen.getByRole('alert')).toHaveTextContent(`Bạn thử quá nhiều lần. Vui lòng thử lại sau ${seconds} giây.`)
    expect(screen.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()
    await elapse((seconds - 1) * 1000)
    expect(screen.getByRole('button', { name: /Gửi lại sau 0?0:01/ })).toBeDisabled()
    await elapse(1000)
    expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toBeEnabled()
    expect(requestPhoneOtp).toHaveBeenCalledTimes(2)
  })

  it('RATE_LIMITED lúc gửi lần đầu khoá gửi theo Retry-After', async () => {
    startClock()
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(429, 'RATE_LIMITED', 90))
    setup()
    enterPhone()
    await press('Gửi mã xác minh')
    expect(screen.getByRole('alert')).toHaveTextContent('90 giây')
    expect(screen.getByRole('button', { name: /Gửi/ })).toBeDisabled()
    await elapse(89_000)
    expect(screen.getByRole('button', { name: /Gửi/ })).toBeDisabled()
    await elapse(1000)
    expect(screen.getByRole('button', { name: 'Gửi mã xác minh' })).toBeEnabled()
    expect(requestPhoneOtp).toHaveBeenCalledTimes(1)
  })

  it('RATE_LIMITED lúc xác minh đặt thời gian gửi lại theo Retry-After', async () => {
    startClock()
    setup()
    await requestCode()
    vi.mocked(verifyPhoneOtp).mockRejectedValueOnce(apiError(429, 'RATE_LIMITED', 90))
    enterOtp()
    await press(/^Xác minh$/)
    expect(screen.getByRole('alert')).toHaveTextContent('90 giây')
    await elapse(89_000)
    expect(screen.getByRole('button', { name: /Gửi lại sau 0?0:01/ })).toBeDisabled()
    await elapse(1000)
    expect(screen.getByRole('button', { name: 'Gửi lại mã' })).toBeEnabled()
  })

  it('PHONE_TAKEN khi gửi lại quay về nhập số cùng lỗi', async () => {
    startClock()
    setup()
    await requestCode()
    await elapse(60_000)
    vi.mocked(requestPhoneOtp).mockRejectedValueOnce(apiError(409, 'PHONE_TAKEN'))
    await press('Gửi lại mã')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Số điện thoại này đã được tài khoản khác xác minh.')
  })
})
