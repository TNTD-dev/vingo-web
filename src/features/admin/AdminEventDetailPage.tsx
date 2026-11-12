import { useParams } from 'react-router'

import { Placeholder } from '@/design/Placeholder'

export default function AdminEventDetailPage() {
  const { eventId } = useParams()
  return (
    <Placeholder
      title="Sửa sự kiện"
      operations={['updateEvent', 'putPriceTiers', 'putZonePrices', 'createShowtime', 'publishEvent', 'cancelEvent']}
    >
      <>event_id: {eventId}</>
    </Placeholder>
  )
}
