import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OverviewPage from './OverviewPage'

vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
vi.mock('@/design/admin/AdminNotifications', () => ({ AdminNotifications: () => null }))
vi.mock('./OnSaleShowtimes', () => ({ OnSaleShowtimes: () => null }))
let showtimesToday = false
let review: Record<string, unknown>[] = []
vi.mock('@/api/generated/endpoints/admin-reports/admin-reports', () => ({
  useQueryMetric: (params: { metric: string; group_by?: string }) => {
    const ok = (data: unknown) => ({ data, isPending: false, error: null, isError: false, refetch: vi.fn() })
    if (params.group_by === 'zone') return ok({ series: showtimesToday ? [{ key: 'z', value: 10 }] : [] })
    if (params.group_by === 'day') return ok({ series: [{ key: '2026-11-12', value: 31_000_000 }] })
    return ok({ value: 100 })
  },
}))
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  useAdminListOrders: () => ({ data: { data: review, next_cursor: null }, isPending: false, error: null }),
}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T07:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  showtimesToday = false
  review = []
})
const setup = () =>
  render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>,
  )
const card = (name: string) => screen.getByText(name).closest('section')!

describe('Trang Tổng quan', () => {
  it('không có suất hôm nay thì Check-in là "—" kèm huy hiệu trung tính, không phải 0%', () => {
    setup()
    const checkin = within(card('Check-in hôm nay'))
    expect(checkin.getByLabelText('Không có dữ liệu')).toHaveTextContent('—')
    expect(checkin.getByText('0 suất')).toBeInTheDocument()
    expect(checkin.queryByText(/0%/)).not.toBeInTheDocument()
  })
  it('có suất hôm nay thì hiện số vé đã quét', () => {
    showtimesToday = true
    setup()
    expect(within(card('Check-in hôm nay')).getByText('100')).toBeInTheDocument()
  })
  it('thay đổi bằng 0 thì huy hiệu trung tính "Không đổi", không còn dòng "Theo khoảng đã chọn"', () => {
    setup()
    expect(within(card('Doanh thu hôm nay')).getByText('Không đổi')).toBeInTheDocument()
    expect(screen.queryByText('Theo khoảng đã chọn')).not.toBeInTheDocument()
  })
  it('biểu đồ doanh thu đủ 14 cột liên tục, đánh dấu hôm nay, ngày không có dữ liệu là cột 0', () => {
    const { container } = setup()
    const cols = container.querySelectorAll('.admin-plot-col')
    expect(cols).toHaveLength(14)
    expect(container.querySelectorAll('.admin-plot-col.is-today')).toHaveLength(1)
    expect(cols[13]).toHaveClass('is-today')
    expect(container.querySelectorAll('.admin-plot-bar.is-zero')).toHaveLength(13)
    expect(screen.getByRole('figure')).toHaveAttribute('aria-label', expect.stringContaining('03: 0 ₫'))
    expect(screen.getByText('31tr')).toBeInTheDocument()
  })
  it('bảng đơn cần xử lý có thời gian đã chờ; không có đơn thì báo rỗng', () => {
    setup()
    expect(screen.getByText('Không có đơn đang chờ xử lý.')).toBeInTheDocument()
    cleanup()
    review = [
      {
        id: 'o1',
        code: 'SEED07',
        status: 'NEEDS_REVIEW',
        review_reason: 'PAID_AFTER_EXPIRY',
        total_amount: 600000,
        created_at: '2026-11-09T10:20:00Z',
        event: { title: 'Hòa nhạc' },
        items: [{ quantity: 2 }],
      },
    ]
    setup()
    const row = screen.getByText('SEED07').closest('tr')!
    expect(within(row).getByText(/6 ngày/)).toBeInTheDocument()
    expect(within(row).getByText('Tiền về sau hạn')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', '/admin/orders/o1')
  })
})
