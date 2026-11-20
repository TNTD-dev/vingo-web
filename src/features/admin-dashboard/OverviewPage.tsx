import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { getAdminDashboard } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { AdminPage, Panel, Field, QueryState, Table } from '@/design/admin/AdminUi'
import { ActivityFeed } from '@/design/admin/ActivityFeed'
import { dateBounds, dateText, daysAgo, vnToday } from '@/design/admin/data'
import { formatVnd } from '@/lib/money'
import { OverviewSalesChart } from './OverviewSalesChart'

function change(current: number, previous: number) {
  if (!previous) return current ? 'Kỳ trước chưa có số liệu để so sánh' : 'Không thay đổi so với kỳ trước'
  return `${current >= previous ? '+' : ''}${(((current - previous) / previous) * 100).toFixed(1)}% so với kỳ trước cùng độ dài`
}

export default function OverviewPage() {
  const [from, setFrom] = useState(() => daysAgo(29))
  const [to, setTo] = useState(() => vnToday())
  const [group, setGroup] = useState<'day' | 'month'>('day')
  const [showAllTiers, setShowAllTiers] = useState(false)
  const range = from && to && from <= to ? dateBounds(from, to) : undefined
  const query = useQuery({
    queryKey: ['admin-dashboard', range, group],
    enabled: !!range,
    queryFn: ({ signal }) => getAdminDashboard({ ...range, group_by: group }, { signal }),
  })
  const data = query.data
  const current = data?.current,
    previous = data?.previous
  const revenue = new Map(data?.revenue?.series?.map((p) => [p.key, p.value ?? 0]))
  const tickets = new Map(data?.tickets?.series?.map((p) => [p.key, p.value ?? 0]))
  const keys = [...new Set([...revenue.keys(), ...tickets.keys()])].filter((k): k is string => !!k).sort()
  const tiers = [...(data?.tiers?.series ?? [])].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const tierTotal = tiers.reduce((sum, tier) => sum + (tier.value ?? 0), 0)
  const shownTiers = showAllTiers ? tiers : tiers.slice(0, 5)
  return (
    <AdminPage
      title="Tổng quan"
      caption="Số liệu theo giờ Việt Nam · Doanh thu và vé theo ngày thanh toán"
      actions={<Link to="/admin/events/new">Tạo sự kiện</Link>}
    >
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Từ ngày">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến hết ngày">
            <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Biểu đồ">
            <select value={group} onChange={(e) => setGroup(e.target.value as 'day' | 'month')}>
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
            </select>
          </Field>
        </div>
        {!range && <p role="alert">Chọn khoảng ngày hợp lệ.</p>}
      </Panel>
      <QueryState query={query}>
        {data && (
          <>
            <div className="admin-grid admin-stats mb-4">
              {[
                [
                  'Tổng doanh thu',
                  formatVnd(current?.revenue ?? 0),
                  change(current?.revenue ?? 0, previous?.revenue ?? 0),
                ],
                [
                  'Vé đã bán',
                  (current?.tickets_sold ?? 0).toLocaleString('vi-VN'),
                  change(current?.tickets_sold ?? 0, previous?.tickets_sold ?? 0),
                ],
                [
                  'Người dùng mới',
                  (current?.new_users ?? 0).toLocaleString('vi-VN'),
                  change(current?.new_users ?? 0, previous?.new_users ?? 0),
                ],
                [
                  'Suất đang mở bán',
                  String(data.on_sale_showtimes ?? 0),
                  'Tại thời điểm cập nhật, không theo khoảng lọc',
                ],
              ].map(([label, value, note]) => (
                <Panel key={label}>
                  <p className="admin-caption">{label}</p>
                  <p className="admin-stat-value">{value}</p>
                  <p className="text-xs text-muted">{note}</p>
                </Panel>
              ))}
            </div>
            <div className="overview-dashboard-grid">
              <Panel className="overview-wide-panel">
                <OverviewSalesChart
                  points={keys.map((key) => ({ key, revenue: revenue.get(key) ?? 0, tickets: tickets.get(key) ?? 0 }))}
                />
              </Panel>
              <Panel>
                <h2>Cơ cấu hạng vé</h2>
                <p className="overview-panel-description">
                  Hạng vé bán nhiều nhất · {tierTotal.toLocaleString('vi-VN')} vé trong kỳ
                </p>
                {tiers.length ? (
                  <>
                    <div className="overview-tier-list" id="overview-tiers">
                      {shownTiers.map((tier, index) => (
                        <div key={tier.key} className="overview-tier-row">
                          <span className="overview-tier-rank">{index + 1}</span>
                          <div className="overview-tier-content">
                            <p title={tier.label || tier.key}>{tier.label || tier.key}</p>
                            <div className="overview-meter" aria-hidden="true">
                              <span style={{ width: `${tierTotal ? ((tier.value ?? 0) / tierTotal) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <strong>
                            {tier.value ?? 0}
                            <small>vé</small>
                          </strong>
                        </div>
                      ))}
                    </div>
                    {tiers.length > 5 && (
                      <button
                        type="button"
                        className="overview-tier-expand"
                        aria-expanded={showAllTiers}
                        aria-controls="overview-tiers"
                        onClick={() => setShowAllTiers((value) => !value)}
                      >
                        {showAllTiers ? 'Thu gọn' : `Xem tất cả ${tiers.length} hạng vé`}
                      </button>
                    )}
                  </>
                ) : (
                  <p>Chưa có vé bán.</p>
                )}
              </Panel>
              <Panel className="overview-wide-panel">
                <h2>Suất sắp diễn ra</h2>
                <p className="mb-3 text-xs text-muted">
                  10 suất công bố gần nhất trong tương lai, không theo khoảng lọc.
                </p>
                <Table label="Suất sắp diễn" headings={['Sự kiện', 'Sân', 'Bắt đầu', 'Đã bán']}>
                  {data.upcoming?.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link to={`/admin/events/${s.event_id}`}>{s.title}</Link>
                      </td>
                      <td>{s.venue_name}</td>
                      <td>{dateText(s.starts_at)}</td>
                      <td>
                        {s.sold}/{s.capacity}
                      </td>
                    </tr>
                  ))}
                </Table>
                {!data.upcoming?.length && <p>Chưa có suất sắp diễn.</p>}
              </Panel>
              <Panel>
                <h2>Tỷ lệ bán theo sân</h2>
                <p className="mb-3 text-xs text-muted">Các suất bắt đầu trong khoảng lọc; gồm ghế ngồi và chỗ đứng.</p>
                {data.venues?.map((v) => (
                  <div key={v.id} className="my-3">
                    <div className="flex justify-between">
                      <span>{v.name}</span>
                      <strong>{v.capacity ? (((v.sold ?? 0) / v.capacity) * 100).toFixed(1) : 0}%</strong>
                    </div>
                    <div className="overview-meter my-2" aria-hidden="true">
                      <span
                        style={{ width: `${v.capacity ? Math.min(100, ((v.sold ?? 0) / v.capacity) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs">
                      {v.sold}/{v.capacity} chỗ
                    </p>
                  </div>
                ))}
                {!data.venues?.length && <p>Chưa có suất trong kỳ.</p>}
              </Panel>
              <Panel className="overview-full-panel">
                <ActivityFeed />
              </Panel>
            </div>
            <p className="mt-4 text-xs text-muted">
              Cập nhật {dateText(data.computed_at)} · Doanh thu không phải số dư đối soát ngân hàng.
            </p>
          </>
        )}
      </QueryState>
    </AdminPage>
  )
}
