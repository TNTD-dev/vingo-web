import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  adminListTickets,
  voidTicket,
  reissueTicketQr,
  adminResendTicket,
} from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { TicketStatus, type Ticket } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, StateBadge, Tabs, ConfirmDialog, UiMessageError } from '@/design/admin/AdminUi'
import { isApiError } from '@/api/problem'
import { dateText, useEventDirectory, useLoadMore } from '@/design/admin/data'
import { vnShortDate, vnTime } from '@/design/admin/format'
import { seatText } from './ticketText'
import { stateLabels } from '@/design/admin/labels'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'
import more from '@/design/admin/icons/more.svg'
import { toast } from 'sonner'

type Action = 'void' | 'reissue' | 'resend'
const labels = { void: 'Hủy hiệu lực vé', reissue: 'Cấp lại mã QR', resend: 'Gửi lại vé qua email' }
const descriptions = {
  void: 'Vé sẽ không quét được tại cổng. Hệ thống không hoàn tiền tự động. Hành động được ghi vào audit log.',
  reissue: 'Mã QR cũ sẽ mất hiệu lực và không quét được nữa. Hành động được ghi vào audit log.',
  resend: 'Gửi lại vé tới email đã lưu trong đơn hàng.',
}
const tabItems = [
  { value: '', label: 'Tất cả' },
  ...Object.values(TicketStatus).map((value) => ({ value, label: stateLabels[value] })),
]

