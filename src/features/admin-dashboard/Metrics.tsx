import type { QueryMetricParams } from '@/api/generated/model'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import { Panel, QueryState } from '@/design/admin/AdminUi'
import { cn } from '@/lib/cn'
import { axisLabel, barLabel, changeText, metricNames, metricValue, type ChartPoint, niceAxis } from './metricFormat'

/** Huy hiệu thay đổi: tăng xanh, giảm đỏ, bằng nhau thì trung tính. */
export function ChangeBadge({ tone, text }: { tone: 'up' | 'down' | 'flat'; text: string }) {
  return (
    <span className="admin-change">
      <i data-tone={tone} />
      {text}
    </span>
  )
}

export function MetricCard({
  params,
  compare,
  comparisonLabel = 'so với kỳ trước',
  label,
  selected,
  onSelect,
  showPreviousValue = false,
}: {
  params: QueryMetricParams
  compare?: { from: string; to: string }
  comparisonLabel?: string
  label?: string
  /** Có `onSelect` thì cả thẻ là nút chọn chỉ số cho biểu đồ. */
  selected?: boolean
  onSelect?: () => void
  /** Hiện "kỳ trước 56,1tr ₫" thay vì chỉ nhãn so sánh. */
  showPreviousValue?: boolean
}) {
  const query = useQueryMetric({ ...params, group_by: 'none' }),
    previous = useQueryMetric({ ...params, ...compare, group_by: 'none' }, { query: { enabled: !!compare } }),
    change = changeText(params.metric, query.data?.value, previous.data?.value)
  const body = (
    <>
      <p className="admin-caption">{label ?? metricNames[params.metric]}</p>
      <QueryState query={query}>
        <p className="admin-stat-value">{metricValue(params.metric, query.data?.value, true)}</p>
        {compare && (
          <p className="admin-stat-comparison">
            {change && <ChangeBadge tone={change.tone} text={change.text} />}
            <span>
              {change
                ? showPreviousValue
                  ? `kỳ trước ${metricValue(params.metric, previous.data?.value, true)}`
                  : comparisonLabel
                : previous.isError
                  ? 'Chưa có số liệu so sánh'
                  : previous.isPending
                    ? ''
                    : 'Kỳ trước chưa có số liệu để so sánh'}
            </span>
          </p>
        )}
      </QueryState>
    </>
  )
  if (!onSelect) return <Panel className="admin-stat">{body}</Panel>
  return (
    <button
      type="button"
      className="admin-panel admin-stat admin-stat-button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {body}
    </button>
  )
}

/**
 * Biểu đồ cột có trục Y, nhãn giá trị trên đầu cột, cột kỳ trước nhạt đặt cạnh và đánh dấu cột hôm nay.
 * Chuỗi `points` đã được điền đủ khoảng (xem `fillDays`).
 */
export function MetricChart({
  metric,
  points,
  previous,
  labelFor,
  todayKey,
  emptyText = 'Chưa có dữ liệu trong khoảng thời gian này.',
}: {
  metric: string
  points: ChartPoint[]
  previous?: ChartPoint[]
  labelFor: (key: string, index: number) => string
  todayKey?: string
  emptyText?: string
}) {
  if (!points.length) return <p className="admin-empty">{emptyText}</p>
  const max = Math.max(0, ...points.map((p) => p.value), ...(previous?.map((p) => p.value) ?? [])),
    axis = niceAxis(max),
    dense = points.length > 16,
    height = (v: number) => `${Math.min(100, Math.max(0, (v / axis.top) * 100))}%`
  const summary = points.map((p, i) => `${labelFor(p.key, i)}: ${metricValue(metric, p.value)}`).join('; ')
  return (
    <figure
      className="admin-plot"
      aria-label={`${metricNames[metric as keyof typeof metricNames] ?? 'Biểu đồ'}: ${summary}`}
    >
      <div className="admin-plot-area">
        {axis.ticks.map((t) => (
          <div key={t} className="admin-plot-grid" style={{ bottom: height(t) }}>
            <span>{axisLabel(metric, t)}</span>
          </div>
        ))}
        <div className="admin-plot-cols">
          {points.map((p, i) => {
            const prior = previous?.[i]
            return (
              <div
                key={p.key}
                className={cn('admin-plot-col', p.key === todayKey && 'is-today')}
                title={`${labelFor(p.key, i)}: ${metricValue(metric, p.value)}${prior ? ` · Kỳ trước: ${metricValue(metric, prior.value)}` : ''}`}
              >
                {previous && (
                  <div className="admin-plot-bar is-previous" style={{ height: height(prior?.value ?? 0) }} />
                )}
                <div className={cn('admin-plot-bar', p.value === 0 && 'is-zero')} style={{ height: height(p.value) }}>
                  {!dense && p.value > 0 && <em>{barLabel(metric, p.value)}</em>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="admin-plot-x">
        {points.map((p, i) => (
          <span key={p.key} className={p.key === todayKey ? 'is-today' : undefined}>
            {labelFor(p.key, i)}
          </span>
        ))}
      </div>
    </figure>
  )
}
