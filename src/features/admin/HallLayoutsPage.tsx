import { useParams } from 'react-router'

import { useListSeatLayouts } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function HallLayoutsPage() {
  const { hallId } = useParams()
  const query = useListSeatLayouts(hallId ?? '')
  return (
    <Placeholder
      title="Sơ đồ ghế"
      operations={['listSeatLayouts', 'importSeatLayoutSvg', 'getSeatLayout', 'publishSeatLayout']}
    >
      <QueryDump query={query} />
    </Placeholder>
  )
}
