import { useState } from 'react'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import type { QueryMetricGroupBy, QueryMetricMetric } from '@/api/generated/model'
import { DateField } from '@/design/admin/DateTimePicker'
import { AdminPage, Panel, QueryState } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { csvText, dateBounds, dateText, daysAgo, download, vnToday, useEventDirectory } from '@/design/admin/data'
import { WEEKDAY_SHORT } from '@/design/admin/format'
import { cn } from '@/lib/cn'
import { formatDateRange } from '@/lib/time'
import { MetricCard, MetricChart } from './Metrics'
import { useDimensionNames } from './dimensionNames'
import {
  addDays,
  dayCount,
  dayKeys,
  fillDays,
  metricBucketLabel,
  metricNames,
  metricValue,
  previousPoint,
  previousRange,
  type ChartPoint,
} from './metricFormat'

type Preset = 'today' | '7' | '30' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: 'custom', label: 'Tuỳ chọn' },
]
const GROUPS: { value: QueryMetricGroupBy; label: string; noun: string }[] = [
  { value: 'day', label: 'Ngày', noun: 'ngày · giờ Việt Nam' },
  { value: 'hour', label: 'Giờ', noun: 'giờ · giờ VN' },
  { value: 'tier', label: 'Hạng vé', noun: 'hạng vé' },
  { value: 'zone', label: 'Khu', noun: 'khu' },
]
const ddmm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

