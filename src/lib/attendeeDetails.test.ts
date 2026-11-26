import { expect, it } from 'vitest'

import { normalizeAttendeeDetails, validateAttendee } from './attendeeDetails'

it('tên từ 1 đến 120 ký tự Unicode sau khi cắt khoảng trắng, email và điện thoại có thể bỏ trống', () => {
  for (const name of ['Ý', '𠮷'.repeat(120)]) {
    const input = normalizeAttendeeDetails({ full_name: ' ' + name + ' ', email: ' ', phone: '' })
    expect(input).toEqual({ full_name: name, email: undefined, phone: undefined })
    expect(validateAttendee(input)).toEqual({})
  }
  for (const full_name of [' ', 'a'.repeat(121)]) {
    expect(validateAttendee(normalizeAttendeeDetails({ full_name }))).toHaveProperty('full_name')
  }
})

it('giữ số quốc tế dạng E.164, chấp nhận số Việt Nam có phân cách và giới hạn email 254 ký tự', () => {
  const email = 'a'.repeat(64) + '@' + ['b'.repeat(63), 'c'.repeat(63), 'd'.repeat(61)].join('.')
  expect(email).toHaveLength(254)
  for (const [phone, expected] of [
    ['+12025550123', '+12025550123'],
    ['84 901-234-567', '+84901234567'],
  ]) {
    const input = normalizeAttendeeDetails({ full_name: 'An', email, phone })
    expect(input.phone).toBe(expected)
    expect(validateAttendee(input)).toEqual({})
    expect(validateAttendee({ ...input, email: email + 'a' })).toHaveProperty('email')
  }
})
