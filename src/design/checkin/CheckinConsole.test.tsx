import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CheckinConsole } from './CheckinConsole'
import { scanTicket } from './scan'

vi.mock('@/design/admin/data', async (original) => ({
  ...(await original<typeof import('@/design/admin/data')>()),
  useEventDirectory: () => ({ data: [{ id: 'ev', title: 'Hòa nhạc Mùa Thu', status: 'PUBLISHED' }], isPending: false }),
}))
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', () => ({
  useGetAdminEvent: () => ({
    data: {
      id: 'ev',
      title: 'Hòa nhạc Mùa Thu',
      showtimes: [
        { id: 'show-2', status: 'ON_SALE', starts_at: '2026-11-28T12:30:00Z' },
        { id: 'show-1', status: 'ON_SALE', starts_at: '2026-11-21T12:30:00Z' },
        { id: 'old', status: 'FINISHED', starts_at: '2026-11-01T12:30:00Z' },
      ],
    },
    isPending: false,
    error: null,
  }),
}))
vi.mock('@/api/generated/endpoints/check-in/check-in', () => ({
  useListShowtimeCheckins: () => ({ data: { data: [], next_cursor: null }, isPending: false, error: null }),
}))
vi.mock('@/api/generated/endpoints/admin-reports/admin-reports', () => ({
  useQueryMetric: ({ metric }: { metric: string }) => ({ data: { value: metric === 'checkins' ? 12 : 300 } }),
}))
vi.mock('./scan', async (original) => ({
  ...(await original<typeof import('./scan')>()),
  scanTicket: vi.fn().mockResolvedValue({ result: 'OK', ticket_code: 'VT-1', zone: 'A', row: 'C', number: 12 }),
}))

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const setup = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CheckinConsole
        header={({ title, actions }) => (
          <header>
            <h1>{title}</h1>
            {actions}
          </header>
        )}
      />
    </QueryClientProvider>,
  )

describe('Soát vé tại cổng', () => {
  it('chọn suất và cổng ngay trên trang rồi vào chế độ soát vé', () => {
    setup()
    expect(screen.getByRole('radio', { name: /19:30.*T7 21\/11/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('radio', { name: /01\/11/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Bắt đầu soát vé' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'Cổng B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu soát vé' }))
    expect(screen.getByLabelText('Ca soát vé hiện tại')).toHaveTextContent('Cổng B')
    expect(screen.getByLabelText('Ca soát vé hiện tại')).toHaveTextContent('T7 21/11 · 19:30')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('/ 300 vé đã bán')).toBeInTheDocument()
  })
  it('quét bằng máy đọc QR: nhập mã rồi Enter, gửi kèm suất và cổng', async () => {
    localStorage.setItem(
      'vingo.checkin.session',
      JSON.stringify({ eventId: 'ev', showtimeId: 'show-1', gate: 'Cổng A' }),
    )
    setup()
    const input = screen.getByRole('textbox', { name: 'Mã QR trên vé' })
    fireEvent.change(input, { target: { value: 'QR-123' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(screen.getByText('HỢP LỆ · CHO VÀO')).toBeInTheDocument())
    expect(scanTicket).toHaveBeenCalledWith({ qr_token: 'QR-123', showtime_id: 'show-1', gate: 'Cổng A' })
    expect(screen.getByText(/Khu A · Hàng C · Ghế 12/)).toBeInTheDocument()
  })
  it('nhớ ca soát vé, bấm “Đổi suất / cổng” để chọn lại', () => {
    localStorage.setItem(
      'vingo.checkin.session',
      JSON.stringify({ eventId: 'ev', showtimeId: 'show-2', gate: 'Cổng A' }),
    )
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Đổi suất / cổng' }))
    expect(screen.getByRole('radio', { name: /T7 28\/11/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Cổng A' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại soát vé' }))
    expect(screen.getByLabelText('Ca soát vé hiện tại')).toBeInTheDocument()
  })
})
