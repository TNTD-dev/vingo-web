import { useInfiniteQuery } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'

import { getListMyTicketsQueryKey, listMyTickets } from '@/api/generated/endpoints/tickets/tickets'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import { StatusBadge } from '@/design/StatusBadge'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatHm, formatWeekdayDayMonth } from '@/lib/time'

import { groupTickets, seatSummary, type TicketGroup } from './ticketGroups'

type When = 'upcoming' | 'past'

// B6 · Vé của tôi (Figma 03 · Buyer).
export default function TicketsPage() {
  const [params, setParams] = useSearchParams()
  const when: When = params.get('when') === 'past' ? 'past' : 'upcoming'
  const apiParams = { when, limit: 50 }

  const query = useInfiniteQuery({
    queryKey: [...getListMyTicketsQueryKey(apiParams), 'infinite'],
    queryFn: ({ pageParam, signal }) => listMyTickets({ ...apiParams, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })
  const tickets = query.data?.pages.flatMap((p) => p.data ?? []) ?? []
  const groups = groupTickets(tickets)
  const count = tickets.filter((t) => t.status === 'ISSUED').length

  return (
    <section className="flex flex-col gap-8 pt-1">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-6">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="type-mono-label text-ink-secondary uppercase">
            {'// '}
            {when === 'upcoming' ? `${count} vé sắp diễn ra` : 'vé đã qua'}
          </p>
          <h1 className="type-display-l text-foreground">Vé của tôi</h1>
        </div>
        <fieldset className="flex gap-1 rounded-pill bg-surface p-1.5">
          <legend className="sr-only">Lọc vé</legend>
          {(['upcoming', 'past'] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={when === w}
              onClick={() => setParams(w === 'upcoming' ? {} : { when: w }, { replace: true })}
              className={cn(
                'rounded-pill px-4 py-2 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring',
                when === w ? 'bg-ink text-on-ink' : 'text-foreground',
              )}
            >
              {w === 'upcoming' ? 'Sắp diễn ra' : 'Đã qua'}
            </button>
          ))}
        </fieldset>
      </header>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[174px] rounded-[20px]" />
          ))}
        </div>
      ) : query.isError ? (
        <Empty title="Không tải được vé" hint="Kiểm tra kết nối rồi thử lại." action={() => void query.refetch()} />
      ) : groups.length === 0 ? (
        <Empty
          title={when === 'upcoming' ? 'Bạn chưa có vé sắp diễn ra' : 'Chưa có vé đã qua'}
          hint="Khám phá sự kiện và đặt vé đầu tiên của bạn."
          to="/events"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li key={g.key}>
              <TicketGroupCard group={g} />
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
          className="mx-auto rounded-pill border border-line bg-surface px-5 py-2.5 type-body-m-strong disabled:opacity-50"
        >
          Tải thêm
        </button>
      )}
    </section>
  )
}

function TicketGroupCard({ group }: { group: TicketGroup }) {
  const first = group.tickets[0]
  const used = group.tickets.every((t) => t.status !== 'ISSUED')
  const status = used ? (first.status === 'VOID' ? 'VOID' : 'USED') : 'ISSUED'
  const start = first.showtime?.starts_at
  return (
    <Link
      to={`/tickets/${first.id}`}
      className={cn(
        'group flex flex-col gap-3 rounded-[20px] bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-stretch sm:gap-6',
        used && 'opacity-60',
      )}
    >
      <div className="h-[150px] shrink-0 overflow-hidden rounded-[14px] bg-muted sm:w-[220px]">
        {first.event?.poster_url ? (
          <img src={first.event.poster_url} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1">
        <div className="flex items-center gap-2">
          <StatusBadge tone={used ? 'neutral' : 'dark'} className={used ? undefined : '!bg-agent !text-foreground'}>
            {status}
          </StatusBadge>
          <span className="type-mono-small text-ink-tertiary uppercase">{group.tickets.length} vé</span>
        </div>
        <h2 className="truncate type-h2 text-foreground">{first.event?.title}</h2>
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 type-caption text-ink-secondary">
          {start && (
            <span className="flex items-center gap-1.5">
              <img src={icons.calendarSm} alt="" className="size-3.5" />
              {formatWeekdayDayMonth(start)} · {formatHm(start)}
            </span>
          )}
          {first.venue?.name && (
            <span className="flex items-center gap-1.5">
              <img src={icons.pin} alt="" className="size-3.5" />
              {first.venue.name}
            </span>
          )}
        </p>
        <p className="type-body-m-strong text-foreground">{seatSummary(group.tickets)}</p>
      </div>
      <div className="flex items-stretch gap-6 sm:pl-0">
        <span aria-hidden className="hidden border-l border-dashed border-line sm:block" />
        <span
          className={cn(
            'flex h-[60px] flex-1 items-center justify-center gap-3 rounded-[14px] text-on-ink sm:h-auto sm:w-[150px] sm:flex-none sm:flex-col',
            used ? 'bg-ink-secondary' : 'bg-ink',
          )}
        >
          <QrCode className="size-8" strokeWidth={1.25} aria-hidden />
          <span className="type-mono-small uppercase">Mở mã QR</span>
        </span>
      </div>
    </Link>
  )
}

function Empty({ title, hint, to, action }: { title: string; hint: string; to?: string; action?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] bg-surface px-6 py-16 text-center">
      <Mascot state="asking" className="size-24" />
      <p className="type-h3 text-foreground">{title}</p>
      <p className="type-body-m text-ink-secondary">{hint}</p>
      {to && (
        <Link to={to} className="mt-2 rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink">
          Khám phá sự kiện
        </Link>
      )}
      {action && (
        <button
          type="button"
          onClick={action}
          className="mt-2 rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink"
        >
          Thử lại
        </button>
      )}
    </div>
  )
}
