import { describe, expect, it } from 'vitest'

import {
  ERASE_MS,
  HOLD_MS,
  TYPE_MS,
  typewriterStart,
  typewriterStep,
  typewriterText,
  type TypewriterState,
} from './typewriter'

const S = ['ab', 'xyz']

function run(steps: number) {
  let state: TypewriterState = typewriterStart
  const log: { text: string; delay: number }[] = []
  for (let i = 0; i < steps; i++) {
    const r = typewriterStep(state, S)
    state = r.state
    log.push({ text: typewriterText(state, S), delay: r.delay })
  }
  return log
}

describe('typewriterStep', () => {
  it('gõ từng ký tự rồi giữ nguyên câu đầy đủ trong 1,6s', () => {
    expect(run(2)).toEqual([
      { text: 'a', delay: TYPE_MS },
      { text: 'ab', delay: HOLD_MS },
    ])
  })

  it('xoá từng ký tự nhanh hơn rồi sang câu kế tiếp', () => {
    expect(run(5).slice(2)).toEqual([
      { text: 'ab', delay: ERASE_MS }, // hết giữ, bắt đầu xoá
      { text: 'a', delay: ERASE_MS },
      { text: '', delay: TYPE_MS }, // sang câu 2
    ])
    expect(run(6)[5].text).toBe('x')
  })

  it('quay vòng về câu đầu sau câu cuối', () => {
    const texts = run(20).map((l) => l.text)
    expect(texts.filter((t) => t === 'ab').length).toBeGreaterThan(1)
  })
})
