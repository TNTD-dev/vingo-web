import { Calendar } from 'lucide-react'
import { Link } from 'react-router'

import { StatusPill } from '@/design/StatusPill'
import { cn } from '@/lib/cn'

import { parseEventList, type EventRow } from './payloads'
import type { BlockProps } from './types'

/** Block `EventList` (Figma M2): danh sách trận/sự kiện agent tìm được; dòng gợi ý có viền đậm. */
export function EventList({ block, onBlockEvent, readOnly }: BlockProps) {
  const { events } = parseEventList(block)
  if (events.length === 0) return null
  return (
    <ul className="w-full max-w-[750px] space-y-1 rounded-lg bg-muted/60 p-1.5" aria-label="Sự kiện tìm được">
      {events.map((e, i) => (
        <Row key={e.eventId ?? i} row={e} onSelect={readOnly ? undefined : onBlockEvent} />
      ))}
    </ul>
  )
}

function Row({ row, onSelect }: { row: EventRow; onSelect?: BlockProps['onBlockEvent'] }) {
  const choose = () =>
    onSelect?.('eventlist.select', { event_id: row.eventId, showtime_id: row.showtimeId }, `Chọn ${row.title}`)
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-surface p-1.5 pr-3',
        row.recommended && 'ring-2 ring-ink',
      )}
    >
      {row.imageUrl ? (
        <img src={row.imageUrl} alt="" className="h-[52px] w-16 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="flex h-[52px] w-16 shrink-0 items-center justify-center rounded-sm bg-canvas">
          <Calendar className="size-5 text-ink-tertiary" aria-hidden />
        </span>
      )}
      <div className="min-w-[160px] flex-1">
        <p className={cn('text-[15px] leading-snug', row.recommended ? 'font-medium' : 'font-normal')}>{row.title}</p>
        {row.subtitle && <p className="type-caption text-ink-tertiary">{row.subtitle}</p>}
      </div>
      <div className="flex flex-col items-end gap-1">
        {row.badge && <StatusPill label={row.badge.label} tone={row.badge.tone} />}
        {row.priceLine && <span className="type-caption text-ink-secondary">{row.priceLine}</span>}
      </div>
      {row.selectable && row.recommended ? (
        <button
          type="button"
          onClick={choose}
          disabled={!onSelect}
          className="rounded-pill bg-ink px-4 py-2.5 type-body-m-strong text-on-ink disabled:opacity-60"
        >
          Chọn trận này
        </button>
      ) : row.eventId ? (
        <Link to={`/events/${row.eventId}`} className="rounded-pill border border-line px-5 py-2 type-body-m-strong">
          Xem
        </Link>
      ) : null}
    </li>
  )
}
