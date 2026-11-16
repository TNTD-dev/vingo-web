import { Link } from 'react-router'
import { useState } from 'react'
import type { QueryMetricMetric } from '@/api/generated/model'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { useAdminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { AdminPage, Panel, QueryState, StateBadge, Table } from '@/design/admin/AdminUi'
import { dateBounds, daysAgo, vnToday } from '@/design/admin/data'
import { elapsedText, vnShortDate, vnTime, WEEKDAY_SHORT } from '@/design/admin/format'
import { reasonHint } from '@/design/admin/reasons'
import { Button } from '@/design/ui/button'
import { StatusBadge } from '@/design/StatusBadge'
import { vnDate } from '@/lib/time'
import { formatVnd } from '@/lib/money'
import { ChangeBadge, MetricCard, MetricChart } from './Metrics'
import { OnSaleShowtimes } from './OnSaleShowtimes'
import { addDays, changeText, dayKeys, fillDays, metricNames, metricValue, utcDayBounds } from './metricFormat'

const CHART_DAYS = 14
const CHART_METRICS: QueryMetricMetric[] = ['revenue', 'tickets_sold']
const ddmm = (key: string) => `${key.slice(8)}/${key.slice(5, 7)}`

/** Ô "Check-in hôm nay": không có suất hôm nay thì là "—" (không phải 0%). */
function CheckinCard({ range }: { range: { from: string; to: string } }) {
  const zones = useQueryMetric({ metric: 'fill_rate', group_by: 'zone', ...range }),
    checkins = useQueryMetric({ metric: 'checkins', group_by: 'none', ...range }),
    sold = useQueryMetric({ metric: 'tickets_sold', group_by: 'none', ...range }),
    hasShowtimes = !!zones.data?.series?.length
  return (
    <Panel className="admin-stat">
      <p className="admin-caption">Check-in hôm nay</p>
      <QueryState query={zones}>
        {hasShowtimes ? (
          <>
            <p className="admin-stat-value">{metricValue('checkins', checkins.data?.value, true)}</p>
            <p className="admin-stat-comparison">
              <StatusBadge tone="neutral">
                {checkins.data?.value ?? 0}/{sold.data?.value ?? 0} vé
              </StatusBadge>
              <span>vé đã quét / vé bán hôm nay</span>
            </p>
          </>
        ) : (
          <>
            <p className="admin-stat-value" aria-label="Không có dữ liệu">
              —
            </p>
            <p className="admin-stat-comparison">
              <StatusBadge tone="neutral">0 suất</StatusBadge>
              <span>Hôm nay không có suất diễn</span>
            </p>
          </>
        )}
      </QueryState>
    </Panel>
  )
}

export default function OverviewPage() {
  const [viewedAt] = useState(() => new Date())
  const today = vnToday(),
    range = dateBounds(today, today)
  const [metric, setMetric] = useState<QueryMetricMetric>('revenue')
  const weekday = WEEKDAY_SHORT[vnDate(viewedAt).weekday]
  const sameDayLastWeek = dateBounds(daysAgo(7), daysAgo(7))
  // API nhóm ngày theo UTC: dựng đúng 14 ngày UTC liên tục kết thúc ở ngày hôm nay (giờ VN).
  const firstDay = addDays(today, -(CHART_DAYS - 1)),
    previousFirstDay = addDays(firstDay, -CHART_DAYS)
  const chart = useQueryMetric({ metric, group_by: 'day', ...utcDayBounds(firstDay, today) })
  const chartPrevious = useQueryMetric({
    metric,
    group_by: 'day',
    ...utcDayBounds(previousFirstDay, addDays(firstDay, -1)),
  })
  const points = fillDays(chart.data?.series, dayKeys(firstDay, CHART_DAYS)),
    total = points.reduce((sum, p) => sum + p.value, 0),
    previousTotal = fillDays(chartPrevious.data?.series, dayKeys(previousFirstDay, CHART_DAYS)).reduce(
      (sum, p) => sum + p.value,
      0,
    ),
    change = chartPrevious.data ? changeText(metric, total, previousTotal) : null
  const orders = useAdminListOrders({ status: 'NEEDS_REVIEW', limit: 20 })
  const pending = orders.data?.data ?? [],
    shown = pending.slice(0, 5),
    pendingAmount = pending.reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
    oldest = pending.reduce<string | undefined>(
      (min, o) => (o.created_at && (!min || o.created_at < min) ? o.created_at : min),
      undefined,
    ),
    more = orders.data?.next_cursor ? '+' : ''
  return (
    <AdminPage
      title="Tổng quan"
      caption={`// HÔM NAY · ${new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(viewedAt).toLocaleUpperCase('vi-VN')} · CẬP NHẬT ${vnTime(viewedAt.toISOString())}`}
    >
      <div className="admin-grid admin-stats mb-4">
        <MetricCard
          label="Doanh thu hôm nay"
          params={{ metric: 'revenue', ...range }}
          compare={sameDayLastWeek}
          comparisonLabel={`so với ${weekday} tuần trước`}
        />
        <MetricCard
          label="Vé bán hôm nay"
          params={{ metric: 'tickets_sold', ...range }}
          compare={sameDayLastWeek}
          comparisonLabel={`so với ${weekday} tuần trước`}
        />
        <CheckinCard range={range} />
        <Panel className="admin-stat">
          <p className="admin-caption">Đơn cần xử lý</p>
          <QueryState query={orders}>
            <p className="admin-stat-value">
              {pending.length}
              {more}
            </p>
            <p className="admin-stat-comparison">
              {pending.length ? (
                <>
                  <StatusBadge tone="warning">{formatVnd(pendingAmount)}</StatusBadge>
                  <span>đang treo{oldest ? ` · ${elapsedText(oldest, viewedAt)}` : ''}</span>
                </>
              ) : (
                <span>Không có đơn nào đang chờ</span>
              )}
            </p>
          </QueryState>
        </Panel>
      </div>
      <div className="admin-overview-charts mb-4">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="admin-caption">
                {metricNames[metric]} {CHART_DAYS} ngày · {ddmm(firstDay)} – {ddmm(today)}
              </p>
              <div className="admin-chart-headline">
                <h2 className="admin-chart-total">{metricValue(metric, chart.data ? total : undefined, true)}</h2>
                {change && <ChangeBadge tone={change.tone} text={change.text} />}
                {change && <span className="text-xs text-ink-tertiary">so với {CHART_DAYS} ngày trước</span>}
              </div>
            </div>
            <div className="admin-segment">
              {CHART_METRICS.map((m) => (
                <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>
                  {m === 'revenue' ? 'Doanh thu' : 'Vé bán'}
                </button>
              ))}
            </div>
          </div>
          <QueryState query={chart}>
            <MetricChart metric={metric} points={points} todayKey={today} labelFor={(key) => key.slice(8)} />
          </QueryState>
          <div className="admin-chart-foot">
            <span>
              <i className="admin-legend-dot is-today" /> Hôm nay · chưa hết ngày
            </span>
            <Link to="/admin/reports" className="underline underline-offset-4">
              Ngày tính theo UTC · Mở báo cáo →
            </Link>
          </div>
        </Panel>
        <OnSaleShowtimes now={viewedAt} />
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2>Đơn cần xử lý</h2>
            {!!pending.length && (
              <StatusBadge tone="warning">
                {pending.length}
                {more} đơn
              </StatusBadge>
            )}
          </div>
          <Link to="/admin/orders?status=NEEDS_REVIEW" className="text-sm underline underline-offset-4">
            Xem tất cả →
          </Link>
        </div>
        <QueryState query={orders} empty={!pending.length} emptyText="Không có đơn đang chờ xử lý.">
          <Table label="Đơn cần xử lý" headings={['Mã đơn', 'Sự kiện', 'Lý do', 'Số tiền', 'Tạo lúc · đã chờ', '']}>
            {shown.map((order) => (
              <tr key={order.id}>
                <td className="font-mono text-xs">{order.code}</td>
                <td>
                  {order.event?.title ?? '—'}
                  <span className="text-ink-tertiary">
                    {' '}
                    · {order.items?.reduce((sum, v) => sum + (v.quantity ?? 1), 0) ?? 0} vé
                  </span>
                </td>
                <td>
                  <StateBadge value={order.review_reason} />
                </td>
                <td className="whitespace-nowrap">{formatVnd(order.total_amount ?? 0)}</td>
                <td className="text-xs whitespace-nowrap">
                  {order.created_at ? `${vnShortDate(order.created_at)} ${vnTime(order.created_at)}` : '—'}
                  {order.created_at && (
                    <span
                      className={
                        elapsedText(order.created_at, viewedAt).endsWith('ngày') ? 'admin-wait' : 'text-ink-tertiary'
                      }
                    >
                      {' '}
                      · {elapsedText(order.created_at, viewedAt)}
                    </span>
                  )}
                </td>
                <td aria-label={`Xử lý đơn ${order.code}`}>
                  <Button asChild className="rounded-pill">
                    <Link to={`/admin/orders/${order.id}`}>Xử lý</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          {shown[0] && <p className="admin-hint">{reasonHint(shown[0].review_reason)}</p>}
        </QueryState>
      </Panel>
      <div className="admin-page-end" aria-hidden />
    </AdminPage>
  )
}
