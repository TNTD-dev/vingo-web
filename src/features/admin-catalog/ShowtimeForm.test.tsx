import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
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
    data: [
      { id: 'venue', name: 'Sân' },
      { id: 'venue2', name: 'Sân khác' },
    ],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useLayoutDirectory: (venueId: string) => ({
    data: [
      {
        id: venueId === 'venue2' ? 'layout2' : 'layout',
        name: 'Sơ đồ chính',
        version: 1,
        status: 'PUBLISHED',
        zone_count: 3,
        seat_count: 100,
      },
    ],
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
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
      >
        <ShowtimeForm eventId="event" onClose={close} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Sân'), { target: { value: 'venue' } })
  fireEvent.change(screen.getByLabelText('Layout đã phát hành'), { target: { value: 'layout' } })
  return close
}
function dates(end = '22:00') {
  for (const [label, value] of [
    ['Ngày', '2026-12-20'],
    ['Bắt đầu', '19:00'],
    ['Kết thúc', end],
    ['Mở bán', '2026-12-01T09:00'],
    ['Đóng bán', '2026-12-20T18:00'],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
describe('Lưu suất diễn', () => {
  it('đổi sân xóa layout cũ và yêu cầu chọn lại', () => {
    setup()
    dates()
    fireEvent.change(screen.getByLabelText('Sân'), { target: { value: 'venue2' } })
    expect(screen.getByLabelText('Layout đã phát hành')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Lưu suất diễn' })).toBeDisabled()
    expect(createShowtime).not.toHaveBeenCalled()
  })

  it('gửi layout và thời gian Việt Nam dưới dạng UTC', async () => {
    const close = setup()
    dates()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu suất diễn' }))
    await waitFor(() =>
      expect(createShowtime).toHaveBeenCalledWith('event', {
        seat_layout_id: 'layout',
        starts_at: '2026-12-20T12:00:00.000Z',
        ends_at: '2026-12-20T15:00:00.000Z',
        sale_opens_at: '2026-12-01T02:00:00.000Z',
        sale_closes_at: '2026-12-20T11:00:00.000Z',
      }),
    )
    await waitFor(() => expect(close).toHaveBeenCalled())
  })
  it('không gửi lịch có giờ kết thúc trước giờ bắt đầu và nói rõ lý do', () => {
    setup()
    dates('18:00')
    expect(screen.getByRole('button', { name: 'Lưu suất diễn' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Giờ kết thúc phải sau giờ bắt đầu')
    expect(createShowtime).not.toHaveBeenCalled()
  })
  it('“Đóng trước 2 giờ” điền giờ đóng bán lùi 2 giờ so với giờ diễn', () => {
    setup()
    dates()
    fireEvent.click(screen.getByRole('radio', { name: 'Đóng trước 2 giờ' }))
    expect(screen.getByLabelText('Đóng bán')).toHaveValue('2026-12-20T17:00')
  })
})
