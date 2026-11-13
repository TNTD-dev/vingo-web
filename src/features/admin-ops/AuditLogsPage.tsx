import { useListAuditLogs } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function AuditLogsPage() {
  const query = useListAuditLogs()
  return (
    <Placeholder title="Nhật ký thao tác" operations={['listAuditLogs']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
