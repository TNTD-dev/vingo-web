import { useParams } from 'react-router'

import { Placeholder } from '@/design/Placeholder'

export default function VenueDetailPage() {
  const { venueId } = useParams()
  return (
    <Placeholder title="Chi tiết sân" operations={['updateVenue', 'deleteVenue', 'createHall']}>
      <>venue_id: {venueId}</>
    </Placeholder>
  )
}
