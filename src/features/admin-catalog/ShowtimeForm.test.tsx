import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    data: [{ id: 'layout', name: 'Sơ đồ chính', version: 1, status: 'PUBLISHED', zone_count: 3, seat_count: 100 }],
    isPending: false,
    error: null,
  }),
}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T03:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
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
  fireEvent.change(screen.getByRole('combobox', { name: 'Sân' }), { target: { value: 'venue' } })
  fireEvent.click(screen.getByRole('radio', { name: /Sân chính/ }))
  return close
}
/** Mở bộ chọn theo nhãn, lật tới đúng tháng rồi bấm ngày. */
function pickDay(popover: HTMLElement, date: string) {
  const [y, m, d] = date.split('-')
  for (let i = 0; i < 24 && !within(popover).queryByText(`Tháng ${Number(m)}, ${y}`); i++)
    fireEvent.click(within(popover).getByRole('button', { name: 'Tháng sau' }))
  fireEvent.click(within(popover).getByRole('gridcell', { name: `${d}/${m}/${y}` }))
}
function pickTime(popover: HTMLElement, time: string) {
  const [h, mm] = time.split(':')
  fireEvent.click(within(within(popover).getByRole('group', { name: 'Giờ' })).getByRole('button', { name: h }))
  fireEvent.click(within(within(popover).getByRole('group', { name: 'Phút' })).getByRole('button', { name: mm }))
}
function open(label: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label} `) }))
  return screen.getByRole('dialog', { name: label })
}
function dates(end = '22:00') {
  pickDay(open('Ngày'), '2026-12-20')
  pickTime(open('Bắt đầu'), '19:00')
  pickTime(open('Kết thúc'), end)
  for (const [label, value] of [
    ['Mở bán', '2026-12-01T09:00'],
    ['Đóng bán', '2026-12-20T18:00'],
  ] as const) {
    const popover = open(label)
    pickDay(popover, value.slice(0, 10))
    pickTime(popover, value.slice(11))
    fireEvent.click(within(popover).getByRole('button', { name: 'Xong' }))
  }
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
    expect(screen.getByRole('button', { name: /^Đóng bán / })).toHaveTextContent('CN, 20/12/2026 · 17:00')
  })
})

describe('Bộ chọn ngày', () => {
  it('không cho chọn ngày đã qua khi thêm suất mới', () => {
    setup()
    const popover = open('Ngày')
    expect(within(popover).getByRole('gridcell', { name: '15/11/2026' })).toBeDisabled()
    expect(within(popover).getByRole('gridcell', { name: '16/11/2026' })).toHaveAttribute('aria-current', 'date')
  })
  it('thiếu ngày giờ thì báo trung tính, nhập đủ mà sai mới báo lỗi', () => {
    setup()
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info')
    dates('18:00')
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'error')
  })
})
