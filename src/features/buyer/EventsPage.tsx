import { useSearchEvents } from '@/api/generated/endpoints/search/search'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function EventsPage() {
  const query = useSearchEvents()
  return (
    <Placeholder title="Sự kiện" operations={['searchEvents']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
