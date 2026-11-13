import { describe, expect, it } from 'vitest'

import { agentPath } from './agentLink'

describe('agentPath', () => {
  it('không có câu hỏi thì chỉ vào /vingo', () => {
    expect(agentPath()).toBe('/vingo')
    expect(agentPath('   ')).toBe('/vingo')
  })

  it('mã hoá câu hỏi vào ?q= và bỏ khoảng trắng thừa', () => {
    expect(agentPath('  2 vé HAGL & khán đài B ')).toBe(
      '/vingo?q=2%20v%C3%A9%20HAGL%20%26%20kh%C3%A1n%20%C4%91%C3%A0i%20B',
    )
  })

  it('cắt câu quá dài', () => {
    const url = new URL(agentPath('a'.repeat(900)), 'http://x')
    expect(url.searchParams.get('q')).toHaveLength(500)
  })
})
