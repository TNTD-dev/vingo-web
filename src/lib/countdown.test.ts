import { describe, expect, it } from 'vitest'

import { formatCountdown, remainingSeconds } from './countdown'

describe('remainingSeconds', () => {
  const end = '2026-11-21T10:10:00Z'
  const at = (iso: string) => new Date(iso).getTime()

  it('tính số giây còn lại, làm tròn lên', () => {
    expect(remainingSeconds(end, at('2026-11-21T10:00:00Z'))).toBe(600)
    expect(remainingSeconds(end, at('2026-11-21T10:09:59.400Z'))).toBe(1)
  })

  it('hết hạn hoặc giá trị sai thì bằng 0', () => {
    expect(remainingSeconds(end, at('2026-11-21T10:10:00Z'))).toBe(0)
    expect(remainingSeconds(end, at('2026-11-21T11:00:00Z'))).toBe(0)
    expect(remainingSeconds('khong-phai-ngay', 0)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('phút:giây hai chữ số', () => {
    expect(formatCountdown(552)).toBe('09:12')
    expect(formatCountdown(59)).toBe('00:59')
    expect(formatCountdown(0)).toBe('00:00')
  })

  it('quá một giờ có thêm giờ, số âm coi như 0', () => {
    expect(formatCountdown(3725)).toBe('1:02:05')
    expect(formatCountdown(-5)).toBe('00:00')
  })
})
