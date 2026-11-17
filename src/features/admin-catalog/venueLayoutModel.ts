import type { SeatLayout, SeatLayoutZone, Venue } from '@/api/generated/model'

/** Tôn trọng link cấu hình cụ thể; mặc định lấy cấu hình mới nhất trong đúng sân. */
export function venueLayout(layouts: SeatLayout[] | undefined, requested?: string | null): SeatLayout | undefined {
  if (requested) return layouts?.find((l) => l.id === requested)
  return layouts?.toSorted((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]
}

export function layoutCapacity(zones: SeatLayoutZone[] | undefined) {
  if (!zones) return null
  const seated = zones.filter((z) => z.kind === 'SEATED').reduce((n, z) => n + z.capacity, 0)
  const standing = zones.filter((z) => z.kind === 'STANDING').reduce((n, z) => n + z.capacity, 0)
  return { zones: zones.length, seated, standing, total: seated + standing }
}

export function venueMapsUrl(venue: Venue): string | null {
  const query =
    Number.isFinite(venue.lat) && Number.isFinite(venue.lng) ? `${venue.lat},${venue.lng}` : venue.address?.trim()
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null
}

export type ZonePriceColor = { fill: string; stroke: string }
export type LayoutZonePricing = {
  zonePrices: Record<string, number>
  priceColors: Record<string, ZonePriceColor>
}
export type ZonePriceGroup = {
  price: number
  color: ZonePriceColor
  zones: string[]
}

const emptyZonePricing = (): LayoutZonePricing => ({ zonePrices: {}, priceColors: {} })

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

function parseHue(color: ZonePriceColor): number | null {
  const match = /hsl\((\d+)/.exec(color.fill)
  return match ? Number(match[1]) : null
}

/** Sinh màu ngẫu nhiên dễ phân biệt cho một mức giá vé; ưu tiên tách hue với các màu hiện có. */
export function randomZoneColor(existing: ZonePriceColor[] = [], rng: () => number = Math.random): ZonePriceColor {
  const usedHues = existing.map(parseHue).filter((h): h is number => h !== null)
  let bestHue = Math.floor(rng() * 360)
  let bestGap = -1
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? bestHue : Math.floor(rng() * 360)
    const minGap = usedHues.length ? Math.min(...usedHues.map((h) => hueDistance(candidate, h))) : 360
    if (minGap >= 35) {
      bestHue = candidate
      break
    }
    if (minGap > bestGap) {
      bestGap = minGap
      bestHue = candidate
    }
  }
  return { fill: `hsl(${bestHue} 78% 68%)`, stroke: `hsl(${bestHue} 72% 32%)` }
}

function pruneUnusedPriceColors(
  zonePrices: Record<string, number>,
  priceColors: Record<string, ZonePriceColor>,
): Record<string, ZonePriceColor> {
  const activeKeys = new Set(Object.values(zonePrices).map((p) => String(p)))
  return Object.fromEntries(Object.entries(priceColors).filter(([k]) => activeKeys.has(k)))
}

export function assignPriceToZones(
  current: LayoutZonePricing,
  zoneCodes: string[],
  price: number,
  rng: () => number = Math.random,
): LayoutZonePricing {
  if (!zoneCodes.length || !Number.isFinite(price) || price < 0) return current
  const normalized = Math.max(0, Math.round(price))
  const priceKey = String(normalized)
  const nextPrices = { ...current.zonePrices }
  for (const code of zoneCodes) {
    if (code) nextPrices[code] = normalized
  }
  const color = current.priceColors[priceKey] ?? randomZoneColor(Object.values(current.priceColors), rng)
  const nextColors = pruneUnusedPriceColors(nextPrices, { ...current.priceColors, [priceKey]: color })
  return { zonePrices: nextPrices, priceColors: nextColors }
}

export function removeZonePrices(current: LayoutZonePricing, zoneCodes: string[]): LayoutZonePricing {
  if (!zoneCodes.length) return current
  const nextPrices = { ...current.zonePrices }
  for (const code of zoneCodes) delete nextPrices[code]
  return {
    zonePrices: nextPrices,
    priceColors: pruneUnusedPriceColors(nextPrices, current.priceColors),
  }
}

export function rerandomizePriceColor(
  current: LayoutZonePricing,
  price: number,
  rng: () => number = Math.random,
): LayoutZonePricing {
  const priceKey = String(Math.round(price))
  if (!(priceKey in current.priceColors)) return current
  const nextColor = randomZoneColor(Object.values(current.priceColors), rng)
  return {
    zonePrices: current.zonePrices,
    priceColors: { ...current.priceColors, [priceKey]: nextColor },
  }
}

export function groupZonesByPrice(pricing: LayoutZonePricing): ZonePriceGroup[] {
  const byPrice = new Map<number, string[]>()
  for (const [code, price] of Object.entries(pricing.zonePrices)) {
    const list = byPrice.get(price) ?? []
    list.push(code)
    byPrice.set(price, list)
  }
  return [...byPrice.entries()]
    .sort(([a], [b]) => b - a)
    .map(([price, zones]) => ({
      price,
      color: pricing.priceColors[String(price)] ?? randomZoneColor(),
      zones,
    }))
}

const pricingStorageKey = (layoutId: string) => `vingo-layout-zone-prices:${layoutId}`

function isZonePriceColor(value: unknown): value is ZonePriceColor {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ZonePriceColor).fill === 'string' &&
    typeof (value as ZonePriceColor).stroke === 'string'
  )
}

export function loadLayoutZonePricing(layoutId: string): LayoutZonePricing {
  if (!layoutId) return emptyZonePricing()
  try {
    const raw = localStorage.getItem(pricingStorageKey(layoutId))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return emptyZonePricing()
    const obj = parsed as Partial<LayoutZonePricing>
    const zonePrices = Object.fromEntries(
      Object.entries(obj.zonePrices ?? {}).filter(
        ([k, v]) => typeof k === 'string' && typeof v === 'number' && Number.isFinite(v) && v >= 0,
      ),
    ) as Record<string, number>
    const rawColors = Object.fromEntries(
      Object.entries(obj.priceColors ?? {}).filter(([k, v]) => typeof k === 'string' && isZonePriceColor(v)),
    ) as Record<string, ZonePriceColor>
    const priceColors = pruneUnusedPriceColors(zonePrices, rawColors)
    for (const price of Object.values(zonePrices)) {
      const k = String(price)
      if (!priceColors[k]) priceColors[k] = randomZoneColor(Object.values(priceColors))
    }
    return { zonePrices, priceColors }
  } catch {
    return emptyZonePricing()
  }
}

export function saveLayoutZonePricing(layoutId: string, pricing: LayoutZonePricing): void {
  if (!layoutId) return
  try {
    localStorage.setItem(pricingStorageKey(layoutId), JSON.stringify(pricing))
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}
