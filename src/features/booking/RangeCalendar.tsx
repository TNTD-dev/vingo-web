import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/cn'

import { monthGrid, parseYmd, pickDate, type DateRange, type Ymd } from './dateRange'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/**
 * Lịch chọn khoảng ngày (không dùng thư viện). Bấm ngày đầu rồi ngày cuối; `onChange` nhận khoảng đang chọn
 * (mới chỉ có `from` khi người dùng chưa bấm ngày cuối). Giờ Việt Nam, tuần bắt đầu từ thứ Hai.
 */
export function RangeCalendar({
  value,
  today,
  onChange,
}: {
  value: DateRange
  today: Ymd
  onChange: (next: DateRange) => void
}) {
  const start = parseYmd(value.from) ?? parseYmd(today)!
  const [view, setView] = useState({ year: start.year, month: start.month })
  const [hover, setHover] = useState<Ymd>()
  const weeks = monthGrid(view.year, view.month)

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month - 1 + delta, 1))
    setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 })
  }

  // Đang chọn dở: dải xem trước chạy tới ngày đang rê chuột.
  const end = value.to ?? (value.from && hover ? hover : undefined)
  const [lo, hi] =
    value.from && end ? (value.from <= end ? [value.from, end] : [end, value.from]) : [undefined, undefined]

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-canvas p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => shift(-1)}
          className="flex size-8 items-center justify-center rounded-pill hover:bg-surface"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="type-body-m-strong text-foreground" aria-live="polite">
          Tháng {view.month}, {view.year}
        </span>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => shift(1)}
          className="flex size-8 items-center justify-center rounded-pill hover:bg-surface"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
      <div role="presentation" onMouseLeave={() => setHover(undefined)}>
        <table className="w-full border-separate border-spacing-y-0.5 text-center">
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="pb-1 type-mono-small font-normal text-ink-tertiary">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].ymd}>
                {week.map((c) => {
                  const isEdge = c.ymd === lo || c.ymd === hi
                  const inside = lo !== undefined && hi !== undefined && c.ymd > lo && c.ymd < hi
                  return (
                    <td
                      key={c.ymd}
                      className={cn(
                        'p-0',
                        (inside || (isEdge && lo !== hi)) && 'bg-agent-soft',
                        c.ymd === lo && lo !== hi && 'rounded-l-pill',
                        c.ymd === hi && lo !== hi && 'rounded-r-pill',
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={isEdge}
                        aria-label={`${c.day}/${c.ymd.slice(5, 7)}/${c.ymd.slice(0, 4)}`}
                        onClick={() => onChange(pickDate(value, c.ymd))}
                        onMouseEnter={() => setHover(c.ymd)}
                        className={cn(
                          'mx-auto flex size-8 items-center justify-center rounded-pill type-caption outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          c.inMonth ? 'text-foreground' : 'text-ink-tertiary/50',
                          c.ymd === today && !isEdge && 'border border-line',
                          isEdge ? 'bg-ink text-on-ink' : 'hover:bg-surface',
                        )}
                      >
                        {c.day}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="type-caption text-ink-tertiary">
        {!value.from ? 'Chọn ngày bắt đầu' : !value.to ? 'Chọn ngày kết thúc' : 'Bấm ngày khác để chọn lại'}
      </p>
    </div>
  )
}
