import { useListVenues } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function VenuesPage() {
  const query = useListVenues()
  return (
    <Placeholder title="Sân" operations={['listVenues', 'createVenue']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
