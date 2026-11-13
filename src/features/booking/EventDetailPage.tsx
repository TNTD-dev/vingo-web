import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { useGetAvailability, useGetEvent } from '@/api/generated/endpoints/search/search'
import type { EventDetail, Showtime } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { ArrowButton } from '@/design/ArrowButton'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import { StatusBadge } from '@/design/StatusBadge'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatVnd } from '@/lib/money'
import { formatDayMonthTime, formatShortDateTime, formatTimeRange, showtimeDayBox } from '@/lib/time'

import { CATEGORY_LABEL } from './eventFilters'
import { bannerText, isSelectable, minPrice, seatBadge, SHOWTIME_STATUS, sortShowtimes } from './eventDetailView'

// B2 · Chi tiết sự kiện (Figma 03 · Buyer): banner + giá từ, giới thiệu, hạng vé theo suất, danh sách suất diễn.
export default function EventDetailPage() {
  const { eventId = '' } = useParams()
  const query = useGetEvent(eventId)

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    const notFound = isApiError(query.error, 'NOT_FOUND')
    return (
      <Message
        title={notFound ? 'Không tìm thấy sự kiện' : 'Không tải được sự kiện'}
        hint={notFound ? 'Sự kiện không tồn tại hoặc đã ngừng bán.' : 'Kiểm tra kết nối rồi thử lại.'}
        action={notFound ? undefined : { label: 'Thử lại', onClick: () => void query.refetch() }}
      />
    )
  }
  return <EventDetailView event={query.data} />
}

