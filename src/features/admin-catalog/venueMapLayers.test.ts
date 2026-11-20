import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from '@/seatmap/svg'
import { filterVenueMapLayers } from './venueMapLayers'

const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><clipPath id="clip"><rect width="100" height="100"/></clipPath></defs>
  <g transform="translate(10 20)"><rect id="PITCH" width="50" height="50" visibility="visible"/>
    <g id="GATE__A__01"><path id="arrow" d="M0 0L1 1" visibility="visible"/></g>
    <text id="GATE_LABEL__A__01">1</text>
    <g id="SEAT__A__R1__01"><circle cx="1" cy="1" r="1" visibility="visible"/></g>
  </g>
</svg>`
function read(svg: string) {
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

describe('lớp sơ đồ sân', () => {
  it('ẩn ghế và cổng kể cả khi phần tử con có visibility riêng, giữ nền', () => {
    const doc = read(sanitizeSvg(filterVenueMapLayers(source, { background: true, seats: false, gates: false }))!)
    expect(doc.getElementById('SEAT__A__R1__01')?.getAttribute('style')).toContain('display:none')
    expect(doc.getElementById('GATE__A__01')?.getAttribute('style')).toContain('display:none')
    expect(doc.getElementById('GATE_LABEL__A__01')?.getAttribute('style')).toContain('display:none')
    expect(doc.getElementById('PITCH')?.getAttribute('style')).toBeNull()
  })
  it('ẩn nền độc lập với cổng và giữ phép biến đổi, viewBox và clipPath', () => {
    const doc = read(filterVenueMapLayers(source, { background: false, seats: true, gates: true }, true))
    expect(doc.getElementById('PITCH')?.getAttribute('style')).toContain('display:none')
    expect(doc.getElementById('arrow')?.getAttribute('style')).toBeNull()
    expect(doc.querySelector('clipPath rect')?.getAttribute('style')).toBeNull()
    expect(doc.querySelector('[transform]')?.getAttribute('transform')).toBe('translate(10 20)')
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(
      read(filterVenueMapLayers(source, { background: true, seats: true, gates: true }, true))
        .getElementById('PITCH')
        ?.getAttribute('style'),
    ).toBeNull()
  })
})
