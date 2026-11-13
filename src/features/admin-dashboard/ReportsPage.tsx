import { useState } from 'react'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { QueryMetricGroupBy, QueryMetricMetric } from '@/api/generated/model'
import { AdminPage, Field, Panel, QueryState, Table } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { csvText, dateBounds, dateText, daysAgo, download, vnToday } from '@/design/admin/data'
import { useEventDirectory } from '@/design/admin/data'
import { MetricCard, MetricChart } from './Metrics'
import { metricNames, metricValue, previousRange } from './metricFormat'
export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(6)),
    [to, setTo] = useState(vnToday()),
    [eventId, setEventId] = useState(''),
    [showtimeId, setShowtimeId] = useState(''),
    [metric, setMetric] = useState<QueryMetricMetric>('revenue'),
    [group, setGroup] = useState<QueryMetricGroupBy>('day')
  const events = useEventDirectory(),
    event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } }),
    valid = !!from && !!to && from <= to
  const range = valid ? dateBounds(from, to) : dateBounds(vnToday(), vnToday()),
    prior = previousRange(range.from, range.to),
    filters = { ...range, event_id: eventId || undefined, showtime_id: showtimeId || undefined }
  const query = useQueryMetric({ metric, group_by: group, ...filters }, { query: { enabled: valid } }),
    previous = useQueryMetric({ metric, group_by: group, ...filters, ...prior }, { query: { enabled: valid } })
  const zones = useQueryMetric({ metric: 'tickets_sold', group_by: 'zone', ...filters }, { query: { enabled: valid } }),
    zoneRevenue = useQueryMetric({ metric: 'revenue', group_by: 'zone', ...filters }, { query: { enabled: valid } }),
    zoneFill = useQueryMetric({ metric: 'fill_rate', group_by: 'zone', ...filters }, { query: { enabled: valid } })
  const total =
    query.data?.value ??
    (metric === 'fill_rate' ? undefined : query.data?.series?.reduce((sum, v) => sum + (v.value ?? 0), 0))
  const exportCsv = () =>
    download(
      csvText([
        ['Chỉ số', 'Nhóm', 'Giá trị', 'Từ', 'Đến'],
        ...(query.data?.series ?? []).map((v) => [metric, v.key, v.value, filters.from, filters.to]),
      ]),
      'vingo-bao-cao.csv',
    )
  return (
    <AdminPage
      title="Báo cáo"
      caption="// VẬN HÀNH · QUERY METRICS"
      actions={
        <AdminAction secondary onClick={exportCsv} disabled={!valid || !query.data?.series?.length}>
          Xuất CSV
        </AdminAction>
      }
    >
      <div className="admin-report-filters">
        <label>
          <span className="admin-caption">Sự kiện</span>
          <select
            className="admin-filter-select"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              setShowtimeId('')
            }}
          >
            <option value="">Tất cả sự kiện</option>
            {events.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="admin-caption">Suất</span>
          <select
            className="admin-filter-select"
            value={showtimeId}
            disabled={!eventId}
            onChange={(e) => setShowtimeId(e.target.value)}
          >
            <option value="">Tất cả suất</option>
            {event.data?.showtimes?.map((v) => (
              <option key={v.id} value={v.id}>
                {dateText(v.starts_at)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="admin-caption mb-1.5">Khoảng ngày</p>
          <details className="admin-date-picker">
            <summary>
              {from.slice(8)}/{from.slice(5, 7)} – {to.slice(8)}/{to.slice(5, 7)}/{to.slice(0, 4)}⌄
            </summary>
            <div>
              <Field label="Từ ngày (giờ VN)">
                <input type="date" required value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Đến hết ngày">
                <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
          </details>
        </div>
        <div>
          <p className="admin-caption mb-1.5">Chỉ số</p>
          <div className="admin-segment">
            {Object.entries(metricNames).map(([key, label]) => (
              <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key as QueryMetricMetric)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="admin-caption mb-1.5">Nhóm theo</p>
          <div className="admin-segment">
            {(['day', 'hour', 'tier', 'zone'] as const).map((g, i) => (
              <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>
                {['Ngày', 'Giờ', 'Hạng vé', 'Khu'][i]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {!valid ? (
        <p className="admin-error" role="alert">
          Chọn khoảng ngày hợp lệ: ngày bắt đầu không sau ngày kết thúc.
        </p>
      ) : (
        <>
          <div className="admin-grid admin-stats mb-5">
            {(Object.keys(metricNames) as QueryMetricMetric[]).map((m) => (
              <MetricCard key={m} params={{ metric: m, ...filters }} compare={prior} />
            ))}
          </div>
          <div className="admin-report-charts">
            <Panel>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="admin-caption">
                    {metricNames[metric]} theo{' '}
                    {group === 'day' ? 'ngày' : group === 'hour' ? 'giờ' : group === 'tier' ? 'hạng vé' : 'khu'}
                    {group === 'day' ? ' · UTC' : group === 'hour' ? ' · giờ VN' : ''}
                  </p>
                  <h2 className="mt-1">{metricValue(metric, total, true)}</h2>
                </div>
                <div className="admin-chart-legend">
                  <span>
                    <i />
                    Kỳ này
                  </span>
                  <span>
                    <i className="previous" />
                    Kỳ trước
                  </span>
                </div>
              </div>
              <QueryState query={query}>
                <MetricChart
                  data={query.data}
                  previous={previous.data}
                  group={group}
                  comparisonOffsetMs={Date.parse(range.to) - Date.parse(range.from)}
                />
              </QueryState>
            </Panel>
            <Panel className="admin-table-panel">
              <QueryState query={zones} empty={!zones.data?.series?.length}>
                <Table label="Báo cáo theo khu" headings={['Khu', 'Vé bán', 'Doanh thu', 'Lấp đầy']}>
                  {zones.data?.series?.map((v, i) => (
                    <tr key={`${v.key}-${i}`}>
                      <td>{v.key}</td>
                      <td>{metricValue('tickets_sold', v.value)}</td>
                      <td className="whitespace-nowrap">
                        {metricValue('revenue', zoneRevenue.data?.series?.find((s) => s.key === v.key)?.value, true)}
                      </td>
                      <td>{metricValue('fill_rate', zoneFill.data?.series?.find((s) => s.key === v.key)?.value)}</td>
                    </tr>
                  ))}
                </Table>
              </QueryState>
            </Panel>
          </div>
        </>
      )}
    </AdminPage>
  )
}
