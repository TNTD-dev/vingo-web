import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createShowtime } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import ShowtimeForm from './ShowtimeForm'
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', () => ({
  createShowtime: vi.fn().mockResolvedValue({ id: 'show' }),
  updateShowtime: vi.fn(),
}))
vi.mock('./catalog', async (original) => ({
  ...(await original<typeof import('./catalog')>()),
  useVenueDirectory: () => ({
    data: [{ id: 'venue', name: 'Sân', halls: [{ id: 'hall', name: 'Sân chính' }] }],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useLayoutDirectory: () => ({
    data: [{ id: 'layout', name: 'Sơ đồ chính', version: 1, status: 'PUBLISHED' }],
    isPending: false,
    error: null,
  }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
function setup() {
  const close = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <ShowtimeForm eventId="event" onClose={close} />
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByLabelText(/Phòng \/ sân/), { target: { value: 'hall' } })
  fireEvent.change(screen.getByLabelText(/Sơ đồ đã phát hành/), { target: { value: 'layout' } })
  return close
}
function dates(end = '2026-12-20T22:00') {
  for (const [label, value] of [
    [/Bắt đầu diễn/, '2026-12-20T19:00'],
    [/Kết thúc diễn/, end],
    [/Mở bán/, '2026-12-01T09:00'],
    [/Đóng bán/, '2026-12-20T18:00'],
  ] as const)
    fireEvent.input(screen.getByLabelText(label), { target: { value } })
}
describe('Lưu suất diễn', () => {
  it('gửi đủ hall, sơ đồ và thời gian Việt Nam dưới dạng UTC', async () => {
    const close = setup()
    dates()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu suất diễn' }))
    await waitFor(() =>
      expect(createShowtime).toHaveBeenCalledWith('event', {
        hall_id: 'hall',
        seat_layout_id: 'layout',
        starts_at: '2026-12-20T12:00:00.000Z',
        ends_at: '2026-12-20T15:00:00.000Z',
        sale_opens_at: '2026-12-01T02:00:00.000Z',
        sale_closes_at: '2026-12-20T11:00:00.000Z',
      }),
    )
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
  it('không gửi lịch có giờ kết thúc trước giờ bắt đầu', () => {
    setup()
    dates('2026-12-20T18:00')
    expect(screen.getByRole('button', { name: 'Lưu suất diễn' })).toBeDisabled()
    expect(createShowtime).not.toHaveBeenCalled()
  })
})
