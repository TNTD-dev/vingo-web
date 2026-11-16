import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useAdminListOrders, adminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { OrderStatus, type Order } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, StateBadge, Tabs, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { csvText, dateText, download, useEventDirectory, useLoadMore, vnToday } from '@/design/admin/data'
import {
  dayGroupLabel,
  elapsedText,
  groupByDay,
  initials,
  remainingText,
  vnShortDate,
  vnTime,
} from '@/design/admin/format'
import { orderTabLabels, stateLabel } from '@/design/admin/labels'
import { reasonHeadline } from '@/design/admin/reasons'
import { Button } from '@/design/ui/button'
import { formatVnd } from '@/lib/money'

const tabItems = ['', 'NEEDS_REVIEW', 'PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED'].map((value) => ({
  value,
  label: orderTabLabels[value],
}))
const ticketCount = (o: Order) => o.items?.reduce((sum, v) => sum + (v.quantity ?? 1), 0) ?? 0

/** Thẻ "Cần bạn xử lý": chỉ hiện khi có đơn NEEDS_REVIEW; trỏ tới đơn chờ lâu nhất. */
function AttentionCard({ now }: { now: Date }) {
  const query = useAdminListOrders({ status: 'NEEDS_REVIEW', limit: 20 }),
    list = query.data?.data ?? []
  if (!list.length) return null
  const oldest = list.reduce((min, o) => ((o.created_at ?? '') < (min.created_at ?? '') ? o : min), list[0]),
    more = query.data?.next_cursor ? '+' : '',
    needsReviewAt = oldest.created_at ? elapsedText(oldest.created_at, now) : null
  return (
    <section className="admin-attention" aria-label="Cần bạn xử lý">
      <span className="admin-attention-icon" aria-hidden>
        !
      </span>
      <div className="admin-attention-body">
        <p className="admin-attention-caption">
          // CẦN BẠN XỬ LÝ · {list.length}
          {more} ĐƠN{needsReviewAt ? ` · ĐÃ CHỜ ${needsReviewAt.toLocaleUpperCase('vi-VN')}` : ''}
        </p>
        <p className="admin-attention-title">
          {oldest.buyer?.full_name ? `${oldest.buyer.full_name} · ` : ''}
          {reasonHeadline(oldest.review_reason)}
        </p>
        <p className="admin-attention-sub">
          {oldest.code} · {oldest.event?.title}
          {oldest.showtime?.starts_at ? ` · ${vnShortDate(oldest.showtime.starts_at)}` : ''} · {ticketCount(oldest)} vé
          · {formatVnd(oldest.total_amount ?? 0)}
        </p>
      </div>
      <Button asChild className="admin-attention-action">
        <Link to={`/admin/orders/${oldest.id}`}>Xử lý đơn</Link>
      </Button>
    </section>
  )
}

function OrderRow({ order: o, now }: { order: Order; now: Date }) {
  const wait =
    o.status === 'NEEDS_REVIEW' && o.created_at
      ? `chờ ${elapsedText(o.created_at, now)}`
      : o.status === 'PENDING' && o.expires_at
        ? (() => {
            const left = remainingText(o.expires_at, now)
            return left ? `còn ${left}` : 'sắp hết hạn'
          })()
        : null
  return (
    <li>
      <Link to={`/admin/orders/${o.id}`} className="admin-orderrow" aria-label={`Mở đơn ${o.code}`}>
        <span className="admin-avatar" aria-hidden>
          {initials(o.buyer?.full_name)}
        </span>
        <strong className="admin-orderrow-name">{o.buyer?.full_name ?? '—'}</strong>
        <span className="admin-orderrow-code">{o.code}</span>
        <span className="admin-orderrow-event" title={o.event?.title}>
          <span>{o.event?.title}</span>
          {o.showtime?.starts_at && <span>· {vnShortDate(o.showtime.starts_at)}</span>}
        </span>
        <span className="admin-orderrow-qty">{ticketCount(o)} vé</span>
        <span className="admin-orderrow-amount">{formatVnd(o.total_amount ?? 0)}</span>
        <span className="admin-orderrow-time">{o.created_at ? vnTime(o.created_at) : '—'}</span>
        <span className="admin-orderrow-state">
          <StateBadge value={o.status === 'NEEDS_REVIEW' && o.review_reason ? o.review_reason : o.status} />
          {wait && <small>{wait}</small>}
        </span>
        <span className="admin-orderrow-go" aria-hidden>
          ›
        </span>
      </Link>
    </li>
  )
}

