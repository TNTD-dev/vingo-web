import { Link } from 'react-router'
import { useState } from 'react'
import type { QueryMetricGroupBy } from '@/api/generated/model'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { useAdminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { AdminPage, Panel, QueryState, StateBadge, Table } from '@/design/admin/AdminUi'
import { dateBounds, dateText, daysAgo, vnToday } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { formatVnd } from '@/lib/money'
import { MetricCard, MetricChart } from './Metrics'
import { metricValue } from './metricFormat'

export default function OverviewPage() {
  const [viewedAt] = useState(() => new Date())
  const today = vnToday(),
    range = dateBounds(today, today)
  const [group, setGroup] = useState<QueryMetricGroupBy>('day')
  const revenue = useQueryMetric({ metric: 'revenue', group_by: group, ...dateBounds(daysAgo(13), today) })
  const total = useQueryMetric({ metric: 'revenue', group_by: 'none', ...dateBounds(daysAgo(13), today) })
  const compare = dateBounds(daysAgo(7), daysAgo(7))
  const fill = useQueryMetric({ metric: 'fill_rate', group_by: 'zone', ...range })
  const orders = useAdminListOrders({ status: 'NEEDS_REVIEW', limit: 5 })
  return (
    <AdminPage
      title="Tổng quan"
      caption={`// HÔM NAY · ${new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(viewedAt)}`}
    >
      <div className="admin-grid admin-stats mb-5">
        <MetricCard
          label="Doanh thu hôm nay"
          params={{ metric: 'revenue', ...range }}
          compare={compare}
          comparisonLabel="so với tuần trước"
        />
        <MetricCard
          label="Vé đã bán"
          params={{ metric: 'tickets_sold', ...range }}
          compare={compare}
          comparisonLabel="so với tuần trước"
        />
        <MetricCard
          label="Tỉ lệ lấp đầy"
          params={{ metric: 'fill_rate', ...range }}
          compare={compare}
          comparisonLabel="so với tuần trước"
        />
        <Panel className="admin-stat">
          <p className="admin-caption">Đơn cần xử lý</p>
          <QueryState query={orders}>
            <p className="admin-stat-value">
              {orders.data?.data?.length ?? 0}
              {orders.data?.next_cursor ? '+' : ''}
            </p>
            <Link to="/admin/orders?status=NEEDS_REVIEW" className="admin-stat-comparison">
              <StateBadge value="NEEDS_REVIEW" /> <span>đang chờ duyệt</span>
            </Link>
          </QueryState>
        </Panel>
      </div>
      <div className="admin-overview-charts mb-5">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="admin-caption">Doanh thu 14 ngày{group === 'day' ? ' · nhóm ngày UTC' : ''}</p>
              <h2 className="admin-chart-total">{metricValue('revenue', total.data?.value, true)}</h2>
            </div>
            <div className="admin-segment">
              {(['day', 'hour', 'tier', 'zone'] as const).map((g, i) => (
                <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {['Ngày', 'Giờ', 'Hạng vé', 'Khu'][i]}
                </button>
              ))}
            </div>
          </div>
          <QueryState query={revenue}>
            <MetricChart data={revenue.data} group={group} />
          </QueryState>
        </Panel>
        <Panel>
          <p className="admin-caption mb-6">Lấp đầy theo khu · các suất hôm nay</p>
          <QueryState query={fill} empty={!fill.data?.series?.length}>
            {fill.data?.series?.map((item, i) => (
              <div key={`${item.key}-${i}`} className="mb-5">
                <div className="mb-2 flex justify-between gap-3 text-xs">
                  <span className="truncate" title={item.key}>
                    {item.key}
                  </span>
                  <span>{(item.value ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</span>
                </div>
                <div className="h-2 rounded-pill bg-muted">
                  <div
                    className={`h-full rounded-pill ${item.value === 100 ? 'bg-danger' : 'bg-ink'}`}
                    style={{ width: `${Math.min(100, Math.max(0, item.value ?? 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </QueryState>
        </Panel>
      </div>
      <Panel>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2>Đơn cần xử lý</h2>
          <Link to="/admin/orders?status=NEEDS_REVIEW" className="text-xs underline underline-offset-4">
            Xem tất cả →
          </Link>
        </div>
        <QueryState query={orders} empty={!orders.data?.data?.length} emptyText="Không có đơn đang chờ xử lý.">
          <Table label="Đơn cần xử lý" headings={['Mã đơn', 'Sự kiện', 'Lý do', 'Số tiền', 'Thời gian', '']}>
            {orders.data?.data?.map((order) => (
              <tr key={order.id}>
                <td className="font-mono text-xs">{order.code}</td>
                <td>{order.event?.title ?? '—'}</td>
                <td>
                  <StateBadge value={order.review_reason} />
                </td>
                <td className="whitespace-nowrap">{formatVnd(order.total_amount ?? 0)}</td>
                <td className="text-xs whitespace-nowrap">{dateText(order.created_at)}</td>
                <td aria-label={`Xử lý đơn ${order.code}`}>
                  <Button asChild className="rounded-pill">
                    <Link to={`/admin/orders/${order.id}`}>Xử lý</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </QueryState>
      </Panel>
    </AdminPage>
  )
}
