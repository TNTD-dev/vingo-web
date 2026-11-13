import { useQuery } from '@tanstack/react-query'
import { listVenues, listSeatLayouts, getSeatLayoutSvg } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Venue, SeatLayout } from '@/api/generated/model'
import { sanitizeSvg } from '@/seatmap/svg'

export const categories = { FOOTBALL: 'Bóng đá', CONCERT: 'Âm nhạc', THEATER: 'Sân khấu', OTHER: 'Khác' } as const
export const venueTypes = { STADIUM: 'Sân vận động', THEATER: 'Nhà hát', OUTDOOR: 'Ngoài trời' } as const
export const cities = { HCM: 'TP. Hồ Chí Minh', HN: 'Hà Nội', DN: 'Đà Nẵng' } as const
export { useEventDirectory } from '@/design/admin/data'

export function useVenueDirectory() {
  return useQuery({
    queryKey: ['admin-venue-directory'],
    queryFn: async () => {
      const result: Venue[] = [],
        seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await listVenues({ limit: 100, cursor })
        result.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result
    },
  })
}
export function useLayoutDirectory(hallId: string) {
  return useQuery({
    queryKey: ['admin-layout-directory', hallId],
    enabled: !!hallId,
    queryFn: async () => {
      const result: SeatLayout[] = [],
        seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await listSeatLayouts(hallId, { limit: 100, cursor })
        result.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result
    },
  })
}
export function useLayoutSvg(layoutId: string) {
  return useQuery({
    queryKey: ['admin-layout-svg', layoutId],
    enabled: !!layoutId,
    queryFn: async () => {
      // Mutator hiện trả văn bản cho SVG; tương thích cả khi mutator chuyển sang Blob đúng theo contract.
      const raw: unknown = await getSeatLayoutSvg(layoutId)
      const text = raw instanceof Blob ? await raw.text() : typeof raw === 'string' ? raw : ''
      const svg = sanitizeSvg(text)
      if (!svg) throw new Error('INVALID_LAYOUT_SVG')
      return svg
    },
  })
}
/** datetime-local nhập theo giờ Việt Nam, độc lập múi giờ máy người dùng. */
export function toUtc(value: string) {
  return value ? new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`).toISOString() : undefined
}
export function localDateTime(value?: string) {
  return value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16) : ''
}
