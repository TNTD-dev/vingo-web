import { AdminPage } from '@/design/admin/AdminUi'
import { CheckinConsole } from '@/design/checkin/CheckinConsole'

export default function AdminCheckinPage() {
  return (
    <CheckinConsole
      header={({ title, caption, busy, openSettings }) => (
        <AdminPage
          title={title}
          caption={caption}
          actions={
            <button className="admin-filter-select" disabled={busy} onClick={openSettings}>
              Suất & cổng ⌄
            </button>
          }
        >
          {null}
        </AdminPage>
      )}
    />
  )
}
