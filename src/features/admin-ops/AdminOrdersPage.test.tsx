import { cleanup, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminOrdersPage from './AdminOrdersPage'

vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
vi.mock('@/design/admin/AdminNotifications', () => ({ AdminNotifications: () => null }))
vi.mock('@/design/admin/data', async (original) => ({
  ...(await original<typeof import('@/design/admin/data')>()),
  useEventDirectory: () => ({ data: [{ id: 'event', title: 'Sự kiện A' }] }),
}))
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', () => ({
  useGetAdminEvent: () => ({ data: undefined, isPending: false, error: null }),
}))
const order = (id: string, code: string, at: string, over: Record<string, unknown> = {}) => ({
  id,
  code,
  status: 'PAID',
  created_at: at,
  total_amount: 700000,
  buyer: { full_name: `Người ${code}` },
  event: { title: 'Hòa nhạc Giao hưởng Mùa Thu' },
  showtime: { starts_at: '2026-11-21T12:30:00Z' },
  items: [{ quantity: 2 }],
  ...over,
})
let list: ReturnType<typeof order>[] = []
let review: ReturnType<typeof order>[] = []
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  adminListOrders: vi.fn(async () => ({ data: list, next_cursor: null })),
  useAdminListOrders: () => ({ data: { data: review, next_cursor: null }, isPending: false, error: null }),
}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T07:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  list = []
  review = []
})
function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
describe('Trang Đơn hàng', () => {
  it('gom đơn theo ngày giờ Việt Nam, mỗi đơn đúng một dòng', async () => {
    list = [
      order('1', 'AAA111', '2026-11-16T07:28:00Z'),
      order('2', 'BBB222', '2026-11-15T20:30:00Z'),
      order('3', 'CCC333', '2026-11-15T12:00:00Z'),
      order('4', 'DDD444', '2026-11-14T14:47:00Z'),
    ]
    setup()
    const today = await screen.findByRole('region', { name: 'HÔM NAY · THỨ HAI 16/11' })
    expect(within(today).getAllByRole('listitem')).toHaveLength(2)
    expect(within(today).getByText(/2 ĐƠN · ĐÃ THU 1\.400\.000/)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'HÔM QUA · CHỦ NHẬT 15/11' })).getAllByRole('listitem'),
    ).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'THỨ BẢY 14/11' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: /Mở đơn/ })).toHaveLength(4)
  })
  it('tab trạng thái bằng tiếng Việt, không lộ tên kỹ thuật', async () => {
    list = [order('1', 'AAA111', '2026-11-16T07:28:00Z', { status: 'PENDING' })]
    setup()
    await screen.findByText('AAA111')
    for (const name of ['Tất cả', 'Cần xử lý', 'Chờ thanh toán', 'Đã thanh toán', 'Hết hạn', 'Đã huỷ', 'Hoàn tiền'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.queryByText(/NEEDS_REVIEW|PENDING/)).not.toBeInTheDocument()
  })
  it('ẩn thẻ "Cần bạn xử lý" khi không có đơn cần duyệt', async () => {
    list = [order('1', 'AAA111', '2026-11-16T07:28:00Z')]
    setup()
    await screen.findByText('AAA111')
    expect(screen.queryByRole('region', { name: 'Cần bạn xử lý' })).not.toBeInTheDocument()
  })
  it('hiện thẻ "Cần bạn xử lý" trỏ tới đơn chờ lâu nhất', async () => {
    review = [
      order('new', 'NEW001', '2026-11-16T05:00:00Z', { status: 'NEEDS_REVIEW', review_reason: 'AMOUNT_MISMATCH' }),
      order('old', 'SEED07', '2026-11-09T10:20:00Z', { status: 'NEEDS_REVIEW', review_reason: 'PAID_AFTER_EXPIRY' }),
    ]
    list = review
    setup()
    const card = await screen.findByRole('region', { name: 'Cần bạn xử lý' })
    expect(within(card).getByText(/2 ĐƠN · ĐÃ CHỜ 6 NGÀY/)).toBeInTheDocument()
    expect(within(card).getByText(/^SEED07 · /)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: 'Xử lý đơn' })).toHaveAttribute('href', '/admin/orders/old')
  })
  it('báo trạng thái rỗng khi không có đơn nào', async () => {
    setup()
    expect(await screen.findByText('Chưa có đơn nào khớp bộ lọc này.')).toBeInTheDocument()
  })
})
