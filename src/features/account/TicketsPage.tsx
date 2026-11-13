import { useListMyTickets } from '@/api/generated/endpoints/tickets/tickets'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function TicketsPage() {
  const query = useListMyTickets()
  return (
    <Placeholder title="Vé của tôi" operations={['listMyTickets']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
