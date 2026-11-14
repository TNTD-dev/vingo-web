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

import { orderCodeFromTxnRef, returnView } from './paymentReturn'

describe('trang trả về theo txn_ref', () => {
  it('lấy mã đơn từ txn_ref bỏ hậu tố lần thử', () => {
    expect(orderCodeFromTxnRef('VG260101-AB12-2')).toBe('VG260101-AB12')
    expect(orderCodeFromTxnRef(null)).toBeUndefined()
  })
  it('đơn PAID → paid, kể cả khi thiếu thông tin thanh toán', () => {
    expect(returnView({ status: 'PAID' }, undefined)).toBe('paid')
  })
  it('đơn PENDING và lần thanh toán còn OPEN → vẫn chờ IPN', () => {
    expect(returnView({ status: 'PENDING' }, { status: 'OPEN' })).toBe('confirming')
  })
  it('lần thanh toán FAILED → chưa thành công', () => {
    expect(returnView({ status: 'PENDING' }, { status: 'FAILED' })).toBe('failed')
  })
  it('đơn hết hạn hoặc đã huỷ → chưa thành công', () => {
    expect(returnView({ status: 'EXPIRED' }, undefined)).toBe('failed')
  })
  it('đơn cần duyệt → review', () => {
    expect(returnView({ status: 'NEEDS_REVIEW' }, undefined)).toBe('review')
  })
})
