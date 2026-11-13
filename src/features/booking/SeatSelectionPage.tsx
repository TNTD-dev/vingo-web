import { useMutation, useQuery } from '@tanstack/react-query'
import { Clock, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { holdSeats } from '@/api/generated/endpoints/booking/booking'
import { getSeatmap, useGetAvailability, useGetEvent, useGetSeatmap } from '@/api/generated/endpoints/search/search'
import type {
  EventDetail,
  GetAvailability200ZonesItem,
  HoldRequest,
  SeatMapZonesItemSeatsItem,
} from '@/api/generated/model'
import { newIdempotencyKey } from '@/api/idempotency'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { Mascot } from '@/design/Mascot'
import { icons } from '@/design/icons'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatVnd } from '@/lib/money'
import { formatEventDateTime, formatShortDateTime } from '@/lib/time'
import { SeatMapView, type SeatState } from '@/seatmap/SeatMapView'
import { indexSvg, parseSeatId, seatSvgId } from '@/seatmap/svg'
import { loadSeatLayoutSvg } from '@/seatmap/svgSource'

import { bannerText } from './eventDetailView'
import {
  buildMapModel,
  DEFAULT_MAX_TICKETS,
  describeHoldError,
  holdBody,
  previewTotal,
  standingLimit,
  ticketCount,
  toggleSeat,
  type PickedSeat,
  type Standing,
  type TierSummary,
} from './seatSelection'
import { Steps } from './Steps'
import { ZoneListPicker } from './ZoneListPicker'

// B3 · Chọn khu (toàn cảnh) → B3b · Chọn ghế trong khu (Figma 03 · Buyer, page 09 · Sơ đồ ghế).
export default function SeatSelectionPage() {
  const { eventId = '', showtimeId = '' } = useParams()
  const event = useGetEvent(eventId)

  if (event.isPending) return <Skeleton className="h-[760px] rounded-lg" aria-busy="true" />
  if (event.isError) {
    return (
      <Message
        title={isApiError(event.error, 'NOT_FOUND') ? 'Không tìm thấy sự kiện' : 'Không tải được sự kiện'}
        hint="Quay lại trang sự kiện để chọn suất khác."
        to={`/events/${eventId}`}
      />
    )
  }
  return <SeatSelection event={event.data} showtimeId={showtimeId} />
}

const TIER_SWATCH = ['bg-tier-1', 'bg-tier-2', 'bg-tier-3', 'bg-tier-4']

