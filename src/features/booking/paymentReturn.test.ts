import { describe, expect, it } from 'vitest'

import { responseMessage, returnKind } from './paymentReturn'

describe('paymentReturn', () => {
  it('mã 00 vẫn là đang xác nhận, chờ IPN', () => {
    expect(returnKind('00')).toBe('confirming')
  })
  it('mã khác 00 hoặc thiếu mã là chưa thành công', () => {
    expect(returnKind('24')).toBe('failed')
    expect(returnKind(null)).toBe('failed')
  })
  it('mô tả mã đã biết và mã lạ', () => {
    expect(responseMessage('24')).toBe('Khách huỷ giao dịch')
    expect(responseMessage('xx')).toBe('Giao dịch không thành công')
  })
})