export default function AdminOrdersPage() {
  const [params, setParams] = useSearchParams(),
    [now] = useState(() => new Date()),
    [draft, setDraft] = useState(params.get('q') ?? '')
  const status = Object.values(OrderStatus).find((s) => s === params.get('status'))
  const q = params.get('q') || undefined,
    eventId = params.get('event_id') || '',
    showtimeId = params.get('showtime_id') || ''
  const set = (name: string, value: string) =>
    setParams((p) => {
      if (value) p.set(name, value)
      else p.delete(name)
      return p
    })
  // Một ô tìm duy nhất ở thanh trên cùng: chỉ gửi lên API khi đủ 3 ký tự (giới hạn của API).
  useEffect(() => {
    const value = draft.trim(),
      timer = setTimeout(() => {
        if (value.length >= 3) set('q', value)
        else if (!value) set('q', '')
      }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])
  const events = useEventDirectory(),
    event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } })
  const filters = { status, q, event_id: eventId || undefined, showtime_id: showtimeId || undefined }
  const list = useLoadMore<Order>(['orders', filters], (cursor) => adminListOrders({ ...filters, cursor, limit: 20 }))
  const todayKey = vnToday(),
    groups = groupByDay(list.items, (o) => o.created_at)
  const csv = useMutation({
    mutationFn: async () => {
      const all: Order[] = []
      let cursor: string | undefined
      do {
        const page = await adminListOrders({ ...filters, cursor, limit: 100 })
        all.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      download(
        csvText([
          ['Mã đơn', 'Người mua', 'Sự kiện', 'Trạng thái', 'Lý do', 'Số tiền'],
          ...all.map((o) => [
            o.code,
            o.buyer?.full_name,
            o.event?.title,
            stateLabel(o.status),
            o.review_reason ? stateLabel(o.review_reason) : '',
            o.total_amount,
          ]),
        ]),
        'vingo-orders.csv',
      )
    },
  })
  return (
    <AdminPage
      title="Đơn hàng"
      caption="// BÁN VÉ · ĐƠN HÀNG"
      search={{ label: 'Đơn hàng', placeholder: 'Mã đơn, email, SĐT…', value: draft, onChange: setDraft }}
      actions={
        <AdminAction secondary disabled={csv.isPending} onClick={() => csv.mutate()}>
          {csv.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </AdminAction>
      }
    >
      <ErrorNotice error={csv.error} />
      <AttentionCard now={now} />
      <Panel className="admin-orders-panel">
        <div className="admin-toolbar-row">
          <Tabs value={status ?? ''} onChange={(v) => set('status', v)} items={tabItems} />
          <div className="admin-toolbar-selects">
            <select
              className="admin-filter-select"
              aria-label="Sự kiện"
              value={eventId}
              onChange={(e) =>
                setParams((p) => {
                  if (e.target.value) p.set('event_id', e.target.value)
                  else p.delete('event_id')
                  p.delete('showtime_id')
                  return p
                })
              }
            >
              <option value="">Tất cả sự kiện</option>
              {events.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <select
              className="admin-filter-select"
              aria-label="Suất diễn"
              value={showtimeId}
              disabled={!eventId}
              onChange={(e) => set('showtime_id', e.target.value)}
            >
              <option value="">Tất cả suất</option>
              {event.data?.showtimes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {dateText(s.starts_at)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {q && (
          <p className="admin-filter-note">
            Kết quả cho “{q}”{' '}
            <button
              className="underline"
              onClick={() => {
                setDraft('')
                set('q', '')
              }}
            >
              Bỏ tìm
            </button>
          </p>
        )}
        <QueryState query={list.query} empty={!list.items.length} emptyText="Chưa có đơn nào khớp bộ lọc này.">
          {groups.map((g) => {
            const paid = g.items.reduce((s, o) => s + (o.status === 'PAID' ? (o.total_amount ?? 0) : 0), 0)
            return (
              <section key={g.key} className="admin-daygroup" aria-label={dayGroupLabel(g.key, todayKey)}>
                <header>
                  <span>{g.key ? dayGroupLabel(g.key, todayKey) : 'KHÔNG RÕ NGÀY'}</span>
                  <span>
                    {g.items.length} ĐƠN · ĐÃ THU {formatVnd(paid)}
                  </span>
                </header>
                <ul>
                  {g.items.map((o) => (
                    <OrderRow key={o.id} order={o} now={now} />
                  ))}
                </ul>
              </section>
            )
          })}
          <div className="admin-listfoot">
            <span>
              Đang hiện {list.items.length} đơn{list.hasMore ? ' · còn nữa' : ''}
            </span>
            {list.hasMore && (
              <Button variant="outline" className="rounded-pill" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? 'Đang tải…' : 'Tải thêm 20 đơn'}
              </Button>
            )}
          </div>
        </QueryState>
      </Panel>
      <div className="admin-page-end" aria-hidden />
    </AdminPage>
  )
}
