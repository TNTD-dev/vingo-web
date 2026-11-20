import { CheckinConsole } from '@/design/checkin/CheckinConsole'
import '@/design/admin/admin.css'

/**
 * Soát vé cho nhân viên cổng (/checkin): cùng màn với /admin/checkin nhưng không có sidebar,
 * dùng được trên điện thoại. API checkIn chỉ cho ADMIN nên route bọc RequireAuth allow="ADMIN".
 * Quét bằng camera dùng BarcodeDetector của trình duyệt; không hỗ trợ thì nhập tay.
 */
export default function CheckinPage() {
  return (
    <div className="admin admin-standalone">
      <div className="min-w-0 flex-1">
        <CheckinConsole
          header={({ title, caption, actions }) => (
            <header className="admin-header">
              <div>
                <p className="admin-caption mb-2">{caption}</p>
                <h1>{title}</h1>
              </div>
              {actions && <div className="admin-toolbar">{actions}</div>}
            </header>
          )}
        />
      </div>
    </div>
  )
}
