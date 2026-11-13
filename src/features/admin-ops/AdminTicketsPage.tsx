import { useAdminListTickets } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function AdminTicketsPage() {
  const query = useAdminListTickets()
  return (
    <Placeholder title="Vé" operations={['adminListTickets', 'voidTicket', 'reissueTicketQr', 'adminResendTicket']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
