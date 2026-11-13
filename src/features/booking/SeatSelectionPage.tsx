import { Placeholder } from '@/design/Placeholder'

// Chọn khu (toàn cảnh) → chọn ghế trong khu (Figma B3/B3b). Vẽ sơ đồ bằng src/seatmap.
export default function SeatSelectionPage() {
  return <Placeholder title="Chọn ghế" operations={['getSeatmap', 'getAvailability', 'holdSeats']} />
}
