import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useGetAdminEvent, useListAdminEvents } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { EventCategory, EventStatus, type AdminEventSummary } from '@/api/generated/model'
import { AdminPage, Pager, QueryState, StateBadge, Table, Tabs, Panel } from '@/design/admin/AdminUi'
import { AdminLinkAction } from '@/design/admin/AdminAction'
import { useCursor } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { categories, useEventDirectory, vnParts } from './catalog'
import { duplicateIds, formatVndShort, nextShowtime, saleState } from './readiness'

const saleChip = {
  ON_SALE: { text: 'Đang bán', tone: 'success' },
  UPCOMING: { text: 'Sắp mở bán', tone: 'warning' },
  CLOSED: { text: 'Đã đóng bán', tone: 'neutral' },
  NONE: { text: 'Chưa có suất', tone: 'neutral' },
} as const

export default function AdminEventsPage() {
  const directory = useEventDirectory()
  const [params, setParams] = useSearchParams()
  const status = Object.values(EventStatus).find((s) => s === params.get('status')),
    category = Object.values(EventCategory).find((c) => c === params.get('category')),
    q = params.get('q') ?? '',
    paging = useCursor(params.toString())
  const query = useListAdminEvents({ status, category, q: q || undefined, cursor: paging.cursor, limit: 20 })
  const [now] = useState(() => Date.now())
  const count = (s: string) => directory.data?.filter((e) => e.status === s).length ?? 0
  const dupes = useMemo(() => duplicateIds(directory.data ?? []), [directory.data])
  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: key === 'q' },
    )
  return (
    <AdminPage
      title="Sự kiện & suất diễn"
      caption={`// CATALOG · ${directory.data?.length ?? '—'} SỰ KIỆN · ${count('PUBLISHED')} ĐÃ CÔNG BỐ`}
      search={{ label: 'Sự kiện', placeholder: 'Tìm tên sự kiện…', value: q, onChange: (v) => set('q', v) }}
      actions={<AdminLinkAction to="/admin/events/new">Tạo sự kiện</AdminLinkAction>}
    >
      <div className="wz-filters">
        <Tabs
          value={status ?? ''}
          onChange={(s) => set('status', s)}
          items={[
            { value: '', label: `Tất cả · ${directory.data?.length ?? 0}` },
            { value: 'DRAFT', label: `Nháp · ${count('DRAFT')}` },
            { value: 'PUBLISHED', label: `Đã công bố · ${count('PUBLISHED')}` },
            { value: 'ENDED', label: `Đã kết thúc · ${count('ENDED')}` },
            { value: 'CANCELLED', label: `Đã hủy · ${count('CANCELLED')}` },
          ]}
        />
        <select
          aria-label="Thể loại"
          className="wz-select"
          value={category ?? ''}
          onChange={(e) => set('category', e.target.value)}
        >
          <option value="">Thể loại</option>
          {Object.entries(categories).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <Panel className="admin-table-panel">
        <QueryState query={query} empty={!query.data?.data?.length}>
          <Table
            label="Danh sách sự kiện"
            headings={['Sự kiện', 'Suất tiếp theo', 'Bán vé', 'Lấp đầy', 'Doanh thu', '']}
          >
            {query.data?.data?.map((e) => (
              <EventRow key={e.id} event={e} duplicate={dupes.has(e.id)} now={now} />
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
    </AdminPage>
  )
}

function EventRow({ event: e, duplicate, now }: { event: AdminEventSummary; duplicate: boolean; now: number }) {
  // Mỗi dòng đọc chi tiết sự kiện (tối đa 20 dòng/trang) vì danh sách chưa trả suất diễn, doanh thu, giá.
  const detail = useGetAdminEvent(e.id),
    live = e.status === 'PUBLISHED' || e.status === 'ENDED',
    fill = useQueryMetric({ metric: 'fill_rate', event_id: e.id, group_by: 'none' }, { query: { enabled: live } }),
    revenue = useQueryMetric({ metric: 'revenue', event_id: e.id, group_by: 'none' }, { query: { enabled: live } })
  const shows = detail.data?.showtimes
  const next = nextShowtime(shows, now),
    p = vnParts(next?.starts_at),
    venue = next?.venue?.name ?? detail.data?.venue?.name
  const extra = (shows?.filter((s) => s.status !== 'CANCELLED').length ?? 0) - 1
  const sale = saleState(shows, now)
  const missing = [
    !shows?.some((s) => s.status !== 'CANCELLED') && 'suất diễn',
    !detail.data?.price_tiers?.length && 'hạng giá',
  ].filter(Boolean)
  const draft = e.status === 'DRAFT',
    dim = e.status === 'CANCELLED'
  const pct = fill.data?.value
  return (
    <tr className={dim ? 'wz-dim' : undefined}>
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
            <Link to={draft ? `/admin/events/${e.id}/setup` : `/admin/events/${e.id}`}>
              <strong>{e.title}</strong>
            </Link>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-tertiary">
              {categories[e.category]}
              {duplicate && (
                <span className="wz-chip" data-tone="warning">
                  Có thể trùng
                </span>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap">
        {next && p ? (
          <>
            <span className="wz-mono">
              {p.weekday} {p.day}/{p.month} · {p.time}
            </span>
            <span className="wz-sub">
              {venue}
              {extra > 0 ? ` · +${extra} suất` : ''}
            </span>
          </>
        ) : (
          <span className="wz-sub">{detail.data ? 'Chưa có suất' : '—'}</span>
        )}
      </td>
      <td>
        {draft ? (
          <>
            <StateBadge value="DRAFT" />
            <span className={`wz-sub ${missing.length ? 'wz-warn-text' : ''}`}>
              {detail.data ? (missing.length ? `Thiếu ${missing.join(', ')}` : 'Cần xem lại & công bố') : ''}
            </span>
          </>
        ) : e.status === 'CANCELLED' ? (
          <StateBadge value="CANCELLED" />
        ) : e.status === 'ENDED' ? (
          <StateBadge value="ENDED" />
        ) : detail.data ? (
          <span className="wz-chip" data-tone={saleChip[sale].tone}>
            {saleChip[sale].text}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="w-[150px]">
        {draft ? (
          <Button asChild className="admin-small-button">
            <Link to={`/admin/events/${e.id}/setup`}>Tiếp tục tạo</Link>
          </Button>
        ) : pct !== undefined ? (
          <>
            <div className="wz-bar" role="img" aria-label={`Lấp đầy ${Math.round(pct)}%`}>
              <i style={{ width: `${Math.min(100, pct)}%` }} data-high={pct >= 80} />
            </div>
            <span className="wz-sub wz-mono">{Math.round(pct)}%</span>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="font-medium whitespace-nowrap">
        {revenue.data?.value !== undefined ? formatVndShort(revenue.data.value) : '—'}
      </td>
      <td className="w-14" aria-label={`Thao tác ${e.title}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="admin-more" aria-label={`Thao tác ${e.title}`}>
              <img src={more} alt="" width={18} height={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={draft ? `/admin/events/${e.id}/setup` : `/admin/events/${e.id}`}>
                {draft ? 'Tiếp tục tạo' : 'Quản lý sự kiện'}
              </Link>
            </DropdownMenuItem>
            {!draft && (
              <DropdownMenuItem asChild>
                <Link to={`/admin/events/${e.id}#showtimes`}>Quản lý suất diễn</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to={`/admin/orders?event_id=${e.id}`}>Xem đơn hàng</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}
