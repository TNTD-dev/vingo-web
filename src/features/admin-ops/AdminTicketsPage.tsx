import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useAdminListTickets,
  voidTicket,
  reissueTicketQr,
  adminResendTicket,
} from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { TicketStatus, type Ticket } from '@/api/generated/model'
import {
  AdminPage,
  Panel,
  QueryState,
  Table,
  StateBadge,
  Tabs,
  Pager,
  ConfirmDialog,
  UiMessageError,
} from '@/design/admin/AdminUi'
import { isApiError } from '@/api/problem'
import { useCursor, dateText, useEventDirectory } from '@/design/admin/data'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import { icons } from '@/design/icons'
import more from '@/design/admin/icons/more.svg'
import { toast } from 'sonner'
type Action = 'void' | 'reissue' | 'resend'
const labels = { void: 'Hủy hiệu lực vé (VOID)', reissue: 'Cấp lại mã QR', resend: 'Gửi lại vé qua email' }
const descriptions = {
  void: 'Vé sẽ không quét được tại cổng. Hệ thống không hoàn tiền tự động. Hành động được ghi vào audit log.',
  reissue: 'Mã QR cũ sẽ mất hiệu lực và không quét được nữa. Hành động được ghi vào audit log.',
  resend: 'Gửi lại vé tới email đã lưu trong đơn hàng.',
}
function TicketRow({ ticket: t, onAction }: { ticket: Ticket; onAction: (action: Action) => void }) {
  return (
    <tr>
      <td className="font-mono text-xs">{t.code}</td>
      <td>
        <Link to={`/admin/orders?q=${encodeURIComponent(t.order_code ?? '')}`} className="font-mono text-xs underline">
          #{t.order_code}
        </Link>
      </td>
      <td>
        {t.zone} · {t.row ? `${t.row}-${t.number}` : 'Khu đứng'}
      </td>
      <td className="text-xs whitespace-nowrap">{dateText(t.used_at)}</td>
      <td>
        <StateBadge value={t.status} />
      </td>
      <td aria-label={`Thao tác vé ${t.code}`}>
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
                disabled={!t.id || t.status !== 'ISSUED'}
                variant={a === 'void' ? 'destructive' : 'default'}
                onClick={() => onAction(a)}
              >
                {labels[a]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}
export default function AdminTicketsPage() {
  const [params, setParams] = useSearchParams(),
    [code, setCode] = useState(params.get('code') ?? ''),
    [selection, setSelection] = useState<{ ticket: Ticket; action: Action } | null>(null),
    [eventId, setEventId] = useState('')
  const status = Object.values(TicketStatus).find((s) => s === params.get('status')),
    client = useQueryClient()
  const events = useEventDirectory(),
    event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } }),
    showtimeId = eventId
      ? (event.data?.showtimes?.find((s) => s.id === params.get('showtime_id'))?.id ?? event.data?.showtimes?.[0]?.id)
      : params.get('showtime_id') || undefined,
    paging = useCursor(`${params.toString()}-${eventId}-${showtimeId ?? ''}`)
  const query = useAdminListTickets(
    {
      code: params.get('code') || undefined,
      order_id: params.get('order_id') || undefined,
      showtime_id: showtimeId,
      status,
      cursor: paging.cursor,
      limit: 20,
    },
    { query: { enabled: !eventId || !!showtimeId } },
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
  return (
    <AdminPage title="Vé" caption="// BÁN VÉ · QUẢN LÝ VÉ">
      <div className="admin-compact-filter">
        <form
          className="admin-compact-search w-[360px]"
          onSubmit={(e) => {
            e.preventDefault()
            setParams((p) => {
              p.set('code', code.trim())
              return p
            })
          }}
        >
          <img src={icons.search} alt="" width={16} height={16} />
          <input aria-label="Tìm mã vé" placeholder="Mã vé…" value={code} onChange={(e) => setCode(e.target.value)} />
        </form>
        <Tabs
          value={status ?? ''}
          items={[
            { value: '', label: 'Tất cả' },
            ...Object.values(TicketStatus).map((value) => ({ value, label: value })),
          ]}
          onChange={(v) =>
            setParams((p) => {
              p.set('status', v)
              return p
            })
          }
        />
        <select
          className="admin-filter-select"
          aria-label="Sự kiện"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value)
            setParams((p) => {
              p.delete('showtime_id')
              return p
            })
          }}
        >
          <option value="">Tất cả sự kiện</option>
          {events.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        {eventId && (
          <select
            className="admin-filter-select"
            aria-label="Suất diễn"
            value={showtimeId ?? ''}
            onChange={(e) =>
              setParams((p) => {
                p.set('showtime_id', e.target.value)
                return p
              })
            }
          >
            {!event.data?.showtimes?.length && <option value="">Chưa có suất diễn</option>}
            {event.data?.showtimes?.map((s) => (
              <option key={s.id} value={s.id}>
                {dateText(s.starts_at)}
              </option>
            ))}
          </select>
        )}
      </div>
      {params.has('order_id') && (
        <p className="mb-4 text-xs">
          Đang lọc vé theo đơn.{' '}
          <button
            className="underline"
            onClick={() =>
              setParams((p) => {
                p.delete('order_id')
                return p
              })
            }
          >
            Bỏ lọc
          </button>
        </p>
      )}
      <Panel className="admin-table-panel">
        <QueryState
          query={eventId && (!event.data || !showtimeId) ? event : query}
          empty={(!!eventId && !event.isPending && !showtimeId) || !query.data?.data?.length}
        >
          <Table label="Danh sách vé" headings={['Mã vé', 'Đơn', 'Khu · ghế', 'Đã quét lúc', 'Trạng thái', '']}>
            {query.data?.data?.map((t) => (
              <TicketRow
                key={t.id}
                ticket={t}
                onAction={(action) => {
                  mutation.reset()
                  setSelection({ ticket: t, action })
                }}
              />
            ))}
          </Table>
          <Pager
            cursor={query.data?.next_cursor}
            previous={paging.previous}
            next={() => paging.next(query.data!.next_cursor!)}
            busy={query.isFetching}
          />
        </QueryState>
      </Panel>
      {selection && (
        <ConfirmDialog
          key={`${selection.ticket.id}-${selection.action}`}
          open
          title={`${selection.action === 'void' ? 'Hủy hiệu lực vé' : labels[selection.action]} ${selection.ticket.code}?`}
          description={descriptions[selection.action]}
          label={selection.action === 'void' ? 'Xác nhận VOID' : 'Xác nhận'}
          pending={mutation.isPending}
          error={mutation.error}
          requireReason={selection.action !== 'resend'}
          onClose={() => setSelection(null)}
          onConfirm={(reason) => mutation.mutate({ id: selection.ticket.id!, action: selection.action, reason })}
        />
      )}
    </AdminPage>
  )
}