export default function ReportsPage() {
  const today = vnToday()
  const [preset, setPreset] = useState<Preset>('7'),
    [customFrom, setCustomFrom] = useState(daysAgo(6)),
    [customTo, setCustomTo] = useState(today),
    [eventId, setEventId] = useState(''),
    [showtimeId, setShowtimeId] = useState(''),
    [metric, setMetric] = useState<QueryMetricMetric>('revenue'),
    [group, setGroup] = useState<QueryMetricGroupBy>('day'),
    [dim, setDim] = useState<'zone' | 'tier'>('zone')
  const from = preset === 'today' ? today : preset === '7' ? daysAgo(6) : preset === '30' ? daysAgo(29) : customFrom,
    to = preset === 'custom' ? customTo : today,
    valid = !!from && !!to && from <= to
  const events = useEventDirectory(),
    names = useDimensionNames(eventId)
  const range = valid ? dateBounds(from, to) : dateBounds(today, today),
    prior = previousRange(range.from, range.to),
    filters = { ...range, event_id: eventId || undefined, showtime_id: showtimeId || undefined },
    days = valid ? dayCount(from, to) : 1,
    keys = dayKeys(from, days),
    previousFrom = addDays(from, -days)
  // Khoảng lọc và bucket báo cáo đều theo ngày Việt Nam.
  const dayFilters = group === 'day' ? { ...filters, ...dateBounds(from, to) } : filters,
    previousDayFilters =
      group === 'day' ? { ...filters, ...dateBounds(previousFrom, addDays(from, -1)) } : { ...filters, ...prior }
  const query = useQueryMetric({ metric, group_by: group, ...dayFilters }, { query: { enabled: valid } }),
    previous = useQueryMetric({ metric, group_by: group, ...previousDayFilters }, { query: { enabled: valid } }),
    cardTotal = useQueryMetric({ metric, group_by: 'none', ...filters }, { query: { enabled: valid } })
  const breakdownOn = { query: { enabled: valid } }
  const sold = useQueryMetric({ metric: 'tickets_sold', group_by: dim, ...filters }, breakdownOn),
    revenue = useQueryMetric({ metric: 'revenue', group_by: dim, ...filters }, breakdownOn),
    fill = useQueryMetric({ metric: 'fill_rate', group_by: dim, ...filters }, breakdownOn),
    fillTotal = useQueryMetric({ metric: 'fill_rate', group_by: 'none', ...filters }, breakdownOn)

  const points: ChartPoint[] =
    group === 'day'
      ? fillDays(query.data?.series, keys)
      : (query.data?.series ?? []).map((p) => ({ key: p.key ?? '', value: p.value ?? 0 }))
  const previousPoints: ChartPoint[] | undefined =
    group === 'day'
      ? fillDays(previous.data?.series, dayKeys(previousFrom, days))
      : previous.data
        ? points.map((p) => ({
            key: p.key,
            value:
              previousPoint(previous.data?.series, p.key, group, Date.parse(range.to) - Date.parse(range.from))
                ?.value ?? 0,
          }))
        : undefined
  const additive = metric !== 'fill_rate',
    total = additive && group === 'day' ? points.reduce((s, p) => s + p.value, 0) : cardTotal.data?.value
  const labelFor = (key: string, i: number) => {
    if (group === 'day') {
      const [y, m, d] = key.split('-').map(Number)
      return days <= 10 ? `${WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${ddmm(key)}` : key.slice(8)
    }
    if (group === 'hour') return metricBucketLabel(key, 'hour')
    void i
    return group === 'tier' || group === 'zone' ? names.label(group, key) : key
  }
  const groupNoun = GROUPS.find((g) => g.value === group)!.noun

  const rows = (() => {
    const set = new Set<string>()
    for (const q of [revenue, sold]) for (const p of q.data?.series ?? []) if (p.key) set.add(p.key)
    const val = (q: typeof sold, key: string) => q.data?.series?.find((p) => p.key === key)?.value
    const list = [...set].map((key) => ({
      key,
      sold: val(sold, key) ?? 0,
      revenue: val(revenue, key) ?? 0,
      fill: val(fill, key),
    }))
    return list.sort((a, b) => b.revenue - a.revenue)
  })()
  const sumRevenue = rows.reduce((s, r) => s + r.revenue, 0),
    sumSold = rows.reduce((s, r) => s + r.sold, 0)

  const exportCsv = () =>
    download(
      csvText([
        ['Chỉ số', 'Nhóm', 'Giá trị', 'Từ', 'Đến'],
        ...points.map((p) => [metricNames[metric], labelFor(p.key, 0), p.value, dayFilters.from, dayFilters.to]),
      ]),
      'vingo-bao-cao.csv',
    )
  const eventTitle = names.event?.title

  return (
    <AdminPage
      title="Báo cáo"
      caption="// VẬN HÀNH · BÁO CÁO BÁN VÉ"
      actions={
        <AdminAction secondary onClick={exportCsv} disabled={!valid || !query.data}>
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
            {names.event?.showtimes?.map((v) => (
              <option key={v.id} value={v.id}>
                {dateText(v.starts_at)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <p className="admin-caption mb-1.5">Khoảng ngày</p>
          <div className="admin-segment" role="group" aria-label="Khoảng ngày">
            {PRESETS.map((p) => (
              <button key={p.value} aria-pressed={preset === p.value} onClick={() => setPreset(p.value)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="admin-caption mb-1.5">Từ – đến (giờ VN)</p>
          {preset === 'custom' ? (
            <div className="admin-range-inputs">
              <DateField label="Từ ngày" value={customFrom} max={customTo} onChange={setCustomFrom} />
              <DateField label="Đến hết ngày" value={customTo} min={customFrom} onChange={setCustomTo} />
            </div>
          ) : (
            <p className="admin-range-text">{valid ? formatDateRange(range.from, range.to) : '—'}</p>
          )}
        </div>
        {valid && (
          <p className="admin-compare-note">
            <span className="admin-caption">So với kỳ trước</span>
            <span>{formatDateRange(prior.from, prior.to)}</span>
          </p>
        )}
      </div>
      {!valid ? (
        <p className="admin-error" role="alert">
          Chọn khoảng ngày hợp lệ: ngày bắt đầu không sau ngày kết thúc.
        </p>
      ) : (
        <>
          <div className="admin-grid admin-stats mb-4">
            {(Object.keys(metricNames) as QueryMetricMetric[]).map((m) => (
              <MetricCard
                key={m}
                params={{ metric: m, ...filters }}
                compare={prior}
                selected={metric === m}
                onSelect={() => setMetric(m)}
                showPreviousValue
              />
            ))}
          </div>
          <Panel className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="admin-caption">
                  {metricNames[metric]} theo {groupNoun}
                </p>
                <h2 className="admin-chart-total">{metricValue(metric, total)}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
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
                <div className="admin-segment" role="group" aria-label="Nhóm theo">
                  {GROUPS.map((g) => (
                    <button key={g.value} aria-pressed={group === g.value} onClick={() => setGroup(g.value)}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <QueryState query={query}>
              <MetricChart
                metric={metric}
                points={points}
                previous={previousPoints}
                labelFor={labelFor}
                todayKey={group === 'day' ? today : undefined}
              />
            </QueryState>
          </Panel>
          <Panel>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2>Phân rã theo {dim === 'zone' ? 'khu' : 'hạng vé'}</h2>
                <span className="admin-chip">
                  {rows.length} {dim === 'zone' ? 'khu' : 'hạng'} · sắp theo doanh thu
                </span>
              </div>
              <div className="admin-segment" role="group" aria-label="Phân rã theo">
                {(['zone', 'tier'] as const).map((d) => (
                  <button key={d} aria-pressed={dim === d} onClick={() => setDim(d)}>
                    {d === 'zone' ? 'Khu' : 'Hạng vé'}
                  </button>
                ))}
              </div>
            </div>
            <QueryState query={revenue} empty={!rows.length} emptyText="Chưa có dữ liệu bán vé trong khoảng này.">
              <div className="admin-table-wrap">
                <table className="admin-table admin-breakdown" aria-label="Phân rã doanh thu">
                  <thead>
                    <tr>
                      <th scope="col">
                        {dim === 'zone' ? 'Khu' : 'Hạng vé'}
                        {eventTitle ? ' · sự kiện' : ''}
                      </th>
                      <th scope="col" className="num">
                        Vé bán
                      </th>
                      <th scope="col" className="num">
                        Doanh thu
                      </th>
                      <th scope="col">Tỉ trọng doanh thu</th>
                      <th scope="col">Lấp đầy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const share = sumRevenue ? (r.revenue / sumRevenue) * 100 : 0
                      return (
                        <tr key={r.key}>
                          <td>
                            <strong>{names.label(dim, r.key)}</strong>
                            {eventTitle && <p className="admin-sub">{eventTitle}</p>}
                          </td>
                          <td className="num">{metricValue('tickets_sold', r.sold)}</td>
                          <td className="num whitespace-nowrap">{metricValue('revenue', r.revenue)}</td>
                          <td>
                            <div className="admin-share">
                              <div className="admin-meter" aria-hidden>
                                <i style={{ width: `${share}%` }} />
                              </div>
                              <span>{Math.round(share)}%</span>
                            </div>
                          </td>
                          <td>{r.fill === undefined ? '—' : metricValue('fill_rate', r.fill)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={cn('admin-total-row')}>
                      <td>Tổng cộng</td>
                      <td className="num">{metricValue('tickets_sold', sumSold)}</td>
                      <td className="num whitespace-nowrap">{metricValue('revenue', sumRevenue)}</td>
                      <td>100%</td>
                      <td>{metricValue('fill_rate', fillTotal.data?.value)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </QueryState>
          </Panel>
        </>
      )}
      <div className="admin-page-end" aria-hidden />
    </AdminPage>
  )
}
