import { describe, expect, it } from 'vitest'

import { formatCountdown, secondsLeft } from './countdown'

describe('countdown', () => {
  it('định dạng mm:ss', () => {
    expect(formatCountdown(522)).toBe('08:42')
    expect(formatCountdown(0)).toBe('00:00')
  })

  it('số giây còn lại không âm, không có hạn thì undefined', () => {
    const now = Date.parse('2026-11-13T10:00:00Z')
    expect(secondsLeft('2026-11-13T10:10:00Z', now)).toBe(600)
    expect(secondsLeft('2026-11-13T09:00:00Z', now)).toBe(0)
    expect(secondsLeft(undefined, now)).toBeUndefined()
    expect(secondsLeft('không phải ngày', now)).toBeUndefined()
  })
})
