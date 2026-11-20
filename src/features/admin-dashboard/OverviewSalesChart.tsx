import { useState } from 'react'
import { formatVnd } from '@/lib/money'

type Point = { key: string; revenue: number; tickets: number }

function periodLabel(key: string) {
  const [year, month, day] = key.split('-')
  return day ? `${day}/${month}` : `${month}/${year}`
}

const compactNumber = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })

export function OverviewSalesChart({ points }: { points: Point[] }) {
  const [metric, setMetric] = useState<'revenue' | 'tickets'>('revenue')
  const [hovered, setHovered] = useState<string>()
  const total = points.reduce((sum, point) => sum + point[metric], 0)
  const maximum = Math.max(1, ...points.map((point) => point[metric]))
  const ceiling = Math.ceil(maximum / 4) * 4
  const plot = { left: 64, top: 16, width: 736, height: 214 }
  const step = plot.width / Math.max(1, points.length)
  const selected = points.find((point) => point.key === hovered)
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const formatValue = (value: number) =>
    metric === 'revenue' ? formatVnd(value) : `${value.toLocaleString('vi-VN')} vé`

  return (
    <>
      <div className="overview-chart-heading">
        <div>
          <h2>Doanh thu và lượng vé bán</h2>
          <p className="overview-panel-description">Theo ngày thanh toán trong khoảng đã chọn</p>
        </div>
        <div className="admin-segment" aria-label="Chỉ số biểu đồ">
          <button type="button" aria-pressed={metric === 'revenue'} onClick={() => setMetric('revenue')}>
            Doanh thu
          </button>
          <button type="button" aria-pressed={metric === 'tickets'} onClick={() => setMetric('tickets')}>
            Số vé
          </button>
        </div>
      </div>
      <p className="overview-chart-total">{formatValue(total)}</p>
      {!points.length ? (
        <p className="overview-chart-empty">Chưa có giao dịch trong kỳ.</p>
      ) : (
        <>
          <div className="overview-sales-plot">
            <svg
              viewBox="0 0 820 270"
              role="img"
              aria-label={`${metric === 'revenue' ? 'Doanh thu' : 'Số vé bán'} theo thời gian`}
            >
              <title>{metric === 'revenue' ? 'Doanh thu' : 'Số vé bán'} trong khoảng đã chọn</title>
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = (ceiling * tick) / 4
                const y = plot.top + plot.height * (1 - tick / 4)
                return (
                  <g key={tick}>
                    <line
                      className="overview-chart-gridline"
                      x1={plot.left}
                      x2={plot.left + plot.width}
                      y1={y}
                      y2={y}
                    />
                    <text className="overview-chart-label" x={plot.left - 12} y={y + 4} textAnchor="end">
                      {compactNumber.format(value)}
                    </text>
                  </g>
                )
              })}
              {points.map((point, index) => {
                const height = (point[metric] / ceiling) * plot.height
                const x = plot.left + index * step
                const barWidth = Math.min(36, step * 0.64)
                return (
                  <g
                    key={point.key}
                    onMouseEnter={() => setHovered(point.key)}
                    onMouseLeave={() => setHovered(undefined)}
                  >
                    <rect className="overview-chart-hit" x={x} y={plot.top} width={step} height={plot.height} />
                    <rect
                      className="overview-chart-column"
                      data-active={hovered === point.key || undefined}
                      x={x + (step - barWidth) / 2}
                      y={plot.top + plot.height - height}
                      width={barWidth}
                      height={height}
                      rx={Math.min(4, step * 0.12)}
                    >
                      <title>
                        {point.key}: {formatVnd(point.revenue)} · {point.tickets} vé
                      </title>
                    </rect>
                    {(index % labelEvery === 0 || index === points.length - 1) && (
                      <text className="overview-chart-label" x={x + step / 2} y={254} textAnchor="middle">
                        {periodLabel(point.key)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="overview-chart-detail">
            {selected
              ? `${selected.key} · ${formatVnd(selected.revenue)} · ${selected.tickets} vé`
              : 'Di chuột vào cột để xem doanh thu và số vé của từng kỳ.'}
          </p>
          <details className="overview-chart-data">
            <summary>Xem số liệu chi tiết</summary>
            <div className="admin-table-wrap">
              <table className="admin-table" aria-label="Số liệu doanh thu và vé">
                <thead>
                  <tr>
                    <th scope="col">Kỳ</th>
                    <th scope="col">Doanh thu</th>
                    <th scope="col">Số vé</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.key}>
                      <td>{point.key}</td>
                      <td>{formatVnd(point.revenue)}</td>
                      <td>{point.tickets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  )
}
