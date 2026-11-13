import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ChatBlockType } from '@/api/generated/model'

import { BlockView } from './registry'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('BlockView', () => {
  it.each(Object.values(ChatBlockType))('render được block %s với payload rỗng mà không văng lỗi', (type) => {
    expect(() => wrap(<BlockView block={{ id: '1', type, payload: {} }} />)).not.toThrow()
  })

  it('block không rõ loại hiện thông báo thay vì văng lỗi', () => {
    wrap(<BlockView block={{ id: '1' }} />)
    expect(screen.getByText(/không hỗ trợ/i)).toBeInTheDocument()
  })
})

describe('ConfirmAction', () => {
  const block = {
    id: 'b',
    type: ChatBlockType.ConfirmAction,
    payload: {
      action_id: 'act1',
      title: 'Giữ J-21, J-22',
      confirm_label: 'Đồng ý giữ ghế',
      rows: [{ label: 'Tổng', value: '1.200.000đ' }],
    },
  }

  it('chỉ gọi onDecide khi người dùng bấm, không tự thực thi', async () => {
    const onDecide = vi.fn()
    wrap(<BlockView block={block} onDecide={onDecide} />)
    expect(onDecide).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Đồng ý giữ ghế' }))
    expect(onDecide).toHaveBeenCalledWith('act1', 'confirm')
    await userEvent.click(screen.getByRole('button', { name: 'Từ chối' }))
    expect(onDecide).toHaveBeenLastCalledWith('act1', 'reject')
  })

  it('chưa đăng nhập: nút bị khoá và có nhắc đăng nhập', () => {
    wrap(<BlockView block={block} onDecide={vi.fn()} readOnly />)
    expect(screen.getByRole('button', { name: 'Đồng ý giữ ghế' })).toBeDisabled()
    expect(screen.getByText(/đăng nhập để đồng ý/i)).toBeInTheDocument()
  })

  it('đã đồng ý / đã hết hạn thì thay nút bằng trạng thái', () => {
    const { rerender } = wrap(<BlockView block={block} actionState={{ act1: 'confirmed' }} onDecide={vi.fn()} />)
    expect(screen.getByText('Đã đồng ý')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đồng ý giữ ghế' })).toBeNull()
    rerender(
      <MemoryRouter>
        <BlockView block={block} actionState={{ act1: 'expired' }} onDecide={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/đã hết hạn/i)).toBeInTheDocument()
  })
})

describe('PaymentQR', () => {
  it('hiện số tiền từ API; đơn đã thanh toán thì bỏ nút mở cổng', () => {
    const block = {
      id: 'q',
      type: ChatBlockType.PaymentQR,
      payload: { total_amount: 1_200_000, payment_url: 'https://pay.example/x', status: 'PENDING' },
    }
    const { rerender } = wrap(<BlockView block={block} />)
    expect(screen.getByRole('link', { name: 'Mở cổng VNPay' })).toBeInTheDocument()
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <BlockView block={block} orderPaid />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Mở cổng VNPay' })).toBeNull()
    expect(screen.getByText('PAID')).toBeInTheDocument()
  })

  it('không mở link thanh toán không phải https', () => {
    wrap(
      <BlockView block={{ id: 'q', type: ChatBlockType.PaymentQR, payload: { payment_url: 'javascript:alert(1)' } }} />,
    )
    expect(screen.queryByRole('link', { name: 'Mở cổng VNPay' })).toBeNull()
  })
})
