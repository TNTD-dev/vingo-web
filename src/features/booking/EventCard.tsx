import { Link } from 'react-router'

import type { EventSummary } from '@/api/generated/model'
import { icons } from '@/design/icons'
import { StatusBadge } from '@/design/StatusBadge'
import { Skeleton } from '@/design/ui/skeleton'
import { formatVnd } from '@/lib/money'
import { formatEventDateTime } from '@/lib/time'

import { CATEGORY_LABEL } from './eventFilters'

/** Thẻ sự kiện — Figma: Design System › EventCard (dùng ở B1). Cả thẻ là link sang chi tiết sự kiện. */
export function EventCard({ event }: { event: EventSummary }) {
  const meta = [event.category && CATEGORY_LABEL[event.category], event.city].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col rounded-lg bg-surface p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative flex h-[220px] flex-col items-start overflow-hidden rounded-md p-3">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/35" />
        <StatusBadge tone={event.on_sale !== false ? 'success' : 'neutral'}>
          {event.on_sale !== false ? 'On sale' : 'Sales closed'}
        </StatusBadge>
      </div>

      <div className="flex flex-col gap-3 px-3 pt-4 pb-3">
        {meta && <p className="type-mono-small text-ink-tertiary">{meta}</p>}
        <h3 className="line-clamp-2 min-h-[2lh] type-h4 tracking-[-0.01em] text-foreground">{event.title}</h3>
        <div className="flex flex-col gap-1.5">
          {event.first_starts_at && (
            <MetaRow icon={icons.calendarSm} text={formatEventDateTime(event.first_starts_at)} />
          )}
          {event.venue_name && <MetaRow icon={icons.pin} text={event.venue_name} />}
        </div>
        <div className="h-px bg-line" />
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="type-mono-small text-ink-tertiary">Từ</span>
            <span className="type-body-m-strong text-foreground">
              {event.price_from ? formatVnd(event.price_from) : 'Miễn phí'}
            </span>
          </div>
          <span className="flex size-10 items-center justify-center rounded-pill bg-ink transition-transform group-hover:rotate-45">
            <img src={icons.arrowUpRight} alt="" className="size-[18px]" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <img src={icon} alt="" className="size-3.5 shrink-0" />
      <span className="truncate type-caption text-ink-secondary">{text}</span>
    </span>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg bg-surface p-2" aria-hidden>
      <Skeleton className="h-[220px] rounded-md" />
      <div className="flex flex-col gap-3 px-3 pt-4 pb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-40" />
        <div className="h-px bg-line" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
