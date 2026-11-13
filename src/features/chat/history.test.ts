import { beforeEach, describe, expect, it } from 'vitest'

import { groupHistory, loadHistory, upsertHistory, type HistoryEntry } from './history'

const DAY = 86_400_000
const now = new Date('2026-11-13T12:00:00').getTime()
const entry = (id: string, ageMs: number): HistoryEntry => ({
  id,
  title: id,
  preview: '',
  tag: 'QA',
  updatedAt: now - ageMs,
})

describe('lịch sử hội thoại', () => {
  beforeEach(() => localStorage.clear())

  it('chỉ giữ 90 ngày và sắp mới nhất trước', () => {
    upsertHistory('u1', 'buyer', entry('cũ', 91 * DAY))
    upsertHistory('u1', 'buyer', entry('a', 2 * DAY))
    upsertHistory('u1', 'buyer', entry('b', 1000))
    expect(loadHistory('u1', 'buyer', now).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('mỗi người dùng một chỉ mục riêng, cập nhật cùng id thì thay thế', () => {
    upsertHistory('u1', 'buyer', entry('a', 0))
    upsertHistory('u1', 'buyer', { ...entry('a', 0), title: 'mới' })
    expect(loadHistory('u1', 'buyer', now)).toHaveLength(1)
    expect(loadHistory('u1', 'buyer', now)[0]?.title).toBe('mới')
    expect(loadHistory('u2', 'buyer', now)).toEqual([])
  })

  it('nhóm theo Hôm nay / Hôm qua / Tuần trước / Cũ hơn', () => {
    const groups = groupHistory(
      [entry('1', 1000), entry('2', 18 * 3600_000), entry('3', 4 * DAY), entry('4', 30 * DAY)],
      now,
    )
    expect(groups.map((g) => g.label)).toEqual(['Hôm nay', 'Hôm qua', 'Tuần trước', 'Cũ hơn'])
  })
})
