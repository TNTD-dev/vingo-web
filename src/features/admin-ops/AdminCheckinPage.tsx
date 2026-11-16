import { AdminPage } from '@/design/admin/AdminUi'
import { CheckinConsole } from '@/design/checkin/CheckinConsole'

export default function AdminCheckinPage() {
  return (
    <CheckinConsole
      header={({ title, caption, actions }) => (
        <AdminPage title={title} caption={caption} actions={actions}>
          {null}
        </AdminPage>
      )}
    />
  )
}
