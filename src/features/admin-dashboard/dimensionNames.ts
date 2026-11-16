import { useQueries } from '@tanstack/react-query'
import { getGetSeatLayoutQueryOptions, useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { shortDimensionLabel } from './metricFormat'

/**
 * API báo cáo chỉ trả UUID cho khu/hạng vé. Khi đã chọn một sự kiện, ghép tên từ dữ liệu catalog có sẵn:
 * hạng vé từ `price_tiers` của sự kiện, khu từ các sơ đồ ghế mà các suất của sự kiện dùng.
 * Không map được thì trả dạng rút gọn dễ đọc.
 */
export function useDimensionNames(eventId: string) {
  const event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } })
  const layoutIds = [
    ...new Set((event.data?.showtimes ?? []).map((s) => s.seat_layout_id).filter((v): v is string => !!v)),
  ]
  const layouts = useQueries({ queries: layoutIds.map((id) => getGetSeatLayoutQueryOptions(id)) })
  const zones = new Map<string, string>(),
    tiers = new Map<string, string>()
  for (const l of layouts) for (const z of l.data?.zones ?? []) zones.set(z.id, z.label)
  for (const t of event.data?.price_tiers ?? []) if (t.id) tiers.set(t.id, t.name)
  return {
    event: event.data,
    label: (kind: 'zone' | 'tier', key: string) =>
      (kind === 'zone' ? zones : tiers).get(key) ?? shortDimensionLabel(kind, key),
  }
}
