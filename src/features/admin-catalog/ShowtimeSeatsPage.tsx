import { Placeholder } from '@/design/Placeholder'

// Khoá / mở ghế theo suất (Figma D13). Vẽ sơ đồ bằng src/seatmap.
export default function ShowtimeSeatsPage() {
  return <Placeholder title="Ghế của suất" operations={['getSeatmap', 'blockSeats', 'unblockSeats']} />
}