function TicketRow({ ticket: t, onAction }: { ticket: Ticket; onAction: (action: Action) => void }) {
  const void_ = t.status === 'VOID',
    canAct = !!t.id && t.status === 'ISSUED'
  return (
    <tr className={cn(void_ && 'admin-row-muted')}>
      <td className="font-mono text-xs">{t.code}</td>
      <td>
        <strong>{t.event?.title ?? '—'}</strong>
        <p className="admin-sub">
          {t.showtime?.starts_at ? `${vnShortDate(t.showtime.starts_at)} · ${vnTime(t.showtime.starts_at)}` : '—'}
          {t.venue?.name ? ` · ${t.venue.name}` : ''}
        </p>
      </td>
      <td>
        {seatText(t)}
        {t.tier && <p className="admin-sub">{/^hạng/i.test(t.tier) ? t.tier : `Hạng ${t.tier}`}</p>}
      </td>
      <td>
        <Link to={`/admin/orders?q=${encodeURIComponent(t.order_code ?? '')}`} className="font-mono text-xs underline">
          #{t.order_code}
        </Link>
      </td>
      <td>
        <StateBadge value={t.status} />
        {t.status === 'USED' && t.used_at && (
          <p className="admin-sub">
            Quét lúc {vnTime(t.used_at)} {vnShortDate(t.used_at)}
          </p>
        )}
      </td>
      <td aria-label={`Thao tác vé ${t.code}`}>
        <div className="admin-row-actions">
          {canAct && (
            <Button variant="outline" className="admin-resend" onClick={() => onAction('resend')}>
              Gửi lại
              <span className="sr-only"> vé {t.code}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="admin-more" aria-label={`Thao tác vé ${t.code}`}>
                <img src={more} alt="" width={18} height={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="admin-ticket-menu">
              {(['reissue', 'resend', 'void'] as const).map((a) => (
                <DropdownMenuItem
                  key={a}
                  disabled={!canAct}
                  variant={a === 'void' ? 'destructive' : 'default'}
                  onClick={() => onAction(a)}
                >
                  {labels[a]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}

export default function AdminTicketsPage() {
  const [params, setParams] = useSearchParams(),
    [draft, setDraft] = useState(params.get('code') ?? ''),
    [selection, setSelection] = useState<{ ticket: Ticket; action: Action } | null>(null),
    [eventId, setEventId] = useState('')
  const status = Object.values(TicketStatus).find((s) => s === params.get('status')),
    client = useQueryClient()
  const set = (name: string, value: string) =>
    setParams((p) => {
      if (value) p.set(name, value)
      else p.delete(name)
      return p
    })
  // Một ô tìm duy nhất ở thanh trên cùng (chip "Trong: Vé"): tra theo mã vé chính xác.
  useEffect(() => {
    const value = draft.trim(),
      timer = setTimeout(() => set('code', value), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])
  const events = useEventDirectory(),
    event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } }),
    showtimeId = eventId
      ? (event.data?.showtimes?.find((s) => s.id === params.get('showtime_id'))?.id ?? event.data?.showtimes?.[0]?.id)
      : params.get('showtime_id') || undefined
  const filters = {
    code: params.get('code') || undefined,
    order_id: params.get('order_id') || undefined,
    showtime_id: showtimeId,
    status,
  }
  const list = useLoadMore<Ticket>(
    ['tickets', filters],
    (cursor) => adminListTickets({ ...filters, cursor, limit: 20 }),
    !eventId || !!showtimeId,
  )
  const mutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: Action; reason: string }) => {
      if (action === 'void') await voidTicket(id, { reason })
      else if (action === 'reissue') await reissueTicketQr(id, { reason })
      else {
        try {
          await adminResendTicket(id)
        } catch (e) {
          if (isApiError(e, 'ORDER_STATE_INVALID'))
            throw new UiMessageError('Đơn này chưa lưu email người mua nên chưa thể gửi lại vé.')
          throw e
        }
      }
    },
    onSuccess: async () => {
      toast.success('Đã thực hiện thao tác với vé')
      setSelection(null)
      await client.invalidateQueries()
    },
  })
  const waitingForShowtime = !!eventId && (!event.data || !showtimeId)
  return (
    <AdminPage
      title="Vé"
      caption="// BÁN VÉ · QUẢN LÝ VÉ"
      search={{ label: 'Vé', placeholder: 'Mã vé…', value: draft, onChange: setDraft }}
    >
      {params.has('order_id') && (
        <p className="mb-4 text-xs">
          Đang lọc vé theo đơn.{' '}
          <button className="underline" onClick={() => set('order_id', '')}>
            Bỏ lọc
          </button>
        </p>
      )}
      <Panel className="admin-tickets-panel">
        <div className="admin-toolbar-row">
          <Tabs value={status ?? ''} items={tabItems} onChange={(v) => set('status', v)} />
          <div className="admin-toolbar-selects">
            <select
              className="admin-filter-select"
              aria-label="Sự kiện"
              value={eventId}
              onChange={(e) => {
                setEventId(e.target.value)
                set('showtime_id', '')
              }}
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
              value={showtimeId ?? ''}
              disabled={!eventId}
              onChange={(e) => set('showtime_id', e.target.value)}
            >
              {!eventId && <option value="">Tất cả suất</option>}
              {!!eventId && !event.data?.showtimes?.length && <option value="">Chưa có suất diễn</option>}
              {event.data?.showtimes?.map((s) => (
                <option key={s.id} value={s.id}>
                  {dateText(s.starts_at)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <QueryState
          query={waitingForShowtime ? event : list.query}
          empty={(!!eventId && !event.isPending && !showtimeId) || (!waitingForShowtime && !list.items.length)}
          emptyText="Chưa có vé nào khớp bộ lọc này."
        >
          <div className="admin-table-wrap">
            <table className="admin-table" aria-label="Danh sách vé">
              <thead>
                <tr>
                  {['Mã vé', 'Sự kiện · suất', 'Chỗ ngồi · hạng vé', 'Đơn', 'Trạng thái', ''].map((h, i) => (
                    <th key={i} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.items.map((t) => (
                  <TicketRow
                    key={t.id}
                    ticket={t}
                    onAction={(action) => {
                      mutation.reset()
                      setSelection({ ticket: t, action })
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-listfoot">
            <span>
              Đang hiện {list.items.length} vé{list.hasMore ? ' · còn nữa' : ''} · mới phát hành trước
            </span>
            {list.hasMore && (
              <Button variant="outline" className="rounded-pill" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? 'Đang tải…' : 'Tải thêm 20 vé'}
              </Button>
            )}
          </div>
        </QueryState>
      </Panel>
      {selection && (
        <ConfirmDialog
          key={`${selection.ticket.id}-${selection.action}`}
          open
          title={`${labels[selection.action]} ${selection.ticket.code}?`}
          description={descriptions[selection.action]}
          label={selection.action === 'void' ? 'Xác nhận huỷ vé' : 'Xác nhận'}
          pending={mutation.isPending}
          error={mutation.error}
          requireReason={selection.action !== 'resend'}
          onClose={() => setSelection(null)}
          onConfirm={(reason) => mutation.mutate({ id: selection.ticket.id!, action: selection.action, reason })}
        />
      )}
      <div className="admin-page-end" aria-hidden />
    </AdminPage>
  )
}
