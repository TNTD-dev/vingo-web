import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AdminSearch } from './AdminSearch'
import warningWhite from './icons/warning-white.svg'
import { icons } from '@/design/icons'

import { isApiError } from '@/api/problem'
import { mascot } from '@/design/brand'
import { StatusBadge, type BadgeTone } from '@/design/StatusBadge'
import { Button } from '@/design/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/design/ui/dialog'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'

export function AdminPage({
  title,
  caption,
  actions,
  children,
}: {
  title: string
  caption?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <header className="admin-header">
        <div>
          {caption && <p className="admin-caption mb-2">{caption}</p>}
          <h1>{title}</h1>
        </div>
        <div className="admin-toolbar">
          <AdminSearch />
          <Link to="/admin/orders?status=NEEDS_REVIEW" aria-label="Đơn hàng cần xử lý" className="admin-bell">
            <img src={icons.bell} alt="" width={18} height={18} />
          </Link>
          {actions}
        </div>
      </header>
      {children}
    </>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('admin-panel', className)}>{children}</section>
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function Table({ headings, children, label }: { headings: string[]; children: ReactNode; label: string }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table" aria-label={label}>
        <thead>
          <tr>
            {headings.map((heading, i) => (
              <th key={i} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="admin-tabs" aria-label="Bộ lọc">
      {items.map((item) => (
        <button key={item.value} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

const tones: Record<string, BadgeTone> = {
  PUBLISHED: 'success',
  PAID: 'success',
  ISSUED: 'success',
  ON_SALE: 'success',
  NEEDS_REVIEW: 'warning',
  HELD: 'warning',
  PENDING: 'warning',
  CANCELLED: 'danger',
  VOID: 'danger',
  DRAFT: 'info',
  SCHEDULED: 'info',
  REFUNDED: 'info',
  PAID_AFTER_EXPIRY: 'warning',
  PAID_AFTER_CANCEL: 'warning',
  AMOUNT_MISMATCH: 'danger',
  OK: 'success',
  ALREADY_USED: 'warning',
  TICKET_VOID: 'danger',
  WRONG_SHOWTIME: 'info',
}
export function StateBadge({ value }: { value?: string | null }) {
  return (
    <StatusBadge
      tone={tones[value ?? ''] ?? 'neutral'}
      className={value === 'ISSUED' ? 'border-transparent bg-agent [&>span:first-child]:bg-ink' : undefined}
    >
      {value?.replaceAll('_', ' ') ?? '—'}
    </StatusBadge>
  )
}

const messages: Record<string, string> = {
  SEAT_TAKEN: 'Ghế đã có người giữ hoặc mua. Hãy tải lại sơ đồ và chọn ghế khác.',
  NOT_ENOUGH_STOCK: 'Khu đứng không còn đủ chỗ.',
  ORDER_STATE_INVALID: 'Trạng thái đơn đã thay đổi hoặc suất diễn không còn hợp lệ. Hãy tải lại dữ liệu.',
  TICKET_STATE_INVALID: 'Vé không còn ở trạng thái cho phép thao tác. Hãy tải lại danh sách.',
  IDEMPOTENCY_CONFLICT: 'Yêu cầu đang xung đột với thao tác trước. Hãy tải lại đơn trước khi tiếp tục.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  NOT_FOUND: 'Không tìm thấy dữ liệu hoặc dữ liệu đã bị xóa.',
  FORBIDDEN: 'Tài khoản không có quyền thực hiện thao tác này.',
  EVENT_LOCKED: 'Sự kiện đã mở bán, đã có đơn hoặc đã kết thúc. Cấu hình này không còn cho phép thay đổi.',
  SHOWTIME_LOCKED: 'Suất diễn đã khóa hoặc kết thúc, không thể thay đổi.',
  EVENT_INCOMPLETE:
    'Sự kiện chưa đủ cấu hình để công bố. Cần ít nhất một suất, sơ đồ đã công bố và hạng giá cho mọi khu.',
  HALL_NAME_TAKEN: 'Sân này đã có phòng trùng tên. Hãy đặt tên khác.',
  SEAT_LAYOUT_LOCKED: 'Sơ đồ đã công bố nên không đổi tên được. Hãy nhập một bản nháp mới nếu cần sửa.',
  INVALID_SEAT_LAYOUT: 'Sơ đồ không hợp lệ. Kiểm tra file SVG theo quy ước sơ đồ Vingo (khu ZONE__, ghế SEAT__).',
  UNSUPPORTED_MEDIA_TYPE: 'Định dạng file không được hỗ trợ. Chỉ nhận file SVG (image/svg+xml).',
  ACTION_STATE_INVALID: 'Trạng thái hiện tại không cho phép thao tác này. Hãy tải lại dữ liệu.',
  VENUE_IN_USE: 'Địa điểm đang có phòng hoặc suất diễn. Chưa thể xóa địa điểm này.',
}
function errorText(error: unknown): string {
  if (isApiError(error))
    return (
      messages[error.code ?? ''] ??
      (error.status === 501
        ? 'Chức năng này chưa được hỗ trợ ở phía máy chủ. Vui lòng quay lại sau.'
        : error.status === 413
          ? 'File quá lớn. Giới hạn là 10 MiB.'
          : error.status === 415
            ? 'Định dạng file không được hỗ trợ.'
            : error.status === 422
              ? 'Dữ liệu chưa đủ điều kiện để thực hiện thao tác này.'
              : error.status === 400
                ? 'Thông tin chưa hợp lệ. Hãy kiểm tra các trường đã nhập.'
                : 'Không thể thực hiện yêu cầu. Vui lòng thử lại.')
    )
  return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.'
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return error ? (
    <div role="alert" className="admin-error my-3">
      <p>{errorText(error)}</p>
      {retry && (
        <Button className="mt-3 rounded-pill" variant="outline" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  ) : null
}
export function QueryState({
  query,
  children,
  empty,
  emptyText = 'Chưa có dữ liệu phù hợp. Thử thay đổi bộ lọc.',
}: {
  query: { isPending: boolean; error: unknown; refetch: () => unknown }
  children: ReactNode
  empty?: boolean
  emptyText?: string
}) {
  if (query.isPending)
    return (
      <div aria-label="Đang tải dữ liệu" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  if (query.error) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />
  if (empty)
    return (
      <div className="admin-empty">
        <img src={mascot.listening} alt="" className="mx-auto mb-4 h-24 w-auto" />
        <p>{emptyText}</p>
      </div>
    )
  return children
}
export function Pager({
  cursor,
  previous,
  next,
  busy,
}: {
  cursor?: string | null
  previous?: () => void
  next: () => void
  busy?: boolean
}) {
  if (!cursor && !previous) return null
  return (
    <div className="mt-5 flex justify-end gap-2">
      {previous && (
        <Button variant="outline" className="rounded-pill" onClick={previous} disabled={busy}>
          Trang trước
        </Button>
      )}
      {cursor && (
        <Button variant="outline" className="rounded-pill" onClick={next} disabled={busy}>
          Trang tiếp theo
        </Button>
      )}
    </div>
  )
}

export function ConfirmDialog({
  title,
  description,
  open,
  onClose,
  onConfirm,
  pending,
  error,
  requireReason = true,
  label = 'Xác nhận',
  danger = false,
  facts,
  cancelLabel = 'Quay lại',
}: {
  title: string
  description: string
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  pending: boolean
  error: unknown
  requireReason?: boolean
  label?: string
  danger?: boolean
  facts?: { label: string; value: string }[]
  cancelLabel?: string
}) {
  const [reason, setReason] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!pending && (!requireReason || reason.trim().length >= 3)) onConfirm(reason.trim())
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose()
      }}
    >
      <DialogContent className={`admin admin-dialog admin-confirm ${danger ? 'admin-confirm-danger' : ''}`}>
        {danger && (
          <span className="admin-confirm-icon">
            <img src={warningWhite} alt="" width={22} height={22} />
          </span>
        )}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {facts && (
          <dl className="admin-review-facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <form onSubmit={submit} className="mt-5 space-y-4">
          {requireReason && (
            <Field label="Lý do (bắt buộc, ít nhất 3 ký tự)">
              <input
                required
                minLength={3}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do thực hiện…"
              />
            </Field>
          )}
          <ErrorNotice error={error} />
          <div className={`flex flex-wrap gap-2 ${danger ? 'flex-row-reverse justify-end' : ''}`}>
            <Button
              type="submit"
              disabled={pending || (requireReason && reason.trim().length < 3)}
              className={`admin-small-button ${danger ? 'bg-danger hover:bg-danger/90' : ''}`}
            >
              {pending ? 'Đang xử lý…' : label}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose} className="rounded-pill">
              {cancelLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
