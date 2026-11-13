/*
 * Xử lý SVG sơ đồ ghế theo quy ước v1 (Figma page 09 · Sơ đồ ghế):
 *   ZONE__<mã>-T<tầng>__SEATED | ZONE__<mã>-T<tầng>__STANDING__<sức chứa>   khu
 *   CONTENT__<mã>-T<tầng>                                                     ghế/lối đi/cổng của một khu
 *   SEAT__<mã>-T<tầng>__<hàng>__<số>                                          một ghế
 *   GATE__<...>__<số>                                                         cổng
 *   LABEL__<mã>-T<tầng>                                                       nhãn khu
 * Lớp trung tâm (PITCH, STAGE…) chỉ là nền, không tương tác.
 */

export type ZoneKind = 'SEATED' | 'STANDING'

export type ZoneRef = { code: string; kind: ZoneKind }

const ZONE_ID = /^ZONE__([A-Z0-9]+(?:-T\d+)?)__(SEATED|STANDING)(?:__\d+)?$/
const ZONE_PART_ID = /^(?:ZONE|CONTENT|LABEL)__([A-Z0-9]+(?:-T\d+)?)(?:__|$)/
const SEAT_ID = /^SEAT__([A-Z0-9]+(?:-T\d+)?)__([A-Z]+)__(\d+)$/
const GATE_ID = /^GATE__(.+)__(\d+)$/

export function parseZoneId(id: string): ZoneRef | null {
  const m = ZONE_ID.exec(id)
  return m ? { code: m[1], kind: m[2] as ZoneKind } : null
}

/** Mã khu từ id của khu, nội dung hoặc nhãn: "LABEL__B3-T1" → "B3-T1". */
export function zoneCodeOfPart(id: string): string | null {
  return ZONE_PART_ID.exec(id)?.[1] ?? null
}

export function parseSeatId(id: string): { zone: string; row: string; number: number } | null {
  const m = SEAT_ID.exec(id)
  return m ? { zone: m[1], row: m[2], number: Number(m[3]) } : null
}

/** Ghế theo (khu, hàng, số) → id trong SVG. Số luôn 2 chữ số: ("B3-T1","A",1) → "SEAT__B3-T1__A__01". */
export function seatSvgId(zone: string, row: string, number: number): string {
  return `SEAT__${zone}__${row}__${String(number).padStart(2, '0')}`
}

/** Khu API gọi theo tên ("A1") hay mã đầy đủ ("A1-T1") đều khớp với mã trong SVG. */
export function sameZone(svgCode: string, apiName: string | undefined): boolean {
  if (!apiName) return false
  const strip = (s: string) =>
    s
      .replace(/^Khu\s+/i, '')
      .trim()
      .toUpperCase()
  const a = strip(apiName)
  return a === svgCode || a === svgCode.replace(/-T\d+$/, '')
}

export type SvgIndex = {
  zones: ZoneRef[]
  /** Số cổng gắn với từng khu (GATE__<mã>__NN trong CONTENT của khu đó). */
  gates: Record<string, string[]>
  rootId: string | undefined
}

// ---- Làm sạch SVG ----
// SVG do admin tải lên nên coi là dữ liệu không tin cậy: chỉ giữ phần tử và thuộc tính đồ hoạ cần để vẽ.

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'title',
  'desc',
])

const ALLOWED_ATTRS = new Set([
  'id',
  'class',
  'd',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'transform',
  'viewBox',
  'preserveAspectRatio',
  'xmlns',
  'fill',
  'fill-opacity',
  'fill-rule',
  'clip-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternTransform',
  'maskUnits',
  'maskContentUnits',
  'clipPathUnits',
  'mask',
  'clip-path',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'letter-spacing',
  'overflow',
  'style',
])

/** Giá trị an toàn: không tham chiếu ra ngoài ("url(http…)", "javascript:", "expression("). */
function safeValue(value: string): boolean {
  const v = value.toLowerCase()
  if (v.includes('javascript:') || v.includes('expression(') || v.includes('@import')) return false
  for (const m of v.matchAll(/url\(\s*['"]?([^'")]*)/g)) if (!m[1].startsWith('#')) return false
  return true
}

function clean(el: Element) {
  for (const child of Array.from(el.children)) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.remove()
      continue
    }
    clean(child)
  }
  for (const attr of Array.from(el.attributes)) {
    if (!ALLOWED_ATTRS.has(attr.name) || !safeValue(attr.value)) el.removeAttribute(attr.name)
  }
}

/** Trả SVG đã làm sạch (chuỗi) hoặc null nếu không phải SVG hợp lệ. */
export function sanitizeSvg(source: string): string | null {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.tagName !== 'svg' || doc.querySelector('parsererror')) return null
  clean(root)
  return new XMLSerializer().serializeToString(root)
}

/** Danh mục khu và cổng của một SVG đã làm sạch. */
export function indexSvg(svg: string): SvgIndex {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const zones: ZoneRef[] = []
  const gates: Record<string, string[]> = {}
  for (const el of Array.from(doc.querySelectorAll('[id]'))) {
    const zone = parseZoneId(el.id)
    if (zone) zones.push(zone)
    const gate = GATE_ID.exec(el.id)
    const owner = el.closest('[id^="CONTENT__"]')
    if (gate && owner) {
      const code = zoneCodeOfPart(owner.id)
      if (code) (gates[code] ??= []).push(String(Number(gate[2])))
    }
  }
  const rootId = doc.documentElement.querySelector(':scope > g[id]')?.id
  return { zones, gates, rootId }
}