function EventDetailView({ event }: { event: EventDetail }) {
  const navigate = useNavigate()
  const showtimes = sortShowtimes(event.showtimes ?? [])
  const [picked, setPicked] = useState<string>()
  // Mặc định chọn suất đầu tiên còn bán được; người dùng bấm thì theo người dùng.
  const selected = showtimes.find((s) => s.id === picked && isSelectable(s)) ?? showtimes.find(isSelectable)

  const availability = useGetAvailability(selected?.id ?? '', { query: { enabled: Boolean(selected?.id) } })
  const zones = availability.data?.zones
  const seatsLeft = zones?.reduce((sum, z) => sum + (z.seats_left ?? 0), 0)

  const { title, subtitle } = bannerText(event)
  const from = minPrice(event)
  const tiers = event.price_tiers ?? []
  const poster = event.poster_desktop_url ?? event.poster_mobile_url
  const maxPerOrder = event.max_tickets_per_order

  // B13c: suất đang chọn đã bán hết vé.
  const soldOut = Boolean(selected && selected.status === 'ON_SALE' && selected.sold_out)
  const nextShowtime = showtimes.find(
    (s) => s.id !== selected?.id && s.status !== 'FINISHED' && s.status !== 'CANCELLED' && !s.sold_out,
  )
  const seatsPath = selected && !soldOut ? `/events/${event.id}/showtimes/${selected.id}/seats` : undefined

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Đã sao chép liên kết')
      }
    } catch {
      // Người dùng đóng hộp chia sẻ: không cần báo lỗi.
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="relative flex min-h-[460px] flex-col justify-end gap-8 overflow-hidden rounded-xl p-5 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
        <picture className="absolute inset-0">
          {event.poster_mobile_url && <source media="(max-width: 639px)" srcSet={event.poster_mobile_url} />}
          {poster ? (
            <img src={poster} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-ink" />
          )}
        </picture>
        <div className="absolute inset-0 bg-linear-to-b from-[rgb(14_18_10/0.1)] to-[rgb(14_18_10/0.85)]" />

        <div className="relative flex min-w-0 flex-col items-start gap-5">
          <div className="flex gap-2">
            {event.category && <StatusBadge tone="dark">{CATEGORY_LABEL[event.category].toUpperCase()}</StatusBadge>}
            {selected &&
              (soldOut ? (
                <StatusBadge tone="danger">HẾT VÉ</StatusBadge>
              ) : (
                <StatusBadge tone="success">ON SALE</StatusBadge>
              ))}
          </div>
          <h1 className="type-display-l text-balance text-on-ink">{title}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 type-body-l text-on-ink">
            {subtitle && <BannerMeta icon={icons.calendarLight}>{subtitle}</BannerMeta>}
            {event.venue?.name && (
              <BannerMeta icon={icons.pinLight}>
                {[event.venue.name, event.venue.address].filter(Boolean).join(', ')}
              </BannerMeta>
            )}
          </div>
        </div>

        <div className="relative flex w-full shrink-0 flex-col gap-2 rounded-lg border border-line-inverse bg-glass p-2 backdrop-blur-md lg:w-[340px]">
          <div className="flex flex-col gap-1.5 rounded-md bg-surface p-5">
            <span className="type-mono-label text-ink-secondary">Giá từ</span>
            <span className="type-h1 text-foreground">{from !== undefined ? formatVnd(from) : '—'}</span>
            <span className="type-caption text-ink-secondary">
              {[tiers.length > 0 && `${tiers.length} hạng vé`, maxPerOrder && `tối đa ${maxPerOrder} vé/đơn`]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          <div className="flex gap-2 p-1">
            <button
              type="button"
              disabled={!seatsPath}
              onClick={() => seatsPath && navigate(seatsPath)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md bg-ink py-[5px] pr-4 pl-[5px] whitespace-nowrap text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:gap-5 sm:pr-6"
            >
              <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-sm bg-surface">
                <img src={icons.chevronsRightDark} alt="" className="size-5" />
              </span>
              <span className="type-body-m-strong">{soldOut ? 'Đã hết vé' : 'Chọn suất'}</span>
            </button>
            {/* Chưa có API yêu thích: giữ nút đúng Figma nhưng khoá. */}
            <IconTile label="Yêu thích (sắp có)" icon={icons.heart} disabled />
            <IconTile label="Chia sẻ" icon={icons.share} onClick={() => void share()} />
          </div>
        </div>
      </section>

      {soldOut && selected?.starts_at && (
        <section className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl bg-surface p-5 sm:px-8">
          <Mascot state="sorry" className="h-[72px] w-auto shrink-0" />
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <h2 className="type-h4 text-foreground">Suất {formatShortDateTime(selected.starts_at)} đã bán hết vé</h2>
            <p className="max-w-[640px] type-caption text-ink-secondary">
              Vé chỉ được bán lại khi có đơn hết hạn giữ ghế.
              {nextShowtime?.starts_at &&
                ` Bạn có thể xem suất ${formatShortDateTime(nextShowtime.starts_at)}${nextShowtime.sale_opens_at && nextShowtime.status === 'SCHEDULED' ? ` (mở bán ${formatDayMonthTime(nextShowtime.sale_opens_at)})` : ''}`}
              {nextShowtime ? ' hoặc các sự kiện khác.' : ' Hãy xem các sự kiện khác.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {nextShowtime?.id && (
              <ArrowButton onClick={() => setPicked(nextShowtime.id)}>
                Xem suất {nextShowtime.starts_at ? formatShortDateTime(nextShowtime.starts_at) : ''}
              </ArrowButton>
            )}
            <Link to="/events" className="rounded-pill bg-ink px-5 py-3 type-body-m-strong text-on-ink">
              Sự kiện khác
            </Link>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-6 lg:order-1">
          {event.description && (
            <Card>
              <h2 className="type-mono-label text-ink-secondary">{'// Giới thiệu'}</h2>
              <p className="max-w-[780px] type-body-l text-ink-secondary">{event.description}</p>
            </Card>
          )}
          <TiersCard
            loading={Boolean(selected) && availability.isPending}
            zones={zones}
            fallback={tiers.map((t) => ({ id: t.id, name: t.name, price: t.price }))}
          />
        </div>

        <div className="order-1 flex w-full shrink-0 flex-col gap-4 lg:order-2 lg:w-[520px]">
          <div className="flex items-center justify-between">
            <h2 className="type-h2 text-foreground">Chọn suất diễn</h2>
            <span className="type-mono-label text-ink-tertiary">{showtimes.length} suất</span>
          </div>

          {showtimes.length === 0 && (
            <p className="rounded-lg bg-surface p-6 type-body-m text-ink-secondary">Chưa có suất diễn nào được mở.</p>
          )}
          {showtimes.map((s, i) => (
            <div key={s.id} className="flex flex-col gap-4">
              <ShowtimeRow
                showtime={s}
                active={s.id === selected?.id}
                seatsLeft={s.id === selected?.id ? seatsLeft : undefined}
                onPick={() => setPicked(s.id)}
              />
              {i === showtimes.findIndex(isSelectable) && selected && (
                <Link
                  to="/vingo"
                  className="flex items-center gap-2 self-start rounded-pill py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex size-[22px] items-center justify-center rounded-pill bg-ink">
                    <img src={icons.sparkAgentSm} alt="" className="size-[11px]" />
                  </span>
                  <span className="type-body-m-strong text-foreground">Nhờ Vingo chọn ghế cho suất này</span>
                  <img src={icons.arrowRight} alt="" className="size-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BannerMeta({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <img src={icon} alt="" className="size-[18px] shrink-0" />
      <span>{children}</span>
    </span>
  )
}

function IconTile({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-[54px] shrink-0 items-center justify-center rounded-md bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <img src={icon} alt="" className="size-5" />
    </button>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 sm:p-8">{children}</div>
}

type TierRow = { id?: string; name?: string; price?: number; seatsLeft?: number }

/** Hạng vé và khu. Có tình trạng chỗ của suất đang chọn thì kèm "CÒN n"; chưa có thì chỉ hiện bảng giá. */
function TiersCard({
  loading,
  zones,
  fallback,
}: {
  loading: boolean
  zones?: {
    zone_id?: string
    name?: string
    tier?: { id?: string; name: string; price: number }
    seats_left?: number
  }[]
  fallback: TierRow[]
}) {
  // Sân thật có hàng chục khu nhưng chỉ vài hạng giá: gom theo hạng, cộng số chỗ còn.
  const rows: TierRow[] = zones?.length ? groupByTier(zones) : fallback
  if (!loading && rows.length === 0) return null
  return (
    <div className="flex flex-col rounded-lg bg-surface p-5 sm:p-8">
      <div className="flex items-start justify-between gap-4 pb-4">
        <h2 className="type-mono-label text-ink-secondary">{'// Hạng vé & khu'}</h2>
        <span className="type-caption text-ink-tertiary">Giá đã gồm VAT</span>
      </div>
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="border-t border-line py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))
        : rows.map((r, i) => {
            const badge = r.seatsLeft !== undefined ? seatBadge(r.seatsLeft) : undefined
            return (
              <div key={r.id ?? i} className="flex items-center gap-4 border-t border-line py-4">
                <span className="min-w-0 flex-1 type-body-m-strong text-foreground">{r.name}</span>
                <span className="shrink-0 type-body-m-strong text-foreground">
                  {r.price !== undefined ? formatVnd(r.price) : ''}
                </span>
                {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
              </div>
            )
          })}
    </div>
  )
}

function groupByTier(
  zones: {
    zone_id?: string
    name?: string
    tier?: { id?: string; name: string; price: number }
    seats_left?: number
  }[],
): TierRow[] {
  const map = new Map<string, TierRow>()
  for (const z of zones) {
    const key = z.tier?.id ?? z.tier?.name ?? z.zone_id ?? z.name ?? ''
    const row = map.get(key)
    if (row) row.seatsLeft = (row.seatsLeft ?? 0) + (z.seats_left ?? 0)
    else map.set(key, { id: key, name: z.tier?.name ?? z.name, price: z.tier?.price, seatsLeft: z.seats_left })
  }
  return [...map.values()].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
}

function ShowtimeRow({
  showtime: s,
  active,
  seatsLeft,
  onPick,
}: {
  showtime: Showtime
  active: boolean
  seatsLeft?: number
  onPick: () => void
}) {
  const box = s.starts_at ? showtimeDayBox(s.starts_at) : undefined
  const status = SHOWTIME_STATUS[s.status ?? ''] ?? SHOWTIME_STATUS.FINISHED
  const selectable = isSelectable(s)
  const soldOut = s.status === 'ON_SALE' && s.sold_out
  const note =
    s.status === 'FINISHED'
      ? 'Đã diễn ra'
      : s.status === 'SCHEDULED' && s.sale_opens_at
        ? `Mở bán ${formatDayMonthTime(s.sale_opens_at)}`
        : soldOut
          ? 'Hết vé'
          : s.status === 'SALES_CLOSED'
            ? 'Đã đóng bán'
            : seatsLeft !== undefined
              ? `Còn ${seatsLeft} chỗ`
              : undefined

  const body = (
    <>
      <div
        className={cn(
          'flex h-20 w-[72px] shrink-0 flex-col items-center justify-center rounded-md',
          active ? 'bg-ink' : 'bg-canvas',
        )}
      >
        {box && (
          <>
            <span className={cn('type-mono-small', active ? 'text-on-ink-secondary' : 'text-ink-tertiary')}>
              {box.weekday}
            </span>
            <span className={cn('type-h2', active ? 'text-on-ink' : 'text-foreground')}>{box.day}</span>
            <span className={cn('type-mono-small', active ? 'text-on-ink-secondary' : 'text-ink-tertiary')}>
              {box.month}
            </span>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <span className="type-h4 tracking-[-0.02em] text-foreground">
          {s.starts_at ? formatTimeRange(s.starts_at, s.ends_at) : '—'}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={soldOut ? 'danger' : status.tone}>{soldOut ? 'SOLD OUT' : status.label}</StatusBadge>
          {note && <span className="type-caption text-ink-secondary">{note}</span>}
        </span>
      </div>
      {active && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-ink">
          <img src={icons.chevronRightLight} alt="" className="size-[18px]" />
        </span>
      )}
    </>
  )

  const base = 'flex items-center gap-4 rounded-lg bg-surface p-4'
  if (!selectable) return <div className={cn(base, 'border border-line')}>{body}</div>
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={cn(
        base,
        'w-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-2 border-foreground' : 'border border-line hover:border-ink-tertiary',
      )}
    >
      {body}
    </button>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Đang tải sự kiện">
      <Skeleton className="h-[460px] rounded-xl" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-1 flex-col gap-6">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-[520px]">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function Message({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-surface px-6 py-16 text-center">
      <Mascot state="sorry" className="h-28 w-auto" />
      <h1 className="type-h4 text-foreground">{title}</h1>
      <p className="type-body-m text-ink-secondary">{hint}</p>
      <div className="mt-2 flex gap-2">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {action.label}
          </button>
        )}
        <Link
          to="/events"
          className="rounded-pill border border-line bg-surface px-5 py-2.5 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Về danh sách sự kiện
        </Link>
      </div>
    </div>
  )
}
