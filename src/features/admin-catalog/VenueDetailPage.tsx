import { useParams } from 'react-router'
import HallLayoutsPage from './HallLayoutsPage'
export default function VenueDetailPage() {
  const { venueId } = useParams()
  return <HallLayoutsPage venueId={venueId} />
}
