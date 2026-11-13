import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { BlockView } from './registry'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('bảng duyệt hàng loạt (block)', () => {
  const block = {
    id: 't',
    type: 'OrderSummary' as const,
    payload: {
      view: 'review_table',
      orders: [
        { order_id: 'o1', code: '#VG-1', reason: 'Trả sau hạn', proposal: 'ISSUE_TICKETS', status_label: 'Sẵn sàng' },
        { order_id: 'o2', code: '#VG-2', reason: 'Trả sau huỷ', proposal: 'ISSUE_TICKETS', status_label: 'Sẵn sàng' },
        { order_id: 'o3', code: '#VG-3', reason: 'Lệch số tiền', proposal: 'REFUND', status_label: 'Cần bạn xem' },
      ],
    },
  }

  it('không có lựa chọn hoàn tiền, chỉ phát hành vé hoặc để sau', () => {
    wrap(<BlockView block={block} />)
    const select = screen.getByRole('combobox', { name: /đơn #VG-3/ })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Phát hành vé', 'Để sau'])
    expect(screen.queryByText(/hoàn tiền/i)).toBeNull()
  })

  it('bỏ chọn một đơn rồi cập nhật: gửi đúng các đơn còn lại, báo dirty để khoá ConfirmAction', async () => {
    const onBlockEvent = vi.fn()
    const onDirtyChange = vi.fn()
    wrap(<BlockView block={block} onBlockEvent={onBlockEvent} onDirtyChange={onDirtyChange} />)
    expect(screen.getByText(/Sẽ duyệt 2\/3 đơn/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: /đơn #VG-1/ }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)

    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật đề xuất' }))
    expect(onBlockEvent).toHaveBeenCalledWith(
      'review.change',
      { decisions: [{ order_id: 'o2', action: 'ISSUE_TICKETS' }] },
      expect.stringContaining('1/3'),
    )
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('form suất diễn (block)', () => {
  const block = {
    id: 'f',
    type: 'EventList' as const,
    payload: {
      view: 'showtime_form',
      title: 'Suất mới · HAGL vs Nam Định',
      fields: [
        { key: 'start', label: 'Bắt đầu', value: '17:00 T7 28/11' },
        { key: 'end', label: 'Kết thúc', value: '19:00 T7 28/11' },
      ],
      prices: [{ key: 'c', label: 'Khu C', value: '220.000đ (−12%)', changed: true }],
    },
  }

  it('ô Vingo điền sửa được: sửa xong gửi đủ giá trị mới, ô vừa sửa mất dấu Vingo', async () => {
    const onBlockEvent = vi.fn()
    wrap(<BlockView block={block} onBlockEvent={onBlockEvent} />)
    const start = screen.getByLabelText(/bắt đầu/i)
    const end = screen.getByLabelText(/kết thúc/i)
    expect(start).toHaveValue('17:00 T7 28/11')
    expect(screen.getAllByLabelText('Vingo điền')).toHaveLength(2)

    await userEvent.clear(start)
    await userEvent.type(start, '18:00 T7 28/11')
    expect(screen.getAllByLabelText('Vingo điền')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    expect(onBlockEvent).toHaveBeenCalledWith(
      'showtime.edit',
      { fields: { start: '18:00 T7 28/11', end: '19:00 T7 28/11' } },
      expect.stringContaining('bắt đầu'),
    )
    expect(end).toHaveValue('19:00 T7 28/11')
  })

  it('không cho gửi khi xoá trống một ô', async () => {
    wrap(<BlockView block={block} onBlockEvent={vi.fn()} />)
    await userEvent.clear(screen.getByLabelText(/bắt đầu/i))
    expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeDisabled()
  })
})

describe('khoá ghế (block)', () => {
  const block = {
    id: 's',
    type: 'SeatMap' as const,
    payload: {
      view: 'seat_lock',
      zone_label: 'Khu A',
      rows: [
        [
          { id: 'A-01', state: 'sold' },
          { id: 'A-02', state: 'available' },
          { id: 'A-03', state: 'available' },
          { id: 'A-04', state: 'available' },
        ],
      ],
      selected: ['A-01', 'A-02'],
    },
  }

  it('ghế đã bán không chạm được và không nằm trong danh sách khoá, kể cả khi agent đề xuất', async () => {
    const onBlockEvent = vi.fn()
    wrap(<BlockView block={block} onBlockEvent={onBlockEvent} />)
    const sold = screen.getByRole('button', { name: /A-01.*đã bán/ })
    expect(sold).toBeDisabled()
    expect(sold).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Vingo đề xuất · A-02/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Ghế A-03' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật ghế' }))
    expect(onBlockEvent).toHaveBeenCalledWith(
      'seatmap.select',
      { mode: 'block', seats: ['A-02', 'A-03'] },
      expect.any(String),
    )
  })

  it('chạm ghế đang chọn thì bớt khỏi danh sách', async () => {
    const onDirtyChange = vi.fn()
    wrap(<BlockView block={block} onDirtyChange={onDirtyChange} />)
    await userEvent.click(screen.getByRole('button', { name: /A-02, sẽ khoá/ }))
    expect(screen.getByText('Chưa chọn ghế nào')).toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})

describe('ConfirmAction khi block phía trên còn chỉnh sửa chưa gửi', () => {
  const confirm = {
    id: 'c',
    type: 'ConfirmAction' as const,
    payload: { action_id: 'act1', title: 'Phát hành vé cho 3 đơn', confirm_label: 'Duyệt 3 đơn' },
  }

  it('khoá nút duyệt và không gọi onDecide', async () => {
    const onDecide = vi.fn()
    wrap(<BlockView block={confirm} onDecide={onDecide} stale />)
    const btn = screen.getByRole('button', { name: 'Duyệt 3 đơn' })
    expect(btn).toBeDisabled()
    await userEvent.click(btn)
    expect(onDecide).not.toHaveBeenCalled()
  })
})
