import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminTicketsPage from './AdminTicketsPage'

vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
vi.mock('@/design/admin/AdminNotifications', () => ({ AdminNotifications: () => null }))
vi.mock('@/design/admin/data', async (original) => ({
  ...(await original<typeof import('@/design/admin/data')>()),
  useEventDirectory: () => ({
    data: [
      { id: 'event', title: 'Sự kiện A' },
      { id: 'empty', title: 'Sự kiện chưa có suất' },
    ],
  }),
}))
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', () => ({
  useGetAdminEvent: (id: string) => ({
    data: { showtimes: id === 'event' ? [{ id: 'show-A', starts_at: '2026-12-20T12:00:00Z' }] : [] },
    isPending: false,
    error: null,
  }),
}))
const sample = {
  id: 'ticket',
  code: 'VT-OTHER',
  status: 'ISSUED',
  order_code: 'SEED07',
  zone: 'Khu A',
  row: 'A',
  number: 15,
  tier: 'Vàng',
  event: { title: 'Hòa nhạc Giao hưởng Mùa Thu' },
  showtime: { starts_at: '2026-11-21T12:30:00Z' },
  venue: { name: 'Nhà hát Lớn' },
}
let next: string | null = null
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  adminListTickets: vi.fn(
    async ({ showtime_id, status, cursor }: { showtime_id?: string; status?: string; cursor?: string }) => {
      if (cursor === 'c2') return { data: [{ ...sample, id: 'second', code: 'VT-SECOND' }], next_cursor: null }
      return {
        data: [{ ...sample, code: showtime_id === 'show-A' ? 'VT-A' : 'VT-OTHER', status: status ?? 'ISSUED' }],
        next_cursor: next,
      }
    },
  ),
  voidTicket: vi.fn(),
  reissueTicketQr: vi.fn(),
  adminResendTicket: vi.fn(),
}))
afterEach(() => {
  cleanup()
  next = null
})
function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AdminTicketsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
describe('Lọc vé theo sự kiện', () => {
  it('chọn suất của sự kiện trước khi hiển thị vé, không giữ vé của sự kiện khác', async () => {
    setup()
    expect(await screen.findByText('VT-OTHER')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Sự kiện' }), { target: { value: 'event' } })
    expect(screen.getByRole('combobox', { name: 'Suất diễn' })).toHaveValue('show-A')
    expect(await screen.findByText('VT-A')).toBeInTheDocument()
    expect(screen.queryByText('VT-OTHER')).not.toBeInTheDocument()
  })
  it('không hiển thị vé của sự kiện khác khi sự kiện được chọn chưa có suất', () => {
    setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'Sự kiện' }), { target: { value: 'empty' } })
    expect(screen.getByRole('combobox', { name: 'Suất diễn' })).toHaveTextContent('Chưa có suất diễn')
    expect(screen.queryByText('VT-OTHER')).not.toBeInTheDocument()
  })
})
describe('Danh sách vé theo thiết kế mới', () => {
  it('hiện sự kiện · suất, chỗ ngồi bằng chữ kèm hạng vé và trạng thái tiếng Việt', async () => {
    setup()
    const row = (await screen.findByText('VT-OTHER')).closest('tr')!
    expect(within(row).getByText('Hòa nhạc Giao hưởng Mùa Thu')).toBeInTheDocument()
    expect(within(row).getByText(/21\/11 · 19:30 · Nhà hát Lớn/)).toBeInTheDocument()
    expect(within(row).getByText('Khu A · Hàng A · Ghế 15')).toBeInTheDocument()
    expect(within(row).getByText('Hạng Vàng')).toBeInTheDocument()
    expect(within(row).getByText('Hợp lệ')).toBeInTheDocument()
    expect(screen.queryByText('ISSUED')).not.toBeInTheDocument()
  })
  it('vé hợp lệ có nút "Gửi lại" ngay trên dòng, vé đã quét thì không', async () => {
    setup()
    expect(await screen.findByRole('button', { name: /Gửi lại/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đã quét' }))
    await screen.findByText('Đã quét', { selector: 'span' })
    expect(screen.queryByRole('button', { name: /Gửi lại/ })).not.toBeInTheDocument()
  })
  it('tab trạng thái tiếng Việt nằm cùng hàng với lọc sự kiện và suất', () => {
    setup()
    for (const name of ['Tất cả', 'Hợp lệ', 'Đã quét', 'Đã huỷ'])
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Suất diễn' })).toBeDisabled()
  })
  it('"Tải thêm" nối trang kế tiếp vào cuối danh sách', async () => {
    next = 'c2'
    setup()
    await screen.findByText('VT-OTHER')
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm 20 vé' }))
    expect(await screen.findByText('VT-SECOND')).toBeInTheDocument()
    expect(screen.getByText('VT-OTHER')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tải thêm 20 vé' })).not.toBeInTheDocument()
  })
})
