import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveReview, reconcileOrder } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { ApiError } from '@/api/problem'
import OrderReviewPanel from './OrderReviewPanel'
const baseOrder = {
  id: 'order',
  code: 'VG-1',
  status: 'NEEDS_REVIEW',
  review_reason: 'PAID_AFTER_EXPIRY',
  total_amount: 300000,
  payments: [],
  history: [],
}
let order: Record<string, unknown> = baseOrder
vi.mock('@/api/generated/endpoints/admin-operations/admin-operations', () => ({
  resolveReview: vi.fn(),
  reconcileOrder: vi.fn(),
  useAdminGetOrder: () => ({ data: order, isPending: false, error: null, refetch: vi.fn() }),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  order = baseOrder
})
function setup(note = true) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <OrderReviewPanel orderId="order" />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  if (note)
    fireEvent.change(screen.getByLabelText(/Ghi chú xử lý/), { target: { value: 'Đã đối chiếu, ghế còn trống' } })
}
describe('Xử lý đơn cần duyệt', () => {
  it('giữ nguyên Idempotency-Key khi thử lại cùng quyết định sau lỗi mạng', async () => {
    vi.mocked(resolveReview)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'order', status: 'PAID' })
    setup()
    const button = screen.getByRole('button', { name: 'Phát hành vé và gửi email' })
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
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã hoàn tiền thủ công' }))
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
    fireEvent.click(screen.getByText('Công cụ khác'))
    fireEvent.click(screen.getByRole('button', { name: 'Đối soát lại với VNPay' }))
    expect(await screen.findByText(/chưa được hỗ trợ ở phía máy chủ/)).toBeInTheDocument()
  })
  it('nút bị khoá thì ghi rõ lý do, mở khoá khi đã có ghi chú', () => {
    setup(false)
    const issue = screen.getByRole('button', { name: 'Phát hành vé và gửi email' }),
      refund = screen.getByRole('button', { name: 'Ghi nhận đã hoàn tiền thủ công' })
    expect(issue).toBeDisabled()
    expect(refund).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Nhập ghi chú xử lý')
    expect(issue).toHaveAccessibleDescription(/Nhập ghi chú xử lý/)
    fireEvent.change(screen.getByLabelText(/Ghi chú xử lý/), { target: { value: 'ok rồi' } })
    expect(issue).toBeEnabled()
    expect(refund).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('dùng nhãn tiếng Việt, không lộ tên kỹ thuật, và tính số phút tiền về trễ', () => {
    order = {
      ...baseOrder,
      expires_at: '2026-11-09T10:30:00Z',
      history: [
        { status: 'PENDING', at: '2026-11-09T10:20:00Z' },
        { status: 'NEEDS_REVIEW', at: '2026-11-09T10:38:00Z' },
      ],
    }
    setup()
    expect(screen.getByText('Tiền về trễ 8 phút sau khi hết hạn giữ ghế')).toBeInTheDocument()
    expect(screen.getByText('Hết hạn giữ ghế')).toBeInTheDocument()
    expect(screen.getByText('Chờ bạn quyết định')).toBeInTheDocument()
    expect(screen.queryByText(/NEEDS_REVIEW|ISSUE_TICKETS|vnp_/)).not.toBeInTheDocument()
  })
  it('ẩn thẻ "Ghế trong đơn" khi API không trả dòng vé, hiện khi có', () => {
    setup()
    expect(screen.queryByText('Ghế trong đơn')).not.toBeInTheDocument()
    cleanup()
    order = {
      ...baseOrder,
      items: [{ id: 'i1', zone: 'Khu A', row: 'C', number: 12, tier: 'Vàng', unit_price: 150000, quantity: 1 }],
    }
    setup()
    expect(screen.getByText('Ghế trong đơn')).toBeInTheDocument()
    expect(screen.getByText('Khu A · Hàng C · Ghế 12')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phát hành 1 vé và gửi email' })).toBeInTheDocument()
  })
})
