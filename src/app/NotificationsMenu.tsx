import { useQuery } from '@tanstack/react-query'
import { Clock, CreditCard, ShieldCheck, Ticket, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { getListMyOrdersQueryKey, listMyOrders } from '@/api/generated/endpoints/booking/booking'
import { icons } from '@/design/icons'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/design/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { useMeStream, type MeStreamEvent } from '@/realtime/useMeStream'
import { useNow } from '@/lib/useNow'

import { buildNotifications, relativeTime, type NotificationTone } from './notifications'

const READ_KEY = 'vingo:notifications-read'

function loadRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

const STREAM_TOAST: Partial<Record<MeStreamEvent['type'], string>> = {
  'order.paid': 'Thanh toán thành công, vé đang được phát hành',
  'ticket.issued': 'Vé của bạn đã sẵn sàng',
  'order.needs_review': 'Đơn của bạn đang được xem xét',
  'order.expired': 'Một đơn đã hết hạn giữ ghế',
  'payment.failed': 'Thanh toán chưa thành công',
}

const TONE: Record<NotificationTone, { box: string; icon: React.ReactNode }> = {
  success: { box: 'bg-agent text-foreground', icon: <Ticket className="size-4" aria-hidden /> },
  warning: { box: 'bg-warning text-on-ink', icon: <Clock className="size-4" aria-hidden /> },
  danger: { box: 'bg-danger text-on-ink', icon: <CreditCard className="size-4" aria-hidden /> },
  neutral: { box: 'bg-muted text-foreground', icon: <X className="size-4" aria-hidden /> },
  info: { box: 'bg-info text-on-ink', icon: <ShieldCheck className="size-4" aria-hidden /> },
}

/** Chuông thông báo (Figma B16). Thông báo suy ra từ đơn gần đây; trạng thái đã đọc nhớ ở trình duyệt. */
export function NotificationsMenu() {
  const now = useNow(30_000)
  const [read, setRead] = useState(loadRead)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  // Kết nối realtime ở thanh điều hướng: đơn/vé tự làm mới (useMeStream invalidate) và báo bằng toast.
  // `id` theo loại sự kiện để nhiều kết nối cùng nhận một sự kiện vẫn chỉ hiện một toast.
  useMeStream((e) => {
    const text = STREAM_TOAST[e.type]
    if (text) toast(text, { id: `me-stream:${e.type}` })
  })
  const query = useQuery({
    queryKey: [...getListMyOrdersQueryKey({ limit: 20 }), 'notifications'],
    queryFn: ({ signal }) => listMyOrders({ limit: 20 }, { signal }),
    refetchInterval: 60_000,
  })
  const all = buildNotifications(query.data?.data ?? [], now)
  const unread = all.filter((n) => !read.has(n.id))
  const shown = filter === 'unread' ? unread : all

  const markRead = (ids: string[]) => {
    const next = new Set([...read, ...ids])
    setRead(next)
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-200)))
    } catch {
      /* trình duyệt chặn lưu trữ: chỉ mất trạng thái đã đọc */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={unread.length ? `Thông báo, ${unread.length} chưa đọc` : 'Thông báo'}
        className="relative flex size-12 shrink-0 items-center justify-center rounded-pill bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={icons.bell} alt="" className="size-[18px]" />
        {unread.length > 0 && <span aria-hidden className="absolute top-3 right-3.5 size-1.5 rounded-pill bg-danger" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-32px))] rounded-[24px] border-0 bg-surface p-0 shadow-float"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="type-h4 text-foreground">Thông báo</h2>
          <button
            type="button"
            disabled={unread.length === 0}
            onClick={() => markRead(unread.map((n) => n.id))}
            className="type-caption text-ink-tertiary hover:text-foreground disabled:opacity-50"
          >
            Đánh dấu đã đọc
          </button>
        </div>
        <div className="flex gap-2 px-4 pt-3 pb-2">
          {(
            [
              ['all', `Tất cả · ${all.length}`],
              ['unread', `Chưa đọc · ${unread.length}`],
            ] as const
          ).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onSelect={(e) => {
                e.preventDefault()
                setFilter(key)
              }}
              className={cn(
                'w-auto rounded-pill px-3 py-1.5 type-caption',
                filter === key ? 'bg-ink text-on-ink focus:bg-ink focus:text-on-ink' : 'bg-canvas',
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </div>
        <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto px-2 pb-2">
          {shown.length === 0 && (
            <li className="px-4 py-8 text-center type-body-m text-ink-tertiary">
              {query.isPending ? 'Đang tải…' : 'Chưa có thông báo nào'}
            </li>
          )}
          {shown.map((n) => {
            const isUnread = !read.has(n.id)
            return (
              <li key={n.id}>
                <DropdownMenuItem asChild onSelect={() => markRead([n.id])}>
                  <Link
                    to={n.to}
                    className={cn('flex items-start gap-3 rounded-[16px] p-3', isUnread && 'bg-agent-soft')}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-[10px]',
                        TONE[n.tone].box,
                      )}
                    >
                      {n.tone === 'success' && isUnread ? <Ticket className="size-4" aria-hidden /> : TONE[n.tone].icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="type-body-m-strong text-foreground">{n.title}</span>
                      <span className="type-caption text-ink-secondary">{n.hint}</span>
                      <span className="flex items-center gap-3">
                        <span className="type-mono-small text-ink-tertiary uppercase">{relativeTime(n.at, now)}</span>
                        {n.action && (
                          <span className="rounded-pill bg-ink px-4 py-1.5 type-body-m-strong text-on-ink">
                            {n.action.label}
                          </span>
                        )}
                      </span>
                    </span>
                    {isUnread && <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-pill bg-success" />}
                  </Link>
                </DropdownMenuItem>
              </li>
            )
          })}
        </ul>
        <DropdownMenuItem asChild>
          <Link to="/orders" className="justify-center rounded-b-[24px] bg-canvas py-3.5 type-body-m-strong">
            Xem tất cả thông báo
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
