import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { holdSeats } from '@/api/generated/endpoints/booking/booking'
import type { EventDetail, GetAvailability200, SeatMap, User } from '@/api/generated/model'
import { newIdempotencyKey } from '@/api/idempotency'
import { AuthContext } from '@/auth/auth-context'
import { tokenStore } from '@/auth/token-store'
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
const buyer: User = { id: 'buyer', role: 'BUYER' }
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

describe('SeatSelectionPage giữ ghế', () => {
  it('giữ đúng ghế đã chọn rồi sang thanh toán', async () => {
    const router = setup()
    await selectSeatAndHold()
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders/order/checkout'))
    expect(holdSeats).toHaveBeenCalledExactlyOnceWith(
      'showtime',
      { seat_ids: ['seat-1'] },
      { headers: { 'Idempotency-Key': expect.any(String) } },
    )
  })

  it('lỗi mạng vẫn dùng lại khoá cũ khi bấm lại cùng lựa chọn', async () => {
    vi.mocked(holdSeats).mockRejectedValueOnce(new Error('network'))
    const router = setup()
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