function SeatSelection({ event, showtimeId }: { event: EventDetail; showtimeId: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const showtime = event.showtimes?.find((s) => s.id === showtimeId)
  const max = event.max_tickets_per_order ?? DEFAULT_MAX_TICKETS
  const { title } = bannerText(event)

  const [focus, setFocus] = useState<string>()
  const [tierFilter, setTierFilter] = useState<number | 'standing' | null>(null)
  const [picks, setPicks] = useState<PickedSeat[]>([])
  const [standing, setStanding] = useState<Standing | null>(null)
  // Ghế gợi ý khi SEAT_TAKEN (cùng khu, cùng số lượng).
  const [suggestion, setSuggestion] = useState<{ zoneId?: string; seatIds: string[] } | null>(null)

  // ---- dữ liệu ----
  const svg = useQuery({
    queryKey: ['seat-layout-svg', showtimeId],
    queryFn: () => loadSeatLayoutSvg(showtimeId),
    staleTime: Infinity,
    retry: false,
  })
  const availability = useGetAvailability(showtimeId)
  const index = useMemo(() => (svg.data ? indexSvg(svg.data) : null), [svg.data])
  const model = useMemo(
    () => (index && availability.data?.zones ? buildMapModel(index.zones, availability.data.zones) : null),
    [index, availability.data],
  )

  const focusRef = focus ? index?.zones.find((z) => z.code === focus) : undefined
  const focusAvail = focus && model ? model.byCode[focus] : undefined
  const seatmap = useGetSeatmap(
    showtimeId,
    { zone_id: focusAvail?.zone_id },
    { query: { enabled: focusRef?.kind === 'SEATED' && Boolean(focusAvail?.zone_id) } },
  )
  const apiSeats = useMemo(() => {
    const zone = seatmap.data?.zones?.find((z) => z.zone_id === focusAvail?.zone_id)
    return zone?.seats ?? []
  }, [seatmap.data, focusAvail?.zone_id])

  const seatStates = useMemo(() => {
    const out: Record<string, SeatState> = {}
    if (!focus) return out
    for (const s of apiSeats) {
      if (s.row && s.number !== undefined && s.status) out[seatSvgId(focus, s.row, s.number)] = s.status
    }
    return out
  }, [apiSeats, focus])
  const selectedIds = useMemo(() => new Set(picks.map((p) => p.svgId)), [picks])

  // ---- thao tác ----
  const tierOfZone = (code: string) => model?.zones[code]?.tier

  function onZoneClick(code: string) {
    const zone = model?.zones[code]
    const kind = index?.zones.find((z) => z.code === code)?.kind
    if (!zone || zone.soldOut) {
      toast.info('Khu này đã hết vé')
      return
    }
    setFocus(code)
    if (kind === 'STANDING') {
      const a = model?.byCode[code]
      if (!a?.zone_id || !a.tier) return
      // Khu đứng chọn số lượng; không trộn với ghế ngồi trong cùng một đơn.
      if (picks.length) toast.info('Đã bỏ các ghế đang chọn vì khu đứng không chọn kèm ghế ngồi')
      setPicks([])
      setStanding((cur) =>
        cur?.zoneId === a.zone_id
          ? cur
          : {
              zoneId: a.zone_id!,
              zoneCode: code,
              zoneName: a.name ?? code,
              price: a.tier!.price,
              quantity: 1,
              left: a.seats_left ?? 0,
            },
      )
    }
  }

  function onSeatClick(svgId: string) {
    const parsed = parseSeatId(svgId)
    if (!parsed || !model) return
    const api = apiSeats.find((s) => s.row === parsed.row && s.number === parsed.number)
    const a = model.byCode[parsed.zone]
    if (!api?.seat_id || !a?.tier) return
    const toPicked = (s: typeof api): PickedSeat => ({
      seatId: s.seat_id!,
      svgId: seatSvgId(parsed.zone, s.row ?? '', s.number ?? 0),
      zoneCode: parsed.zone,
      zoneName: a.name ?? parsed.zone,
      tier: tierOfZone(parsed.zone),
      row: s.row ?? '',
      number: s.number ?? 0,
      price: a.tier!.price,
      pairSeatId: s.pair_seat_id,
    })
    const partnerApi = api.pair_seat_id ? apiSeats.find((s) => s.seat_id === api.pair_seat_id) : undefined
    const result = toggleSeat(picks, toPicked(api), partnerApi && toPicked(partnerApi), max)
    if (result.error) {
      toast.error(`Tối đa ${max} vé cho mỗi đơn`)
      return
    }
    setStanding(null)
    setPicks(result.picks)
  }

  // ---- chế độ danh sách (khi API chưa có SVG sơ đồ cho người mua) ----
  const listMode = svg.isError && Boolean(availability.data?.zones)

  function listSeatToPicked(zone: GetAvailability200ZonesItem, s: SeatMapZonesItemSeatsItem): PickedSeat {
    return {
      seatId: s.seat_id!,
      zoneId: zone.zone_id,
      svgId: s.seat_id!,
      zoneCode: zone.name ?? '',
      zoneName: zone.name ?? '',
      row: s.row ?? '',
      number: s.number ?? 0,
      price: zone.tier?.price ?? 0,
      pairSeatId: s.pair_seat_id,
    }
  }

  function onListSeatClick(
    zone: GetAvailability200ZonesItem,
    seat: SeatMapZonesItemSeatsItem,
    seats: SeatMapZonesItemSeatsItem[],
  ) {
    if (!seat.seat_id) return
    const partner = seat.pair_seat_id ? seats.find((s) => s.seat_id === seat.pair_seat_id) : undefined
    const result = toggleSeat(
      picks,
      listSeatToPicked(zone, seat),
      partner && partner.seat_id ? listSeatToPicked(zone, partner) : undefined,
      max,
    )
    if (result.error) {
      toast.error(`Mỗi đơn mua tối đa ${max} vé.`)
      return
    }
    setStanding(null)
    setSuggestion(null)
    setPicks(result.picks)
  }

  function onListStandingClick(zone: GetAvailability200ZonesItem) {
    if (!zone.zone_id || !zone.tier) return
    if (picks.length) toast.info('Đã bỏ các ghế đang chọn vì khu đứng không chọn kèm ghế ngồi')
    setPicks([])
    setSuggestion(null)
    setStanding((cur) =>
      cur?.zoneId === zone.zone_id
        ? cur
        : {
            zoneId: zone.zone_id!,
            zoneCode: zone.name ?? '',
            zoneName: zone.name ?? '',
            price: zone.tier!.price,
            quantity: 1,
            left: zone.seats_left ?? 0,
          },
    )
  }

  async function applySuggestion() {
    if (!suggestion) return
    try {
      const data = await getSeatmap(showtimeId, { zone_id: suggestion.zoneId })
      const found: PickedSeat[] = []
      for (const z of data.zones ?? []) {
        const zone = availability.data?.zones?.find((a) => a.zone_id === z.zone_id)
        for (const s of z.seats ?? []) {
          if (s.seat_id && zone && suggestion.seatIds.includes(s.seat_id) && s.status === 'AVAILABLE') {
            found.push(listSeatToPicked(zone, s))
          }
        }
      }
      if (found.length === suggestion.seatIds.length) {
        setPicks(found)
        setSuggestion(null)
        toast.success('Đã chọn ghế gợi ý. Bấm “Giữ ghế” để tiếp tục.')
      } else {
        toast.error('Ghế gợi ý đã có người giữ. Vui lòng chọn lại.')
        setSuggestion(null)
      }
    } catch {
      toast.error('Chưa tải được ghế gợi ý. Vui lòng chọn lại.')
    }
  }

  const hold = useMutation({
    mutationFn: ({ body, key }: { body: HoldRequest; key: string }) =>
      holdSeats(showtimeId, body, { headers: { 'Idempotency-Key': key } }),
  })
  // Một khoá cho một lần bấm; bấm lại sau lỗi (cùng lựa chọn) thì dùng lại khoá đó.
  const keyRef = useRef<{ sig: string; key: string }>(undefined)
  const body = holdBody(picks, standing)

  function submitHold() {
    if (!body) return
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    const sig = JSON.stringify(body)
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() }
    hold.mutate(
      { body, key: keyRef.current.key },
      {
        onSuccess: (order) => {
          keyRef.current = undefined
          navigate(`/orders/${order.id}/checkout`)
        },
        onError: (error) => {
          const failure = describeHoldError(error, max)
          // Lỗi chưa chắc chắn (mạng, 5xx, 429): giữ khoá để retry đúng một thao tác. Lỗi nghiệp vụ: bỏ khoá.
          if (!failure.retrySameKey) keyRef.current = undefined
          if (failure.takenSeatIds.length) {
            const taken = new Set(failure.takenSeatIds)
            const zoneId = picks.find((p) => taken.has(p.seatId))?.zoneId ?? picks[0]?.zoneId
            setPicks((cur) => cur.filter((p) => !taken.has(p.seatId)))
            setSuggestion(failure.suggestedSeatIds.length ? { zoneId, seatIds: failure.suggestedSeatIds } : null)
          }
          toast.error(failure.message)
          if (failure.refresh) {
            void seatmap.refetch()
            void availability.refetch()
          }
        },
      },
    )
  }

  const count = ticketCount(picks, standing)
  const focusTier = focus ? tierOfZone(focus) : undefined
  const mapReady = Boolean(svg.data && model)

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            aria-label="Quay lại"
            onClick={() => navigate(`/events/${event.id}`)}
            className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={icons.chevronLeft} alt="" className="size-[18px]" />
          </button>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate type-mono-label text-ink-secondary">
              {'// '}
              {title.toUpperCase()}
              {showtime?.starts_at && ` · ${formatShortDateTime(showtime.starts_at)}`}
            </p>
            <h1 className="type-h1 text-foreground">Chọn chỗ ngồi</h1>
          </div>
        </div>
        <Steps current={1} />
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg bg-surface p-4 sm:p-7">
          {availability.isError || (svg.isError && !availability.data) ? (
            <Message
              inline
              title="Sơ đồ chỗ ngồi chưa sẵn sàng"
              hint="Chưa tải được sơ đồ của suất này. Vui lòng thử lại sau."
              action={{ label: 'Thử lại', onClick: () => void Promise.all([svg.refetch(), availability.refetch()]) }}
            />
          ) : listMode ? (
            <ZoneListPicker
              showtimeId={showtimeId}
              zones={availability.data?.zones ?? []}
              selected={selectedIds}
              standingZoneId={standing?.zoneId}
              onSeatClick={onListSeatClick}
              onStandingClick={onListStandingClick}
            />
          ) : (
            <>
              <MapHead
                focus={focus}
                tiers={model?.tiers ?? []}
                tierFilter={tierFilter}
                onFilter={setTierFilter}
                focusTier={focusTier}
                focusPrice={focusAvail?.tier?.price}
                gates={focus ? index?.gates[focus] : undefined}
                kind={focusRef?.kind}
                onBack={() => setFocus(undefined)}
              />
              <div className="relative h-[300px] sm:h-[480px] lg:h-[600px]">
                {mapReady && svg.data && model ? (
                  <SeatMapView
                    svg={svg.data}
                    zones={model.zones}
                    focus={focus}
                    seats={seatStates}
                    selected={selectedIds}
                    tierFilter={tierFilter}
                    onZoneClick={onZoneClick}
                    onSeatClick={onSeatClick}
                    tooltip={(code) => {
                      const zone = model.zones[code]
                      const a = model.byCode[code]
                      if (!a || !zone) return null
                      const gate = index?.gates[code]?.[0]
                      return (
                        <ZoneTooltip
                          name={a.name ?? code}
                          tier={zone.tier}
                          standing={index?.zones.find((z) => z.code === code)?.kind === 'STANDING'}
                          price={a.tier?.price}
                          left={a.seats_left ?? 0}
                          soldOut={zone.soldOut}
                          gate={gate}
                        />
                      )
                    }}
                  />
                ) : (
                  <Skeleton className="size-full rounded-md" aria-busy="true" aria-label="Đang tải sơ đồ" />
                )}
              </div>
              <Legend focused={Boolean(focus) && focusRef?.kind === 'SEATED'} tiers={model?.tiers ?? []} />
            </>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-5 rounded-lg bg-surface p-6 lg:w-[400px]">
          <div className="flex items-center gap-3.5">
            {event.poster_mobile_url || event.poster_desktop_url ? (
              <img
                src={event.poster_mobile_url ?? event.poster_desktop_url}
                alt=""
                className="size-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-md bg-muted" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="type-h4 text-foreground">{title}</h2>
              <p className="type-caption text-ink-secondary">
                {[showtime?.starts_at && formatEventDateTime(showtime.starts_at), event.venue?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="h-px bg-line" />

          {count > 0 ? (
            <Selection
              picks={picks}
              standing={standing}
              max={max}
              onRemove={(id) => setPicks((cur) => cur.filter((p) => p.seatId !== id))}
              onQuantity={(q) => setStanding((cur) => (cur ? { ...cur, quantity: q } : cur))}
              onClear={() => {
                setPicks([])
                setStanding(null)
              }}
            />
          ) : (
            <>
              {!listMode && (
                <TierList tiers={model?.tiers ?? []} active={tierFilter} onPick={setTierFilter} loading={!model} />
              )}
              <p className="rounded-md bg-canvas p-3.5 type-body-m text-ink-secondary">
                {listMode
                  ? 'Chưa chọn ghế. Chọn một khu để bắt đầu.'
                  : 'Chưa chọn ghế. Chạm vào một khu trên sơ đồ để bắt đầu.'}
              </p>
            </>
          )}

          {count > 0 && (
            <>
              <div className="flex items-start gap-2.5 rounded-md bg-agent-soft p-3.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-foreground" />
                <p className="type-caption text-ink-secondary">
                  Bấm “Giữ ghế” để giữ chỗ 10 phút. Hết hạn mà chưa thanh toán, ghế được trả lại.
                </p>
              </div>
              <Link
                to="/vingo"
                className="flex items-center gap-2 self-start rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-[22px] items-center justify-center rounded-pill bg-ink">
                  <img src={icons.sparkAgentSm} alt="" className="size-[11px]" />
                </span>
                <span className="type-body-m-strong text-foreground">
                  Để Vingo chọn giúp {count} {standing ? 'vé' : 'ghế đẹp nhất'}
                </span>
                <img src={icons.arrowRight} alt="" className="size-3.5" />
              </Link>
            </>
          )}

          {suggestion && (
            <output className="flex flex-col gap-2 rounded-md bg-agent-soft p-3.5">
              <p className="type-caption text-ink-secondary">
                Còn {suggestion.seatIds.length} ghế trống cùng khu có thể thay thế.
              </p>
              <button
                type="button"
                onClick={() => void applySuggestion()}
                className="self-start rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dùng ghế gợi ý
              </button>
            </output>
          )}

          <button
            type="button"
            disabled={!body || hold.isPending}
            onClick={submitHold}
            className="flex items-center gap-5 rounded-md bg-ink py-[5px] pr-6 pl-[5px] text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-sm bg-surface">
              <img src={icons.chevronsRightDark} alt="" className="size-5" />
            </span>
            <span className="type-body-m-strong">{hold.isPending ? 'Đang giữ ghế…' : 'Giữ ghế & thanh toán'}</span>
          </button>
        </aside>
      </div>
    </div>
  )
}

function MapHead({
  focus,
  tiers,
  tierFilter,
  onFilter,
  focusTier,
  focusPrice,
  gates,
  kind,
  onBack,
}: {
  focus?: string
  tiers: TierSummary[]
  tierFilter: number | 'standing' | null
  onFilter: (f: number | 'standing' | null) => void
  focusTier?: number
  focusPrice?: number
  gates?: string[]
  kind?: 'SEATED' | 'STANDING'
  onBack: () => void
}) {
  if (focus) {
    const stand = focus.charAt(0)
    return (
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-pill bg-canvas px-3.5 py-2 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden>←</span> Toàn cảnh
          </button>
          <span className="type-body-m text-ink-tertiary">Khán đài {stand}</span>
          <span className="type-body-m text-ink-tertiary">/</span>
          <span className="type-body-m-strong text-foreground">
            Khu {focus.replace(/-T\d+$/, '')}
            {kind === 'STANDING' ? ' · Khu đứng' : focusTier ? ` · Hạng ${focusTier}` : ''}
            {focusPrice !== undefined && ` · ${formatVnd(focusPrice)}`}
          </span>
        </div>
        {gates?.length ? (
          <span className="flex items-center gap-1.5 type-caption text-ink-secondary">
            <img src={icons.gate} alt="" className="size-3.5" />
            Vào cổng {gates[0]}
          </span>
        ) : null}
      </div>
    )
  }
  const chip = (key: number | 'standing' | null, label: string) => (
    <button
      key={String(key)}
      type="button"
      aria-pressed={tierFilter === key}
      onClick={() => onFilter(key)}
      className={cn(
        'rounded-pill px-3.5 py-2 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tierFilter === key ? 'bg-ink text-on-ink' : 'bg-canvas text-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {chip(null, 'Tất cả')}
        {tiers.map((t) => chip(t.key, t.label))}
      </div>
      <span className="type-caption text-ink-tertiary">Chạm vào một khu để xem ghế</span>
    </div>
  )
}

function ZoneTooltip({
  name,
  tier,
  standing,
  price,
  left,
  soldOut,
  gate,
}: {
  name: string
  tier?: number
  standing: boolean
  price?: number
  left: number
  soldOut: boolean
  gate?: string
}) {
  return (
    <div className="flex w-[250px] flex-col gap-2 rounded-lg bg-ink p-4 text-on-ink shadow-float">
      <div className="flex items-center gap-2">
        <span className="type-h4">Khu {name.replace(/-T\d+$/, '')}</span>
        <span className="flex items-center gap-1.5 rounded-pill bg-agent px-2.5 py-[3px] type-mono-small text-foreground">
          <span className="size-1.5 rounded-pill bg-ink" />
          {soldOut ? 'HẾT VÉ' : standing ? 'KHU ĐỨNG' : `HẠNG ${tier ?? ''}`}
        </span>
      </div>
      <p className="type-body-m text-on-ink-secondary">
        {price !== undefined && `${formatVnd(price)} · `}
        {soldOut ? 'đã hết chỗ' : `còn ${left} ${standing ? 'chỗ' : 'ghế'}`}
      </p>
      <p className="type-caption text-on-ink-secondary">
        {gate && `Cổng gần nhất: ${gate} · `}
        {soldOut ? 'Khu không còn chỗ' : standing ? 'Chạm để chọn số lượng' : 'Chạm để xem ghế'}
      </p>
    </div>
  )
}

function Legend({ focused, tiers }: { focused: boolean; tiers: TierSummary[] }) {
  const dot = (cls: string, label: string, dashed = false) => (
    <li key={label} className="flex items-center gap-2">
      <span className={cn('size-3.5 rounded-[4px]', cls, dashed && 'border border-dashed border-ink-tertiary')} />
      <span className="type-caption text-ink-secondary">{label}</span>
    </li>
  )
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-1">
      {focused ? (
        <>
          <li className="flex items-center gap-2">
            <span className="size-3.5 rounded-pill border border-ink-tertiary bg-seat-available" />
            <span className="type-caption text-ink-secondary">Trống</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3.5 rounded-pill bg-seat-selected" />
            <span className="type-caption text-ink-secondary">Bạn chọn</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3.5 rounded-pill bg-warning/70" />
            <span className="type-caption text-ink-secondary">Đang được giữ</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3.5 rounded-pill bg-map-sold" />
            <span className="type-caption text-ink-secondary">Đã bán</span>
          </li>
        </>
      ) : (
        <>
          {tiers
            .filter((t) => t.key !== 'standing')
            .map((t) => dot(TIER_SWATCH[Math.min(Number(t.key), 4) - 1], t.label))}
          {tiers.some((t) => t.key === 'standing') && dot('bg-surface', 'Khu đứng', true)}
          {dot('bg-map-sold', 'Hết vé')}
        </>
      )}
    </ul>
  )
}

function TierList({
  tiers,
  active,
  onPick,
  loading,
}: {
  tiers: TierSummary[]
  active: number | 'standing' | null
  onPick: (k: number | 'standing' | null) => void
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 type-mono-label text-ink-secondary">Hạng giá</h3>
      {loading
        ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[59px] rounded-md" />)
        : tiers.map((t) => (
            <button
              key={String(t.key)}
              type="button"
              aria-pressed={active === t.key}
              aria-label={`${t.label}, ${formatVnd(t.price)}, khu ${t.zones}`}
              onClick={() => onPick(active === t.key ? null : t.key)}
              className={cn(
                'flex items-center gap-3.5 rounded-md px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active === t.key ? 'bg-canvas' : 'hover:bg-canvas',
              )}
            >
              <span
                className={cn(
                  'size-[18px] shrink-0 rounded-[5px]',
                  t.key === 'standing'
                    ? 'border border-dashed border-ink-tertiary bg-surface'
                    : TIER_SWATCH[Math.min(Number(t.key), 4) - 1],
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="type-body-m-strong text-foreground">
                  {t.label} · {formatVnd(t.price)}
                </span>
                <span className="type-caption text-ink-tertiary">{t.zones}</span>
              </span>
            </button>
          ))}
    </div>
  )
}

function Selection({
  picks,
  standing,
  max,
  onRemove,
  onQuantity,
  onClear,
}: {
  picks: PickedSeat[]
  standing: Standing | null
  max: number
  onRemove: (seatId: string) => void
  onQuantity: (q: number) => void
  onClear: () => void
}) {
  const total = previewTotal(picks, standing)
  const limit = standing ? standingLimit(max, standing.left) : max
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="type-mono-label text-ink-secondary">{standing ? 'Khu đứng' : 'Ghế đã chọn'}</h3>
        <span className="flex items-center gap-3">
          <span className="type-mono-label text-ink-tertiary">
            {ticketCount(picks, standing)} / {limit}
          </span>
          <button type="button" onClick={onClear} className="type-caption text-ink-tertiary hover:text-foreground">
            Bỏ chọn
          </button>
        </span>
      </div>

      {standing ? (
        <div className="flex items-center justify-between gap-3 rounded-md bg-canvas p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="type-body-m-strong text-foreground">
              Khu {standing.zoneName.replace(/-T\d+$/, '')} · Đứng
            </span>
            <span className="type-caption text-ink-tertiary">{formatVnd(standing.price)} / vé</span>
          </div>
          <div className="flex items-center gap-1 rounded-pill bg-surface p-1">
            <Stepper label="Giảm" disabled={standing.quantity <= 1} onClick={() => onQuantity(standing.quantity - 1)}>
              −
            </Stepper>
            <span className="min-w-6 text-center type-body-m-strong" aria-live="polite">
              {standing.quantity}
            </span>
            <Stepper
              label="Tăng"
              disabled={standing.quantity >= limit}
              onClick={() => onQuantity(standing.quantity + 1)}
            >
              +
            </Stepper>
          </div>
        </div>
      ) : (
        picks.map((p) => (
          <div key={p.seatId} className="flex items-center gap-3 rounded-md bg-canvas p-3">
            <span className="size-3.5 shrink-0 rounded-[4px] bg-ink" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate type-body-m-strong text-foreground">
                Khu {p.zoneName.replace(/-T\d+$/, '')} · Hàng {p.row} · Ghế {String(p.number).padStart(2, '0')}
              </span>
              <span className="type-caption text-ink-tertiary">{p.tier ? `Hạng ${p.tier}` : 'Ghế tiêu chuẩn'}</span>
            </div>
            <span className="shrink-0 type-body-m-strong text-foreground">{formatVnd(p.price)}</span>
            <button
              type="button"
              aria-label={`Bỏ ghế ${p.row}${p.number}`}
              onClick={() => onRemove(p.seatId)}
              className="flex size-6 shrink-0 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <div className="flex items-baseline justify-between">
          <span className="type-body-m text-ink-secondary">Tạm tính</span>
          <span className="type-body-m-strong">{formatVnd(total)}</span>
        </div>
        <p className="type-caption text-ink-tertiary">Số tiền chính thức sẽ hiện ở bước thanh toán sau khi giữ ghế.</p>
      </div>
    </div>
  )
}

function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-pill bg-canvas type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function Message({
  title,
  hint,
  to,
  action,
  inline,
}: {
  title: string
  hint: string
  to?: string
  action?: { label: string; onClick: () => void }
  inline?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', !inline && 'rounded-lg bg-surface')}>
      <Mascot state="sorry" className="h-28 w-auto" />
      <h2 className="type-h4 text-foreground">{title}</h2>
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
        {to && (
          <Link
            to={to}
            className="rounded-pill border border-line bg-surface px-5 py-2.5 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Về trang sự kiện
          </Link>
        )}
      </div>
    </div>
  )
}
