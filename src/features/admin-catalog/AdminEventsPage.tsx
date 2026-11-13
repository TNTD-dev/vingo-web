import { useSearchEvents } from '@/api/generated/endpoints/search/search'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function AdminEventsPage() {
  const query = useSearchEvents()
  return (
    <Placeholder title="Sự kiện (admin)" operations={['searchEvents', 'createEvent']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
