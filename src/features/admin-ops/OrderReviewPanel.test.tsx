import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveReview, reconcileOrder } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { ApiError } from '@/api/problem'
import OrderReviewPanel from './OrderReviewPanel'
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  resolveReview: vi.fn(),
  reconcileOrder: vi.fn(),
  useAdminGetOrder: () => ({
    data: {
      id: 'order',
      code: 'VG-1',
      status: 'NEEDS_REVIEW',
      review_reason: 'PAID_AFTER_EXPIRY',
      total_amount: 300000,
      payments: [],
      history: [],
    },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
function setup() {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <OrderReviewPanel orderId="order" onClose={vi.fn()} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  fireEvent.change(screen.getByLabelText('Ghi chú xử lý'), { target: { value: 'Đã đối chiếu, ghế còn trống' } })
}
describe('Xử lý đơn cần duyệt', () => {
  it('giữ nguyên Idempotency-Key khi thử lại cùng quyết định sau lỗi mạng', async () => {
    vi.mocked(resolveReview)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'order', status: 'PAID' })
    setup()
    const button = screen.getByRole('button', { name: 'Phát hành vé (ISSUE_TICKETS)' })
    fireEvent.click(button)
    await screen.findByRole('alert')
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(resolveReview).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(resolveReview).mock.calls
    expect(calls[0][2]).toEqual(calls[1][2])
    expect(calls[0][2]?.headers).toHaveProperty('Idempotency-Key')
    expect(calls[0][1]).toEqual({ action: 'ISSUE_TICKETS', reason: 'Đã đối chiếu, ghế còn trống' })
  })
  it('chỉ ghi nhận REFUND sau khi xác nhận đã hoàn tiền thủ công', async () => {
    vi.mocked(resolveReview).mockResolvedValue({ id: 'order', status: 'REFUNDED' })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã hoàn tiền thủ công' }))
    expect(resolveReview).not.toHaveBeenCalled()
    expect(screen.getByText(/không chuyển tiền/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Xác nhận$/ }))
    await waitFor(() =>
      expect(resolveReview).toHaveBeenCalledWith(
        'order',
        { action: 'REFUND', reason: 'Đã đối chiếu, ghế còn trống' },
        expect.objectContaining({ headers: expect.any(Object) }),
      ),
    )
  })
  it('đối soát chưa được backend hỗ trợ (501) thì báo rõ, không vỡ trang', async () => {
    vi.mocked(reconcileOrder).mockRejectedValueOnce(new ApiError(501, null))
    setup()
    fireEvent.click(screen.getByText('Người mua, vé & đối soát'))
    fireEvent.click(screen.getByRole('button', { name: 'Đối soát lại với VNPay' }))
    expect(await screen.findByText(/chưa được hỗ trợ ở phía máy chủ/)).toBeInTheDocument()
  })
})
