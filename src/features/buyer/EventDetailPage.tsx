import { useParams } from 'react-router'

import { useGetEvent } from '@/api/generated/endpoints/search/search'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function EventDetailPage() {
  const { eventId } = useParams()
  const query = useGetEvent(eventId ?? '')
  return (
    <Placeholder
      title="Chi tiết sự kiện"
      operations={['getEvent', 'listEventShowtimes', 'getSeatmap', 'getAvailability', 'holdSeats']}
    >
      <QueryDump query={query} />
    </Placeholder>
  )
}
