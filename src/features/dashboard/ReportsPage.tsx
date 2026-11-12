import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function ReportsPage() {
  const query = useQueryMetric({ metric: 'revenue' })
  return (
    <Placeholder title="Báo cáo" operations={['queryMetric']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
