import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OverviewPage from './OverviewPage'

vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
vi.mock('@/design/admin/AdminNotifications', () => ({ AdminNotifications: () => null }))
const api = vi.hoisted(() => ({ dashboard: vi.fn(), logs: vi.fn() }))
vi.mock('@/api/generated/endpoints/admin-reports/admin-reports', () => ({ getAdminDashboard: api.dashboard }))
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({ listAuditLogs: api.logs }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-18T07:00:00Z'))
  api.dashboard.mockResolvedValue({
    current: { revenue: 1000000, tickets_sold: 4, new_users: 2 },
    previous: { revenue: 0, tickets_sold: 0, new_users: 0 },
    on_sale_showtimes: 3,
    computed_at: '2026-11-18T07:00:00Z',
    revenue: { series: [{ key: '2026-11-18', value: 1000000 }] },
    tickets: { series: [{ key: '2026-11-18', value: 4 }] },
    tiers: { series: [{ key: 'tier-1', label: 'Sự kiện A · VIP', value: 4 }] },
    upcoming: [],
    venues: [{ id: 'v1', name: 'Sân A', sold: 0, capacity: 0 }],
  })
  api.logs.mockResolvedValue({ data: [], next_cursor: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})
const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('Tổng quan theo API dashboard', () => {
  it('hiển thị KPI từ backend và gửi trọn khoảng ngày Việt Nam', async () => {
    setup()
    await screen.findByText('Tổng doanh thu')
    expect(within(screen.getByText('Vé đã bán').closest('section')!).getByText('4')).toBeInTheDocument()
    expect(api.dashboard).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-10-19T17:00:00.000Z', to: '2026-11-18T17:00:00.000Z', group_by: 'day' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
  it('không hiển thị tăng trưởng vô hạn khi kỳ trước bằng không', async () => {
    setup()
    expect((await screen.findAllByText('Kỳ trước chưa có số liệu để so sánh')).length).toBe(3)
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument()
  })
  it('phân biệt suất sắp diễn và tỷ lệ bán trong kỳ, mẫu bằng không hiển thị 0%', async () => {
    setup()
    await screen.findByText('Suất đang mở bán')
    expect(screen.getByText('Chưa có suất sắp diễn.')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('Sự kiện A · VIP')).toBeInTheDocument()
  })
  it('activity feed chỉ yêu cầu hành động thay đổi thành công', async () => {
    setup()
    await screen.findByText('Hoạt động quản trị')
    expect(api.logs).toHaveBeenCalledWith(
      { activity_only: true, limit: 8 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
  it('giữ thông báo lỗi API, không thay thế bằng số liệu minh họa', async () => {
    api.dashboard.mockRejectedValue(new Error('Dashboard unavailable'))
    setup()
    await screen.findByRole('alert')
    expect(screen.queryByText('Tổng doanh thu')).not.toBeInTheDocument()
  })
})
