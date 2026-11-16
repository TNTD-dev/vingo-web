import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@/api/generated/model'
import { AdminNotifications } from './AdminNotifications'

let orders: Order[] = []
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  useAdminListOrders: () => ({ data: { data: orders, next_cursor: null }, isPending: false, isError: false }),
}))
const order = (id: string, minutesAgo: number): Order => ({
  id,
  code: id.toUpperCase(),
  status: 'NEEDS_REVIEW',
  review_reason: 'AMOUNT_MISMATCH',
  total_amount: 600000,
  created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  buyer: { full_name: 'Nguyễn Văn Mua', email: 'mua@example.com', phone: '0900000000' },
  event: { title: 'Hòa nhạc Mùa Thu' },
})
beforeEach(() => localStorage.clear())
afterEach(cleanup)
const setup = () =>
  render(
    <MemoryRouter>
      <AdminNotifications />
    </MemoryRouter>,
  )

describe('Chuông thông báo', () => {
  it('bấm chuông mở danh sách đơn cần xử lý thay vì chuyển trang', () => {
    orders = [order('a', 5), order('b', 120)]
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 2 mới' }))
    expect(screen.getByText('2 đơn đang chờ bạn xử lý')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /Số tiền khách trả không khớp/ })
    expect(links[0]).toHaveAttribute('href', '/admin/orders/a')
    expect(screen.getByRole('link', { name: 'Xem tất cả đơn cần xử lý →' })).toHaveAttribute(
      'href',
      '/admin/orders?status=NEEDS_REVIEW',
    )
  })
  it('đánh dấu đã đọc thì tắt số đếm, đơn vẫn còn trong danh sách', () => {
    orders = [order('a', 5)]
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 mới' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc' }))
    expect(screen.getByRole('button', { name: 'Thông báo' })).toBeInTheDocument()
    expect(screen.getByText('1 đơn đang chờ bạn xử lý')).toBeInTheDocument()
  })
  it('không còn đơn cần xử lý thì báo rõ', () => {
    orders = []
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }))
    expect(screen.getByText('Mọi đơn đã được xử lý.')).toBeInTheDocument()
  })
})
