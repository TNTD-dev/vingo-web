import { useState } from 'react'
import { Link } from 'react-router'
import { Popover } from 'radix-ui'
import { CheckCheck } from 'lucide-react'
import { useAdminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import type { Order } from '@/api/generated/model'
import { icons } from '@/design/icons'
import { formatVnd } from '@/lib/money'
import { elapsedText, initials } from './format'
import { reasonHeadline } from './reasons'

const SEEN_KEY = 'vingo.admin.notifications.seen'
const LIMIT = 20

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0
  } catch {
    return 0
  }
}
function writeSeen(value: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(value))
  } catch {
    // Trình duyệt chặn bộ nhớ: chỉ mất trạng thái “đã đọc”, thông báo vẫn hiện.
  }
}

/**
 * Chuông thông báo của admin. Chưa có API thông báo riêng nên nguồn là các đơn cần xử lý (NEEDS_REVIEW) — việc duy
 * nhất admin phải tự tay làm. Tự tải lại mỗi phút. “Đã đọc” lưu theo trình duyệt (mốc thời gian lần mở gần nhất),
 * chỉ để tắt chấm đỏ; đơn vẫn nằm trong danh sách tới khi được xử lý.
 */
export function AdminNotifications() {
  const query = useAdminListOrders(
    { status: 'NEEDS_REVIEW', limit: LIMIT },
    { query: { refetchInterval: 60_000, refetchOnWindowFocus: true } },
  )
  const [open, setOpen] = useState(false),
    [seen, setSeen] = useState(readSeen),
    [now, setNow] = useState(() => new Date())
  const orders = [...(query.data?.data ?? [])].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const more = !!query.data?.next_cursor
  const unread = orders.filter((o) => Date.parse(o.created_at ?? '') > seen).length
  const markRead = () => {
    const at = Date.now()
    writeSeen(at)
    setSeen(at)
  }
  const label = unread ? `Thông báo, ${unread} mới` : 'Thông báo'
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setNow(new Date())
      }}
    >
      <Popover.Trigger asChild>
        <button type="button" className="admin-bell" aria-label={label}>
          <img src={icons.bell} alt="" width={18} height={18} />
          {unread > 0 && (
            <span className="admin-bell-count" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="admin admin-notifications" align="end" sideOffset={10} collisionPadding={16}>
          <div className="admin-notifications-head">
            <div>
              <strong>Thông báo</strong>
              <span>
                {orders.length
                  ? `${orders.length}${more ? '+' : ''} đơn đang chờ bạn xử lý`
                  : query.isPending
                    ? 'Đang tải…'
                    : 'Không có việc cần xử lý'}
              </span>
            </div>
            {unread > 0 && (
              <button type="button" className="admin-notifications-read" onClick={markRead}>
                <CheckCheck size={14} aria-hidden />
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          {query.isError ? (
            <p className="admin-notifications-empty">
              Không tải được thông báo.{' '}
              <button type="button" className="wz-link" onClick={() => query.refetch()}>
                Thử lại
              </button>
            </p>
          ) : !orders.length && !query.isPending ? (
            <p className="admin-notifications-empty">
              <CheckCheck size={20} aria-hidden />
              Mọi đơn đã được xử lý.
            </p>
          ) : (
            <ul className="admin-notifications-list">
              {orders.map((o) => (
                <Item
                  key={o.id}
                  order={o}
                  now={now}
                  unread={Date.parse(o.created_at ?? '') > seen}
                  onOpen={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
          <Link
            to="/admin/orders?status=NEEDS_REVIEW"
            className="admin-notifications-all"
            onClick={() => {
              markRead()
              setOpen(false)
            }}
          >
            Xem tất cả đơn cần xử lý →
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ago(iso: string, now: Date) {
  const text = elapsedText(iso, now)
  return text === 'vừa xong' ? text : `${text} trước`
}

function Item({ order, now, unread, onOpen }: { order: Order; now: Date; unread: boolean; onOpen: () => void }) {
  const name = order.buyer?.full_name
  return (
    <li>
      <Link
        to={`/admin/orders/${order.id}`}
        className="admin-notification"
        data-unread={unread || undefined}
        onClick={onOpen}
      >
        <span className="admin-notification-avatar" aria-hidden>
          {initials(name) || '!'}
        </span>
        <span className="admin-notification-body">
          <strong>{reasonHeadline(order.review_reason)}</strong>
          <span>{[name, order.code, formatVnd(order.total_amount ?? 0)].filter(Boolean).join(' · ')}</span>
          <small>
            {order.event?.title ?? 'Sự kiện'}
            {order.created_at ? ` · ${ago(order.created_at, now)}` : ''}
          </small>
        </span>
        {unread && <span className="admin-notification-dot" aria-label="Mới" />}
      </Link>
    </li>
  )
}
