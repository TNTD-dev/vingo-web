import { describe, expect, it } from 'vitest'

import { parseConfirmAction, parseEventList, parsePaymentQr, parseSeatMap, parseTicket } from './payloads'

describe('parse payload block', () => {
  it('payload rỗng hoặc sai kiểu không làm văng lỗi', () => {
    expect(() =>
      [parseConfirmAction, parseEventList, parsePaymentQr, parseSeatMap, parseTicket].forEach((p) => p({})),
    ).not.toThrow()
    expect(parseEventList({ payload: { events: 'x' } }).events).toEqual([])
    expect(parsePaymentQr({ payload: { total_amount: '1200' } }).totalAmount).toBeUndefined()
  })

  it('ConfirmAction: bỏ dòng thiếu nhãn/giá trị, có nhãn nút mặc định', () => {
    const p = parseConfirmAction({
      payload: { action_id: 'a1', rows: [{ label: 'Tổng', value: '1.200.000đ', strong: true }, { label: 'thiếu' }] },
    })
    expect(p.rows).toEqual([{ label: 'Tổng', value: '1.200.000đ', strong: true }])
    expect(p.confirmLabel).toBe('Đồng ý')
  })

  it('SeatMap: ghế đề xuất được chọn sẵn', () => {
    const p = parseSeatMap({
      payload: {
        rows: [
          [
            { id: 'J-21', state: 'available' },
            { id: 'J-22', state: 'sold' },
          ],
        ],
        suggested: ['J-21'],
      },
    })
    expect(p.selected).toEqual(['J-21'])
    expect(p.rows[0]?.[1]?.state).toBe('sold')
  })
})
