import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { holdSeats } from '@/api/generated/endpoints/booking/booking'
import type { EventDetail, GetAvailability200, SeatMap, User } from '@/api/generated/model'
import { newIdempotencyKey } from '@/api/idempotency'
import { ApiError } from '@/api/problem'
import { AuthContext } from '@/auth/auth-context'
import { tokenStore } from '@/auth/token-store'
import type { PhoneVerifyDialogProps } from '@/design/PhoneVerifyDialog'
import SeatSelectionPage from '@/features/booking/SeatSelectionPage'

vi.mock('@/api/generated/endpoints/booking/booking', () => ({ holdSeats: vi.fn() }))
vi.mock('@/api/idempotency', () => ({ newIdempotencyKey: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock('@/seatmap/svgSource', () => ({
  // Dựng chế độ danh sách thật để chọn ghế mà không cần tải SVG hay chạy WebGL.
  loadSeatLayoutSvg: vi.fn().mockRejectedValue(new Error('Không có SVG trong fixture')),
}))
vi.mock('@/api/generated/endpoints/search/search', () => ({
  useGetEvent: () => ({ data: event, isPending: false, isError: false }),
  useGetAvailability: () => ({ data: availability, isPending: false, isError: false, refetch: vi.fn() }),
  useGetSeatmap: () => ({ data: seatmap, isPending: false, isError: false, refetch: vi.fn() }),
  getSeatmap: vi.fn(),
}))
vi.mock('@/design/PhoneVerifyDialog', () => ({
  PhoneVerifyDialog: ({ open, onOpenChange, onVerified }: PhoneVerifyDialogProps) =>
    open ? (
      <div role="dialog" aria-label="Xác minh số điện thoại">
        <button
          type="button"
          onClick={() => {
            // Mô phỏng đúng hợp đồng popup: cập nhật store trước callback, chưa chờ trang render lại.
            const current = tokenStore.get()!
            const user: User = { ...current.user, phone: '+84912345678', phone_verified: true }
            tokenStore.set({ ...current, user })
            onVerified(user)
            onOpenChange(false)
          }}
        >
          Hoàn tất xác minh
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Để sau
        </button>
      </div>
    ) : null,
}))

const event: EventDetail = {
  id: 'event',
  title: 'Buổi diễn thử nghiệm',
  showtimes: [{ id: 'showtime', starts_at: '2026-11-21T10:00:00Z', status: 'ON_SALE' }],
}
const availability: GetAvailability200 = {
  zones: [{ zone_id: 'zone', name: 'Khu A', seats_left: 10, tier: { id: 'tier', name: 'Hạng A', price: 100000 } }],
}
const seatmap: SeatMap = {
  zones: [
    { zone_id: 'zone', kind: 'SEATED', seats: [{ seat_id: 'seat-1', row: 'A', number: 1, status: 'AVAILABLE' }] },
  ],
}
const buyer: User = { id: 'buyer', role: 'BUYER', phone_verified: false }
const clients: QueryClient[] = []

beforeEach(() => {
  vi.mocked(holdSeats).mockResolvedValue({ id: 'order', status: 'PENDING' })
  let key = 0
  vi.mocked(newIdempotencyKey).mockImplementation(() => `hold-key-${++key}`)
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  tokenStore.set(null)
  vi.clearAllMocks()
  vi.mocked(holdSeats).mockReset()
})

function setup(user: User = buyer) {
  tokenStore.set({ accessToken: 'test-access', user })
  const router = createMemoryRouter(
    [
      { path: '/events/:eventId/showtimes/:showtimeId/seats', element: <SeatSelectionPage /> },
      { path: '/orders/:orderId/checkout', element: <p>Thanh toán đơn</p> },
    ],
    { initialEntries: ['/events/event/showtimes/showtime/seats'] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Harness() {
    const session = useSyncExternalStore(tokenStore.subscribe, tokenStore.get)
    return (
      <AuthContext.Provider
        value={{ ready: true, user: session?.user ?? null, login: async () => user, logout: async () => {} }}
      >
        <RouterProvider router={router} />
      </AuthContext.Provider>
    )
  }
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  return router
}

async function selectSeatAndHold() {
  fireEvent.click(await screen.findByRole('button', { name: /Khu A.*Còn 10 chỗ/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Hàng A ghế 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Giữ ghế & thanh toán' }))
}

describe('SeatSelectionPage xác minh trước khi giữ ghế', () => {
  it('BUYER chưa xác minh mở popup, giữ lựa chọn và chưa gọi holdSeats', async () => {
    setup()
    await selectSeatAndHold()
    expect(await screen.findByRole('dialog', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(holdSeats).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Hàng A ghế 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('xác minh xong tự giữ đúng ghế đã chọn một lần, không bị user cũ chặn lại', async () => {
    const router = setup()
    await selectSeatAndHold()
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tất xác minh' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order/checkout'))
    expect(holdSeats).toHaveBeenCalledTimes(1)
    expect(holdSeats).toHaveBeenCalledWith(
      'showtime',
      { seat_ids: ['seat-1'] },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
  })

  it('đóng popup không tự giữ ghế và không mất lựa chọn', async () => {
    setup()
    await selectSeatAndHold()
    fireEvent.click(await screen.findByRole('button', { name: 'Để sau' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(holdSeats).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Hàng A ghế 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('server trả 422 PHONE_VERIFICATION_REQUIRED thì mở popup và không toast lỗi', async () => {
    vi.mocked(holdSeats).mockRejectedValueOnce(
      new ApiError(422, { title: 'Cần xác minh', status: 422, code: 'PHONE_VERIFICATION_REQUIRED' }),
    )
    setup({ ...buyer, phone_verified: undefined })
    await selectSeatAndHold()
    expect(await screen.findByRole('dialog', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    expect(holdSeats).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Hàng A ghế 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sau lỗi yêu cầu xác minh dùng khoá mới nhưng giữ nguyên body khi tự gửi lại', async () => {
    vi.mocked(holdSeats).mockRejectedValueOnce(
      new ApiError(422, { title: 'Cần xác minh', status: 422, code: 'PHONE_VERIFICATION_REQUIRED' }),
    )
    const router = setup({ ...buyer, phone_verified: undefined })
    await selectSeatAndHold()
    fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tất xác minh' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order/checkout'))
    const calls = vi.mocked(holdSeats).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][1]).toEqual(calls[0][1])
    expect(calls[1][2]?.headers).not.toEqual(calls[0][2]?.headers)
    expect(newIdempotencyKey).toHaveBeenCalledTimes(2)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'BUYER đã xác minh', user: { ...buyer, phone_verified: true } },
    { label: 'BUYER thiếu cờ', user: { ...buyer, phone_verified: undefined } },
    { label: 'ADMIN', user: { ...buyer, role: 'ADMIN' as const } },
  ])('$label giữ ghế trực tiếp, không mở popup', async ({ user }) => {
    const router = setup(user)
    await selectSeatAndHold()
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order/checkout'))
    expect(holdSeats).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lỗi mạng vẫn dùng lại khoá cũ khi bấm lại cùng lựa chọn', async () => {
    vi.mocked(holdSeats).mockRejectedValueOnce(new Error('network'))
    const router = setup({ ...buyer, phone_verified: true })
    await selectSeatAndHold()
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    const hold = screen.getByRole('button', { name: 'Giữ ghế & thanh toán' })
    await waitFor(() => expect(hold).toBeEnabled())
    fireEvent.click(hold)
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order/checkout'))
    const calls = vi.mocked(holdSeats).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][1]).toEqual(calls[0][1])
    expect(calls[1][2]?.headers).toEqual(calls[0][2]?.headers)
    expect(newIdempotencyKey).toHaveBeenCalledTimes(1)
  })
})
