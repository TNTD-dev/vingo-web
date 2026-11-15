import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSeatmapSvg } from '@/api/generated/endpoints/search/search'

import { loadSeatLayoutSvg } from './svgSource'

vi.mock('@/api/generated/endpoints/search/search', () => ({ getSeatmapSvg: vi.fn() }))

const svgBlob = (text: string) => new Blob([text], { type: 'image/svg+xml' })

describe('loadSeatLayoutSvg', () => {
  beforeEach(() => {
    vi.mocked(getSeatmapSvg).mockReset()
    vi.stubEnv('VITE_USE_MOCK', 'false')
  })

  it('gọi getSeatmapSvg theo suất và trả SVG đã làm sạch', async () => {
    vi.mocked(getSeatmapSvg).mockResolvedValue(
      svgBlob('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><g id="zone-A"/></svg>'),
    )

    const svg = await loadSeatLayoutSvg('st-1')

    expect(getSeatmapSvg).toHaveBeenCalledWith('st-1')
    expect(svg).toContain('zone-A')
    expect(svg).not.toContain('<script')
  })

  it('ném SEAT_LAYOUT_SVG_INVALID khi nội dung không phải SVG', async () => {
    vi.mocked(getSeatmapSvg).mockResolvedValue(svgBlob('<html></html>'))

    await expect(loadSeatLayoutSvg('st-1')).rejects.toThrow('SEAT_LAYOUT_SVG_INVALID')
  })

  it('để lỗi API (vd. 404) đi tiếp cho trang xử lý', async () => {
    const error = new Error('NOT_FOUND')
    vi.mocked(getSeatmapSvg).mockRejectedValue(error)

    await expect(loadSeatLayoutSvg('st-1')).rejects.toBe(error)
  })
})
