import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createEvent,
  useListAdminEvents,
  useGetAdminEvent,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { EventStatus, type EventCreateInput, type AdminEventSummary } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, Table, StateBadge, Tabs, Pager } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { useCursor } from '@/design/admin/data'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { FormDialog, EventForm } from './CatalogForms'
import { categories, useEventDirectory } from './catalog'
import { toast } from 'sonner'

export default function AdminEventsPage() {
  const directory = useEventDirectory()
  const [params, setParams] = useSearchParams(),
    [create, setCreate] = useState(false)
  const status = Object.values(EventStatus).find((s) => s === params.get('status')),
    paging = useCursor(params.toString()),
    client = useQueryClient(),
    navigate = useNavigate()
  const query = useListAdminEvents({ status, q: params.get('q') || undefined, cursor: paging.cursor, limit: 20 })
  const mutation = useMutation({
    mutationFn: (data: EventCreateInput) => createEvent(data),
    onSuccess: async (e) => {
      setCreate(false)
      await client.invalidateQueries()
      toast.success('Đã tạo sự kiện nháp')
      if (e.id) navigate(`/admin/events/${e.id}`)
    },
  })
  return (
    <AdminPage
      title="Sự kiện & suất diễn"
      caption={`// CATALOG · ${directory.data?.length ?? '—'} SỰ KIỆN`}
      actions={
        <AdminAction
          onClick={() => {
            mutation.reset()
            setCreate(true)
          }}
        >
          Tạo sự kiện
        </AdminAction>
      }
    >
      <Tabs
        value={status ?? ''}
        onChange={(s) =>
          setParams((p) => {
            p.set('status', s)
            return p
          })
        }
        items={[
          { value: '', label: `Tất cả · ${directory.data?.length ?? 0}` },
          { value: 'DRAFT', label: `Nháp · ${directory.data?.filter((e) => e.status === 'DRAFT').length ?? 0}` },
          {
            value: 'PUBLISHED',
            label: `Đã publish · ${directory.data?.filter((e) => e.status === 'PUBLISHED').length ?? 0}`,
          },
          { value: 'ENDED', label: `Đã kết thúc · ${directory.data?.filter((e) => e.status === 'ENDED').length ?? 0}` },
          {
            value: 'CANCELLED',
            label: `Đã hủy · ${directory.data?.filter((e) => e.status === 'CANCELLED').length ?? 0}`,
          },
        ]}
      />
      <Panel className="admin-table-panel">
        <QueryState query={query} empty={!query.data?.data?.length}>
          <Table label="Danh sách sự kiện" headings={['Sự kiện', 'Suất', 'Trạng thái', 'Lấp đầy', 'Thao tác']}>
            {query.data?.data?.map((e) => (
              <EventRow key={e.id} event={e} />
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
      {create && (
        <FormDialog title="Tạo sự kiện mới" pending={mutation.isPending} onClose={() => setCreate(false)}>
          <EventForm pending={mutation.isPending} error={mutation.error} onSubmit={(d) => mutation.mutate(d)} />
        </FormDialog>
      )}
    </AdminPage>
  )
}
function EventRow({ event: e }: { event: AdminEventSummary }) {
  const detail = useGetAdminEvent(e.id),
    fill = useQueryMetric(
      { metric: 'fill_rate', event_id: e.id, group_by: 'none' },
      { query: { enabled: e.status === 'PUBLISHED' || e.status === 'ENDED' } },
    )
  return (
    <tr>
      <td>
        <div className="flex min-w-52 items-center gap-3">
          {(e.poster_mobile_url || e.poster_desktop_url) && (
            <img
              src={e.poster_mobile_url || e.poster_desktop_url}
              alt=""
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-sm object-cover"
            />
          )}
          <div>
            <strong>{e.title}</strong>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              {categories[e.category]}
              {detail.data?.venue?.name ? ` · ${detail.data.venue.name}` : ''}
            </p>
          </div>
        </div>
      </td>
      <td className="w-[120px] whitespace-nowrap">
        {detail.data ? `${detail.data.showtimes?.length ?? 0} suất` : '—'}
      </td>
      <td className="w-[150px]">
        <StateBadge value={e.status} />
      </td>
      <td className="w-[120px] font-medium">
        {fill.data?.value !== undefined
          ? `${fill.data.value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%`
          : '—'}
      </td>
      <td className="w-[120px]" aria-label={`Thao tác ${e.title}`}>
        <div className="admin-row-actions">
          <Link to={`/admin/events/${e.id}`} className="font-medium">
            Sửa
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="admin-more" aria-label={`Thao tác ${e.title}`}>
                <img src={more} alt="" width={18} height={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/admin/events/${e.id}#showtimes`}>Quản lý suất diễn</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/admin/orders?event_id=${e.id}`}>Xem đơn hàng</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}
