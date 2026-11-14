import { expect, it } from 'vitest'
import { safeAuditJson } from './audit'
import { csvText } from '@/design/admin/data'
it('ẩn thông tin xác thực và dữ liệu cá nhân lồng nhau trong audit', () => {
  const result = JSON.parse(
    safeAuditJson({ after: { qr_token: 'private', buyer: { email: 'private', phone: 'private' }, status: 'PAID' } }),
  )
  expect(result.after).toEqual({ qr_token: '[đã ẩn]', buyer: { email: '[đã ẩn]', phone: '[đã ẩn]' }, status: 'PAID' })
})
it('xuất CSV không thực thi công thức và giữ dấu nháy, xuống dòng', () => {
  expect(csvText([['=HYPERLINK("bad")', ' +1', 'a\nb', 'A"B']])).toBe(
    '\uFEFF"\'=HYPERLINK(""bad"")","\' +1","a\nb","A""B"',
  )
})
