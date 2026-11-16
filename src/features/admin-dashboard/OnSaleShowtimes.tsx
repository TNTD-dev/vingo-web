import { Link } from 'react-router'
import { useQueries } from '@tanstack/react-query'
import { getGetAdminEventQueryOptions } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getQueryMetricQueryOptions } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { Panel, QueryState } from '@/design/admin/AdminUi'
import { useEventDirectory } from '@/design/admin/data'
import { remainingText, vnTime, vnWeekdayDate } from '@/design/admin/format'
import { StatusBadge } from '@/design/StatusBadge'
import { metricValue } from './metricFormat'

const MAX_EVENTS = 8
const MAX_SHOWTIMES = 4

/**
 * Suất đang mở bán, ghép từ danh sách sự kiện + chi tiết sự kiện + `queryMetric(fill_rate, showtime_id)`.
 * API chỉ trả tỉ lệ %, không có số đã bán / sức chứa nên không hiện "186/300 chỗ".
 */
export function OnSaleShowtimes({ now }: { now: Date }) {
  const directory = useEventDirectory(),
    published = (directory.data ?? []).filter((e) => e.status === 'PUBLISHED').slice(0, MAX_EVENTS)
  const details = useQueries({ queries: published.map((e) => getGetAdminEventQueryOptions(e.id)) })
  const showtimes = details
    .flatMap((d) =>
      (d.data?.showtimes ?? [])
        .filter((s) => s.status === 'ON_SALE' && s.starts_at && Date.parse(s.starts_at) > now.getTime())
        .map((s) => ({ ...s, eventTitle: d.data?.title ?? '' })),
    )
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))
    .slice(0, MAX_SHOWTIMES)
  const fills = useQueries({
    queries: showtimes.map((s) =>
      getQueryMetricQueryOptions({ metric: 'fill_rate', group_by: 'none', showtime_id: s.id }),
    ),
  })
  const loadingDetails = details.some((d) => d.isPending)
  return (
    <Panel className="admin-onsale">
      <div className="admin-onsale-head">
        <p className="admin-caption">
          Suất đang mở bán{showtimes.length ? ` · ${showtimes.length} suất gần nhất` : ''}
        </p>
        <Link to="/admin/events" className="text-xs underline underline-offset-4">
          Tất cả →
        </Link>
      </div>
      <QueryState
        query={directory}
        empty={!loadingDetails && !showtimes.length}
        emptyText="Chưa có suất nào đang mở bán."
      >
        {showtimes.map((s, i) => {
          const fill = fills[i]?.data?.value,
            left = remainingText(s.starts_at!, now)
          return (
            <div key={s.id} className="admin-onsale-row">
              <div className="admin-onsale-line">
                <strong title={s.eventTitle}>{s.eventTitle}</strong>
                {fill !== undefined && fill >= 90 && <StatusBadge tone="warning">Sắp hết</StatusBadge>}
                <span className="admin-onsale-pct">{fill === undefined ? '—' : metricValue('fill_rate', fill)}</span>
              </div>
              <div className="admin-meter" aria-hidden>
                <i
                  className={fill !== undefined && fill >= 90 ? 'is-hot' : undefined}
                  style={{ width: `${Math.min(100, Math.max(0, fill ?? 0))}%` }}
                />
              </div>
              <p className="admin-onsale-sub">
                {vnWeekdayDate(s.starts_at!)} · {vnTime(s.starts_at!)}
                {left ? ` · còn ${left}` : ''}
              </p>
            </div>
          )
        })}
      </QueryState>
    </Panel>
  )
}
