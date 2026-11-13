import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminTicketsPage from './AdminTicketsPage'

vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
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
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  useAdminListTickets: ({ showtime_id }: { showtime_id?: string }) => ({
    data: { data: [{ id: 'ticket', code: showtime_id === 'show-A' ? 'VT-A' : 'VT-OTHER', status: 'ISSUED' }] },
    isPending: false,
    error: null,
  }),
  useAdminListOrders: () => ({ data: { data: [] } }),
  voidTicket: vi.fn(),
  reissueTicketQr: vi.fn(),
  adminResendTicket: vi.fn(),
}))
afterEach(cleanup)
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
  it('chọn suất của sự kiện trước khi hiển thị vé, không giữ vé của sự kiện khác', () => {
    setup()
    expect(screen.getByText('VT-OTHER')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: 'Sự kiện' }), { target: { value: 'event' } })
    expect(screen.getByRole('combobox', { name: 'Suất diễn' })).toHaveValue('show-A')
    expect(screen.getByText('VT-A')).toBeInTheDocument()
    expect(screen.queryByText('VT-OTHER')).not.toBeInTheDocument()
  })
  it('không hiển thị vé của sự kiện khác khi sự kiện được chọn chưa có suất', () => {
    setup()
    fireEvent.change(screen.getByRole('combobox', { name: 'Sự kiện' }), { target: { value: 'empty' } })
    expect(screen.getByRole('combobox', { name: 'Suất diễn' })).toHaveTextContent('Chưa có suất diễn')
    expect(screen.queryByText('VT-OTHER')).not.toBeInTheDocument()
  })
})
