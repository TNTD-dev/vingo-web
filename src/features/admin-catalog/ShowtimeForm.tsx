import type { Showtime } from '@/api/generated/model'
import { FormDialog } from './CatalogForms'
import ShowtimeEditor from './ShowtimeEditor'

/** Hộp thoại thêm/sửa một suất ở trang chi tiết sự kiện (wizard dùng ShowtimeEditor trực tiếp). */
export default function ShowtimeForm({
  eventId,
  initial,
  onClose,
}: {
  eventId: string
  initial?: Showtime
  onClose: () => void
}) {
  return (
    <FormDialog title={initial ? 'Sửa suất diễn' : 'Thêm suất diễn'} pending={false} onClose={onClose}>
      <ShowtimeEditor eventId={eventId} initial={initial} onSaved={onClose} onCancel={onClose} />
    </FormDialog>
  )
}
