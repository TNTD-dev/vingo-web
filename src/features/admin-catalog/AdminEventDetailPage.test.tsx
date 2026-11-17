import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/api/generated/model'
import AdminEventDetailPage from './AdminEventDetailPage'

const event: EventDetail = {
  id: 'ev',
  title: 'Hội chợ Sách #15',
  category: 'OTHER',
  description: 'Sự kiện mẫu',
  status: 'PUBLISHED',
  max_tickets_per_order: 10,
  price_tiers: [{ id: 't1', name: 'Vé chung', price: 500000 }],
  showtimes: [
    {
      id: 's1',
      status: 'ON_SALE',
      starts_at: '2026-12-12T13:00:00Z',
      ends_at: '2026-12-12T15:00:00Z',
      sale_opens_at: '2026-11-09T03:41:00Z',
      sale_closes_at: '2026-12-12T13:00:00Z',
      seat_layout_id: 'l1',
      venue: { id: 'v', name: 'Sân vận động Mỹ Đình' },
    },
  ],
}
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', async (original) => ({
  ...(await original<object>()),
  useGetAdminEvent: () => ({ data: event, isPending: false, error: null, refetch: vi.fn() }),
  updateEvent: vi.fn(),
  putPriceTiers: vi.fn(),
  publishEvent: vi.fn(),
  cancelEvent: vi.fn(),
  cancelShowtime: vi.fn(),
}))
afterEach(cleanup)

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin/events/ev']}>
        <Routes>
          <Route path="/admin/events/:eventId" element={<AdminEventDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Trang sửa sự kiện', () => {
  it('hiện trạng thái và thể loại bằng tiếng Việt, không lộ enum', () => {
    setup()
    expect(screen.getAllByText('Đã công bố').length).toBeGreaterThan(0)
    expect(screen.getByText('Đang bán')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Thể loại' })).toHaveDisplayValue('Khác')
    expect(screen.queryByText('PUBLISHED')).toBeNull()
    expect(screen.queryByText(/ON.SALE/)).toBeNull()
  })
  it('nút lưu chỉ bật khi có thay đổi', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Tên sự kiện' }), { target: { value: 'Hội chợ Sách #16' } })
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
  })
  it('giá đã khóa thì hiện số tiền định dạng thay cho ô nhập', () => {
    setup()
    expect(screen.queryByRole('spinbutton', { name: 'Giá Vé chung' })).toBeNull()
    expect(screen.getByText('500.000 ₫')).toBeInTheDocument()
  })
  it('sửa mọi thông tin ngay trên trang, không còn hộp thoại thông tin bổ sung', () => {
    setup()
    expect(screen.queryByRole('button', { name: /thông tin thêm/i })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: '18+' }))
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Thêm 1 vé' }))
    expect(screen.getByRole('group', { name: 'Tối đa vé mỗi đơn' })).toHaveTextContent('11')
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
    expect(screen.getByRole('button', { name: 'Đã lưu' })).toBeDisabled()
  })
})
