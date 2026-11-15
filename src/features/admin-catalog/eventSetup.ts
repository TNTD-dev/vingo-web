import { useQuery } from '@tanstack/react-query'
import { getSeatLayout } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getSeatmap } from '@/api/generated/endpoints/search/search'
import type { EventDetail, SeatLayoutOverview } from '@/api/generated/model'
import { loadZoneAssignments } from './zoneAssignments'

export function activeShowtimes(event: EventDetail) {
  return event.showtimes?.filter((s) => s.status !== 'CANCELLED') ?? []
}
export function layoutIdsOf(event: EventDetail) {
  return [...new Set(activeShowtimes(event).flatMap((s) => (s.seat_layout_id ? [s.seat_layout_id] : [])))]
}

/** Sơ đồ (có danh sách khu) của mọi suất chưa hủy, theo id. */
export function useEventLayouts(event: EventDetail) {
  const ids = layoutIdsOf(event)
  return useQuery({
    queryKey: ['admin-event-layouts', ids],
    enabled: !!ids.length,
    queryFn: async () =>
      Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await getSeatLayout(id)] as const))) as Record<
        string,
        SeatLayoutOverview
      >,
  })
}

/**
 * Gán hạng giá theo khu (zone_id → price_tier_id).
 * Sự kiện đã công bố: đọc từ seatmap công khai. Sự kiện nháp: API không cho đọc, dùng bản sao lưu ở tab này.
 */
export function useZoneAssignments(event: EventDetail) {
  const shows = activeShowtimes(event).filter((s) => s.id && s.status !== 'DRAFT')
  const published = event.status === 'PUBLISHED' || event.status === 'ENDED'
  return useQuery({
    queryKey: ['admin-zone-assignments', event.id, event.status, shows.map((s) => s.id)],
    queryFn: async (): Promise<Record<string, string> | null> => {
      if (!published || !shows.length) return loadZoneAssignments(event.id!)
      const maps = await Promise.all(shows.map((s) => getSeatmap(s.id!)))
      return Object.fromEntries(
        maps.flatMap(
          (m) => m.zones?.filter((z) => z.zone_id && z.tier?.id).map((z) => [z.zone_id!, z.tier!.id!]) ?? [],
        ),
      )
    },
  })
}

export function stepLabels(event?: EventDetail) {
  const shows = event ? activeShowtimes(event).length : 0,
    tiers = event?.price_tiers?.length ?? 0
  return [
    { label: 'Thông tin', hint: 'Tên, thể loại, poster', doneHint: 'Đã lưu nháp' },
    { label: 'Suất diễn', hint: 'Sân, giờ diễn, giờ bán', doneHint: `${shows} suất` },
    { label: 'Giá theo khu', hint: 'Hạng giá, gán khu', doneHint: `${tiers} hạng giá` },
    { label: 'Xem lại & công bố', hint: 'Checklist sẵn sàng' },
  ]
}
