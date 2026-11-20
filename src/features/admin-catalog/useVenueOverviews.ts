import { useQuery } from '@tanstack/react-query'
import { listVenueOverviews } from '@/api/generated/endpoints/venue-imports/venue-imports'
import type { VenueOverview } from '@/api/generated/model'

export function useVenueOverviews(venueId?: string, enabled = true) {
  return useQuery({
    queryKey: ['venue-overviews', venueId],
    enabled: !!venueId && enabled,
    queryFn: async ({ signal }) => {
      const result: VenueOverview[] = []
      const seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await listVenueOverviews(venueId!, { cursor, limit: 100 }, { signal })
        result.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result.toSorted((a, b) => (b.version ?? 0) - (a.version ?? 0))
    },
  })
}
