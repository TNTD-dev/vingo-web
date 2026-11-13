import { describe, expect, it } from 'vitest'

import { groupTickets, seatSummary } from './ticketGroups'

const t = (showtime: string, zone: string, row?: string, number?: number) => ({
  id: `${showtime}${zone}${number}`,
  showtime: { id: showtime },
  zone,
  row,
  number,
})

describe('ticketGroups', () => {
  it('gom vé cùng suất diễn', () => {
    expect(
      groupTickets([t('s1', 'B', 'B', 14), t('s2', 'GA'), t('s1', 'B', 'B', 15)]).map((g) => g.tickets.length),
    ).toEqual([2, 1])
  })
  it('tóm tắt ghế theo khu', () => {
    expect(seatSummary([t('s1', 'B', 'B', 14), t('s1', 'B', 'B', 15)])).toBe('Khu B · B-14, B-15')
    expect(seatSummary([t('s1', 'GA')])).toBe('Khu GA · Đứng')
  })
  it('gộp vé đứng thành một cụm', () => {
    expect(seatSummary([t('s1', 'GA'), t('s1', 'GA', undefined, 2), t('s1', 'GA', undefined, 3)])).toBe(
      'Khu GA · 3 vé đứng',
    )
  })
})
