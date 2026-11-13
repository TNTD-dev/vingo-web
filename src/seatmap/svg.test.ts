import { describe, expect, it } from 'vitest'

import { indexSvg, parseSeatId, parseZoneId, sameZone, sanitizeSvg, seatSvgId, zoneCodeOfPart } from './svg'

describe('parse id theo quy ước v1', () => {
  it('đọc khu ngồi và khu đứng', () => {
    expect(parseZoneId('ZONE__B3-T1__SEATED')).toEqual({ code: 'B3-T1', kind: 'SEATED' })
    expect(parseZoneId('ZONE__C-T2__STANDING__3000')).toEqual({ code: 'C-T2', kind: 'STANDING' })
    expect(parseZoneId('ZONE__A2L-T1__SEATED')?.code).toBe('A2L-T1')
  })

  it('id không đúng quy ước thì trả null', () => {
    expect(parseZoneId('PITCH')).toBeNull()
    expect(parseZoneId('ZONE__B3-T1')).toBeNull()
    expect(parseSeatId('SEAT__B3-T1__A')).toBeNull()
  })

  it('lấy mã khu từ khu, nội dung và nhãn', () => {
    expect(zoneCodeOfPart('CONTENT__B3-T1')).toBe('B3-T1')
    expect(zoneCodeOfPart('LABEL__C-T2')).toBe('C-T2')
    expect(zoneCodeOfPart('ZONE__B1-T1__SEATED')).toBe('B1-T1')
    expect(zoneCodeOfPart('GATE__B-D__01')).toBeNull()
  })

  it('ghế: parse và dựng lại id, số luôn 2 chữ số', () => {
    expect(parseSeatId('SEAT__B3-T1__A__01')).toEqual({ zone: 'B3-T1', row: 'A', number: 1 })
    expect(seatSvgId('B3-T1', 'A', 1)).toBe('SEAT__B3-T1__A__01')
    expect(seatSvgId('B1-T1', 'P', 48)).toBe('SEAT__B1-T1__P__48')
  })
})

describe('sameZone', () => {
  it('khớp tên khu API với mã SVG có hoặc không có hậu tố tầng', () => {
    expect(sameZone('A1-T1', 'A1')).toBe(true)
    expect(sameZone('A1-T1', 'A1-T1')).toBe(true)
    expect(sameZone('A1-T1', 'Khu a1')).toBe(true)
    expect(sameZone('A2L-T1', 'A2R')).toBe(false)
    expect(sameZone('A1-T1', undefined)).toBe(false)
  })
})

describe('sanitizeSvg', () => {
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`

  it('giữ phần tử đồ hoạ và id', () => {
    const out = sanitizeSvg(wrap('<g id="ZONE__A-T1__SEATED"><path id="v" d="M0 0L1 1" fill="#fff"/></g>'))
    expect(out).toContain('id="ZONE__A-T1__SEATED"')
    expect(out).toContain('d="M0 0L1 1"')
  })

  it('xoá script, foreignObject, ảnh và thuộc tính sự kiện', () => {
    const out = sanitizeSvg(
      wrap(
        '<script>alert(1)</script><foreignObject><div>x</div></foreignObject><image href="http://evil/x.png"/><path d="M0 0" onclick="alert(1)" onload="x()"/>',
      ),
    )
    expect(out).not.toMatch(/script|foreignObject|image|onclick|onload/i)
    expect(out).toContain('<path')
  })

  it('xoá liên kết ra ngoài trong fill/style nhưng giữ tham chiếu nội bộ', () => {
    const out = sanitizeSvg(
      wrap(
        '<path d="M0 0" fill="url(http://evil/a)"/><path d="M0 0" fill="url(#g1)"/><path d="M0 0" style="fill:url(//x)"/>',
      ),
    )
    expect(out).not.toContain('evil')
    expect(out).not.toContain('//x')
    expect(out).toContain('url(#g1)')
  })

  it('xoá href javascript và href nói chung', () => {
    const out = sanitizeSvg(
      wrap('<a href="javascript:alert(1)"><path d="M0 0"/></a><path d="M0 0" href="javascript:x"/>'),
    )
    expect(out).not.toMatch(/javascript|href/i)
  })

  it('không phải SVG hợp lệ thì trả null', () => {
    expect(sanitizeSvg('<svg><g></svg>')).toBeNull()
    expect(sanitizeSvg('<html></html>')).toBeNull()
  })
})

describe('indexSvg', () => {
  it('liệt kê khu, cổng của khu và id nhóm gốc', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><g id="LAYOUT__X">
      <g id="ZONE__B1-T1__SEATED"/><g id="ZONE__C-T2__STANDING__3000"/>
      <g id="CONTENT__B1-T1"><path id="GATE__B1-T1__04"/><path id="GATE__B1-T1__05"/><path id="SEAT__B1-T1__A__01"/></g>
      <g id="GATES__JUNCTION"><path id="GATE__B-D__01"/></g></g></svg>`
    const idx = indexSvg(svg)
    expect(idx.zones).toEqual([
      { code: 'B1-T1', kind: 'SEATED' },
      { code: 'C-T2', kind: 'STANDING' },
    ])
    expect(idx.gates).toEqual({ 'B1-T1': ['4', '5'] })
    expect(idx.rootId).toBe('LAYOUT__X')
  })
})
