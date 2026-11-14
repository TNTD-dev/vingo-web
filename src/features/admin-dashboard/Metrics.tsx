import type { MetricResult, QueryMetricParams } from '@/api/generated/model'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { Panel, QueryState } from '@/design/admin/AdminUi'
import { metricNames, metricValue, changeText, metricBucketLabel, previousPoint } from './metricFormat'
export function MetricCard({
  params,
  compare,
  comparisonLabel = 'so với kỳ trước',
  label,
}: {
  params: QueryMetricParams
  compare?: { from: string; to: string }
  comparisonLabel?: string
  label?: string
}) {
  const query = useQueryMetric({ ...params, group_by: 'none' }),
    previous = useQueryMetric({ ...params, ...compare, group_by: 'none' }, { query: { enabled: !!compare } }),
    change = changeText(params.metric, query.data?.value, previous.data?.value)
  return (
    <Panel className="admin-stat">
      <p className="admin-caption">{label ?? metricNames[params.metric]}</p>
      <QueryState query={query}>
        <p className="admin-stat-value">{metricValue(params.metric, query.data?.value, true)}</p>
        <p className="admin-stat-comparison">
          {change && (
            <span className="admin-change">
              <i style={{ background: change.positive ? '#2f9b59' : '#e84035' }} />
              {change.text}
            </span>
          )}
          <span>{change ? comparisonLabel : previous.isError ? 'Chưa có số liệu so sánh' : 'Theo khoảng đã chọn'}</span>
        </p>
      </QueryState>
    </Panel>
  )
}
export function MetricChart({
  data,
  previous,
  group,
  comparisonOffsetMs,
}: {
  data?: MetricResult
  previous?: MetricResult
  group?: string
  comparisonOffsetMs?: number
}) {
  const series = data?.series ?? [],
    max = Math.max(1, ...series.map((v) => v.value ?? 0), ...(previous?.series?.map((v) => v.value ?? 0) ?? []))
  if (!series.length) return <p className="admin-empty">Chưa có dữ liệu trong khoảng thời gian này.</p>
  return (
    <figure
      className={`admin-chart ${previous ? 'admin-chart-paired' : ''}`}
      aria-label={`${metricNames[data?.metric as keyof typeof metricNames] ?? 'Biểu đồ'}: ${series.map((v) => `${v.key}: ${metricValue(data?.metric ?? '', v.value)}`).join('; ')}`}
    >
      {series.map((item, i) => {
        const prior = previousPoint(previous?.series, item.key, group, comparisonOffsetMs)
        return (
          <div
            className="admin-chart-column"
            key={`${item.key}-${i}`}
            title={`${item.key}: ${metricValue(data?.metric ?? '', item.value)}${prior ? ` · Kỳ trước: ${metricValue(data?.metric ?? '', prior.value)}` : ''}`}
          >
            <div className="admin-chart-bars">
              {previous && (
                <div
                  className="admin-chart-bar is-previous"
                  style={{ height: `${(Math.max(0, prior?.value ?? 0) / max) * 100}%` }}
                />
              )}
              <div className="admin-chart-bar" style={{ height: `${(Math.max(0, item.value ?? 0) / max) * 100}%` }} />
            </div>
            <span>{metricBucketLabel(item.key, group)}</span>
          </div>
        )
      })}
    </figure>
  )
}
