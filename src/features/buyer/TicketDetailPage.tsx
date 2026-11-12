import { useParams } from 'react-router'

import { useGetTicket } from '@/api/generated/endpoints/tickets/tickets'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function TicketDetailPage() {
  const { ticketId } = useParams()
  const query = useGetTicket(ticketId ?? '')
  return (
    <Placeholder title="Chi tiết vé" operations={['getTicket', 'getTicketQr', 'resendMyTicket']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
