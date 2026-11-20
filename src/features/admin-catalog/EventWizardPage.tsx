import { useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import {
  createEvent,
  publishEvent,
  updateEvent,
  useGetAdminEvent,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getVenueOverview } from '@/api/generated/endpoints/venue-imports/venue-imports'
import type { EventCreateInput, EventDetail, SeatLayoutOverview } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { dateText } from '@/design/admin/data'
import { ChecklistRow, ChoiceCard, ChoiceGroup, LightButton } from '@/design/admin/wizard'
import { formatVnd } from '@/lib/money'
import { SeatMapView } from '@/seatmap/SeatMapView'
import { toast } from 'sonner'
import { categories, useLayoutSvg, vnParts } from './catalog'
import { activeShowtimes, stepLabels, useEventLayouts, useZoneAssignments } from './eventSetup'
import EventPricing from './EventPricing'
import { EventLayoutStep } from './EventLayoutStep'
import EventShowtimesStep from './EventShowtimesStep'
import { mergeLayers } from './LayoutPreview'
import { eventChecklist, readinessSummary } from './readiness'
import { stepItems, WizardShell } from './WizardShell'

export default function EventWizardPage() {
  const { eventId } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    venueHint = params.get('venueId')
  const query = useGetAdminEvent(eventId ?? '', { query: { enabled: !!eventId } })
  const step = Math.min(5, Math.max(1, Number(params.get('step')) || 1))
  const goStep = (n: number, id = eventId) =>
    navigate(`/admin/events/${id}/setup?step=${n}${venueHint ? `&venueId=${venueHint}` : ''}`)
  if (!eventId) return <EventLayoutStep venueHint={venueHint} goStep={goStep} />
  const event = query.data
  if (
    event &&
    (event.seat_layout_id ||
      (!activeShowtimes(event).length &&
        event.status === 'DRAFT' &&
        ['FOOTBALL', 'CONCERT'].includes(event.category ?? '')))
  ) {
    if (step === 1 || !event.seat_layout_id)
      return <EventLayoutStep key={eventId} event={event} venueHint={venueHint} goStep={goStep} />
    if (step === 2) return <EventPricing event={event} goStep={goStep} />
    if (step === 3) return <EventInfoStep key={eventId} event={event} goStep={goStep} />
    if (step === 4) return <EventShowtimesStep event={event} venueHint={venueHint} goStep={goStep} />
    return <EventReviewStep event={event} goStep={goStep} />
  }
  return (
    <QueryState query={query}>
      {query.data &&
        (step === 1 ? (
          <EventInfoStep key={eventId} event={query.data} goStep={goStep} />
        ) : step === 2 ? (
          <EventShowtimesStep event={query.data} venueHint={venueHint} goStep={goStep} />
        ) : step === 3 ? (
          <EventPricing event={query.data} goStep={goStep} />
        ) : (
          <EventReviewStep event={query.data} goStep={goStep} />
        ))}
    </QueryState>
  )
}

const categoryHints: Record<keyof typeof categories, string> = {
  FOOTBALL: 'Có đội nhà / đội khách',
  CONCERT: 'Concert, liveshow',
}
const isUrl = (v?: string) => !v || /^https?:\/\/\S+$/i.test(v)
const footballFields = [
  ['home_team', 'Đội nhà'],
  ['away_team', 'Đội khách'],
  ['league', 'Giải đấu'],
  ['round', 'Vòng đấu'],
] as const

function EventInfoStep({ event, goStep }: { event?: EventDetail; goStep: (n: number, id?: string) => void }) {
  const navigate = useNavigate(),
    client = useQueryClient()
  const [data, setData] = useState<EventCreateInput>({
    title: event?.title ?? '',
    category: event?.category ?? 'FOOTBALL',
    description: event?.description ?? '',
    poster_mobile_url: event?.poster_mobile_url ?? '',
    poster_desktop_url: event?.poster_desktop_url ?? '',
    max_tickets_per_order: event?.max_tickets_per_order ?? 6,
    home_team: event?.home_team ?? undefined,
    away_team: event?.away_team ?? undefined,
    league: event?.league ?? undefined,
    round: event?.round ?? undefined,
  })
  const valid = !!data.title.trim() && isUrl(data.poster_mobile_url) && isUrl(data.poster_desktop_url)
  const save = useMutation({
    mutationFn: async (then: 'next' | 'list') => {
      const body: EventCreateInput = {
        ...data,
        title: data.title.trim(),
        poster_mobile_url: data.poster_mobile_url || undefined,
        poster_desktop_url: data.poster_desktop_url || undefined,
        ...(data.category !== 'FOOTBALL'
          ? { home_team: undefined, away_team: undefined, league: undefined, round: undefined }
          : {}),
      }
      const saved = event?.id ? await updateEvent(event.id, body) : await createEvent(body)
      return { id: saved.id ?? event?.id, then }
    },
    onSuccess: async ({ id, then }) => {
      await client.invalidateQueries()
      toast.success(event ? 'Đã lưu thông tin' : 'Đã tạo sự kiện nháp')
      if (then === 'list') navigate('/admin/events')
      else goStep(event?.seat_layout_id ? 4 : 2, id)
    },
  })
  const ordered = !!event?.seat_layout_id
  const description = data.description ?? ''
  const qty = data.max_tickets_per_order ?? 6
  return (
    <WizardShell
      title={event ? 'Thông tin' : 'Tạo sự kiện'}
      caption={`// ${event ? event.title?.toUpperCase() : 'SỰ KIỆN MỚI'} · BƯỚC ${ordered ? '3/5' : '1/4'}`}
      steps={stepItems(stepLabels(event), ordered ? 2 : 0)}
      onSelectStep={event ? (i) => goStep(i + 1) : undefined}
      actions={
        <>
          <LightButton disabled={!valid || save.isPending} onClick={() => save.mutate('list')}>
            Lưu nháp
          </LightButton>
          <AdminAction disabled={!valid || save.isPending} onClick={() => save.mutate('next')}>
            {save.isPending ? 'Đang lưu…' : 'Tiếp: Suất diễn'}
          </AdminAction>
        </>
      }
    >
      <div className="wz-grid wz-grid-wide-side">
        <Panel className="wz-panel">
          <fieldset disabled={save.isPending} className="min-w-0">
            {!ordered && (
              <>
                <p className="admin-caption">Thể loại *</p>
                <ChoiceGroup label="Thể loại" className="!mt-2">
                  {(Object.keys(categories) as (keyof typeof categories)[])
                    .filter((c) => c === 'FOOTBALL' || c === 'CONCERT')
                    .map((c) => (
                      <ChoiceCard
                        key={c}
                        title={categories[c]}
                        hint={categoryHints[c]}
                        selected={data.category === c}
                        onSelect={() => setData({ ...data, category: c })}
                      />
                    ))}
                </ChoiceGroup>
              </>
            )}
            <div className="wz-fields">
              <div className="wz-span">
                <Field label="Tên sự kiện *">
                  <input
                    required
                    maxLength={200}
                    value={data.title}
                    onChange={(e) => setData({ ...data, title: e.target.value })}
                  />
                </Field>
              </div>
              <div className="wz-span">
                <Field label="Giới thiệu sự kiện">
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setData({ ...data, description: e.target.value })}
                  />
                </Field>
                <p className="wz-panel-hint text-right font-mono">{description.length} / 2000</p>
              </div>
            </div>
            {data.category === 'FOOTBALL' && (
              <section className="wz-fields rounded-2xl bg-canvas p-4" aria-label="Thông tin trận đấu">
                <h3 className="wz-span flex items-center justify-between font-medium">
                  Thông tin trận đấu{' '}
                  <span className="wz-chip" data-tone="agent">
                    Bóng đá
                  </span>
                </h3>
                {footballFields.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} />
                  </Field>
                ))}
              </section>
            )}
            <div className="mt-6 flex flex-wrap items-end gap-8">
              <div>
                <p className="admin-caption mb-2">Tối đa vé / đơn *</p>
                <div className="wz-qty">
                  <button
                    type="button"
                    aria-label="Giảm"
                    disabled={qty <= 1}
                    onClick={() => setData({ ...data, max_tickets_per_order: qty - 1 })}
                  >
                    <Minus size={14} aria-hidden />
                  </button>
                  <output aria-label="Tối đa vé mỗi đơn">{qty}</output>
                  <button
                    type="button"
                    aria-label="Tăng"
                    disabled={qty >= 20}
                    onClick={() => setData({ ...data, max_tickets_per_order: qty + 1 })}
                  >
                    <Plus size={14} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </fieldset>
          <ErrorNotice error={save.error} />
        </Panel>
        <Panel className="wz-panel wz-sticky">
          <h2>Poster</h2>
          <p className="wz-panel-hint mb-4">Dán URL ảnh — xem trước đúng tỉ lệ app</p>
          <div className="grid grid-cols-[112px_1fr] gap-3">
            <div className="text-ink-inverse grid h-[200px] place-items-end overflow-hidden rounded-xl bg-ink p-3 text-sm">
              {data.poster_mobile_url && isUrl(data.poster_mobile_url) ? (
                <img src={data.poster_mobile_url} alt="Poster dọc" className="size-full object-cover" />
              ) : (
                <strong className="font-medium">{data.title || 'Tên sự kiện'}</strong>
              )}
            </div>
            <div className="grid h-[100px] place-items-center self-end overflow-hidden rounded-xl border border-dashed text-center text-xs text-ink-tertiary">
              {data.poster_desktop_url && isUrl(data.poster_desktop_url) ? (
                <img src={data.poster_desktop_url} alt="Poster ngang" className="size-full object-cover" />
              ) : (
                'Thêm poster ngang 16:9'
              )}
            </div>
          </div>
          <div className="wz-fields" style={{ gridTemplateColumns: '1fr' }}>
            <Field label="URL poster dọc (9:16)">
              <input
                type="url"
                value={data.poster_mobile_url}
                placeholder="https://…"
                onChange={(e) => setData({ ...data, poster_mobile_url: e.target.value })}
              />
            </Field>
            <Field label="URL poster ngang (16:9, tùy chọn)">
              <input
                type="url"
                value={data.poster_desktop_url}
                placeholder="https://…"
                onChange={(e) => setData({ ...data, poster_desktop_url: e.target.value })}
              />
            </Field>
            {!isUrl(data.poster_mobile_url) || !isUrl(data.poster_desktop_url) ? (
              <p role="alert" className="admin-error">
                URL poster phải bắt đầu bằng http:// hoặc https://
              </p>
            ) : (
              <p className="wz-soft">Thiếu poster ngang thì trang web dùng poster dọc làm nền mờ.</p>
            )}
          </div>
        </Panel>
      </div>
    </WizardShell>
  )
}

function EventReviewStep({ event, goStep }: { event: EventDetail; goStep: (n: number) => void }) {
  const navigate = useNavigate(),
    client = useQueryClient(),
    layouts = useEventLayouts(event),
    assignments = useZoneAssignments(event)
  const [confirm, setConfirm] = useState(false)
  const shows = activeShowtimes(event)
  const checks = eventChecklist({ event, layouts: layouts.data ?? {}, assignments: assignments.data ?? null })
  const { ok, total, canPublish } = readinessSummary(checks)
  const ordered = !!event.seat_layout_id
  const draft = event.status === 'DRAFT'
  const publish = useMutation({
    mutationFn: () => publishEvent(event.id!),
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success('Đã công bố sự kiện')
      navigate('/admin/events')
    },
  })
  const first = shows
    .map((s) => s.sale_opens_at)
    .filter((v): v is string => !!v)
    .sort()[0]
  const selectedLayout = event.seat_layout_id ? layouts.data?.[event.seat_layout_id] : undefined
  return (
    <WizardShell
      title="Xem lại & công bố"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC ${ordered ? '5/5' : '4/4'}`}
      steps={stepItems(stepLabels(event), ordered ? 4 : 3)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <LightButton back onClick={() => goStep(ordered ? 4 : 3)}>
          Quay lại
        </LightButton>
      }
    >
      <div className="wz-grid wz-grid-wide-side">
        <div className="wz-stack">
          <Panel className="wz-panel">
            <div className="flex justify-between gap-3">
              <h2>Thông tin</h2>
              <button className="wz-link" onClick={() => goStep(ordered ? 3 : 1)}>
                Sửa →
              </button>
            </div>
            <div className="mt-4 flex gap-4">
              {event.poster_mobile_url && (
                <img src={event.poster_mobile_url} alt="" className="h-28 w-20 rounded-xl object-cover" />
              )}
              <div className="min-w-0">
                <p className="text-2xl">{event.title}</p>
                <div className="my-2 flex flex-wrap gap-2">
                  {event.category && (
                    <span className="wz-chip" data-tone="agent">
                      {categories[event.category]}
                    </span>
                  )}
                  <span className="wz-chip">Tối đa {event.max_tickets_per_order ?? 6} vé/đơn</span>
                </div>
                <p className="text-sm text-ink-secondary">
                  {[event.league, event.round].filter(Boolean).join(' · ')} {event.description}
                </p>
              </div>
            </div>
          </Panel>
          <Panel className="wz-panel">
            <div className="flex justify-between gap-3">
              <h2>{shows.length} suất diễn</h2>
              <button className="wz-link" onClick={() => goStep(ordered ? 4 : 2)}>
                Sửa →
              </button>
            </div>
            <ul className="event-review-showtimes mt-3 divide-y">
              {shows.map((s) => {
                const p = vnParts(s.starts_at),
                  e = vnParts(s.ends_at),
                  o = vnParts(s.sale_opens_at),
                  w = s.venue
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 text-sm">
                    <span className="wz-mono w-24">
                      {p?.weekday} {p?.day}/{p?.month}
                    </span>
                    <strong className="font-medium">
                      {p?.time}–{e?.time}
                    </strong>
                    <span className="min-w-0 flex-1 text-ink-secondary">{w ? `${w.name}` : 'Sân'}</span>
                    <span className="wz-mono text-ink-tertiary">
                      Mở bán {o ? `${o.day}/${o.month} ${o.time}` : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>
          <Panel className="wz-panel">
            <div className="flex justify-between gap-3">
              <h2>Giá theo khu</h2>
              <button className="wz-link" onClick={() => goStep(ordered ? 2 : 3)}>
                Sửa →
              </button>
            </div>
            {selectedLayout && (
              <ReviewSeatMap event={event} layout={selectedLayout} assignments={assignments.data ?? {}} />
            )}
          </Panel>
        </div>
        <Panel className="wz-panel wz-sticky">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2>Sẵn sàng công bố</h2>
            <span className="wz-chip" data-tone={canPublish ? 'success' : 'warning'}>
              {ok}/{total} · sẵn sàng
            </span>
          </div>
          {checks.map((c) => (
            <ChecklistRow
              key={c.id}
              status={c.status}
              title={c.title}
              hint={c.hint}
              action={
                c.status !== 'ok' && c.step ? (
                  <button
                    type="button"
                    onClick={() =>
                      goStep(ordered ? (({ 1: 3, 2: 4, 3: 2 } as Record<number, number>)[c.step!] ?? 1) : c.step!)
                    }
                  >
                    {c.status === 'warn' ? 'Thêm' : 'Sửa'}
                  </button>
                ) : undefined
              }
            />
          ))}
          {draft ? (
            <>
              <AdminAction
                className="mt-4 w-full"
                disabled={!canPublish || publish.isPending}
                onClick={() => {
                  publish.reset()
                  setConfirm(true)
                }}
              >
                Công bố sự kiện
              </AdminAction>
              <div className="wz-note mt-4">
                <p className="admin-caption mb-1">Sau khi công bố</p>
                <p>· Sự kiện hiện trên app ngay, trạng thái suất là “Sắp mở bán”.</p>
                {first && <p>· Suất đầu tự mở bán lúc {dateText(first)}.</p>}
                <p>· Giá bị khóa khi suất đầu tiên mở bán.</p>
              </div>
            </>
          ) : (
            <p className="wz-note mt-4">
              Sự kiện đã {event.status === 'PUBLISHED' ? 'công bố' : 'kết thúc hoặc hủy'}.{' '}
              <Link className="wz-link" to={`/admin/events/${event.id}`}>
                Mở trang quản lý
              </Link>
            </p>
          )}
        </Panel>
      </div>
      {confirm && (
        <ConfirmDialog
          open
          title="Công bố sự kiện?"
          description="Sự kiện sẽ hiển thị tới người mua. Kiểm tra lịch diễn, sơ đồ và giá theo khu trước khi công bố."
          requireReason={false}
          label="Công bố"
          pending={publish.isPending}
          error={publish.error}
          onClose={() => setConfirm(false)}
          onConfirm={() => publish.mutate()}
        />
      )}
    </WizardShell>
  )
}

function ReviewSeatMap({
  event,
  layout,
  assignments,
}: {
  event: EventDetail
  layout: SeatLayoutOverview
  assignments: Record<string, string>
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [selectedZone, setSelectedZone] = useState<string>()
  const detail = useLayoutSvg(layout.id ?? '')
  const overview = useQuery({
    queryKey: ['venue-overview', layout.overview_id],
    queryFn: ({ signal }) => getVenueOverview(layout.overview_id!, { signal }),
    enabled: !!layout.overview_id,
  })
  const svg = useMemo(() => {
    if (!detail.data || !overview.data?.svg_content) return detail.data
    const merged = mergeLayers(overview.data.svg_content, [detail.data], `review-${id}`)
    return merged.skipped ? detail.data : merged.svg || detail.data
  }, [detail.data, overview.data?.svg_content, id])
  const rows = layout.zones.map((zone) => ({
    ...zone,
    name: event.zone_prices?.find((row) => row.zone_id === zone.id)?.display_name ?? (zone.label || zone.code),
    tier: event.price_tiers?.find((tier) => tier.id === assignments[zone.id]),
  }))
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm text-ink-secondary">
        {activeShowtimes(event)[0]?.venue?.name ?? 'Sân đã chọn'} · {layout.name} · v{layout.version}
      </p>
      <ErrorNotice error={overview.error || detail.error} />
      {(detail.isFetching || overview.isFetching) && <p role="status">Đang tải sơ đồ…</p>}
      {svg && (
        <div className="pricing-zone-map h-[clamp(420px,70vh,900px)] overflow-hidden rounded-xl bg-canvas">
          <SeatMapView
            svg={svg}
            fitToCanvas
            zones={Object.fromEntries(
              rows.map((row) => [
                row.code,
                { tier: row.tier ? 1 : undefined, color: row.tier?.color, soldOut: !row.tier },
              ]),
            )}
            selected={new Set()}
            selectedZones={new Set(selectedZone ? [selectedZone] : [])}
            onZoneClick={setSelectedZone}
            tooltip={(code) => {
              const row = rows.find((zone) => zone.code === code)
              return row ? `${row.name} · ${row.tier ? formatVnd(row.tier.price) : 'Chưa có giá'}` : null
            }}
          />
        </div>
      )}
      <ul aria-label="Chú giải giá vé" className="flex flex-wrap gap-x-8 gap-y-3 py-3 text-base">
        {event.price_tiers?.map((tier) => (
          <li key={tier.id} className="flex min-w-0 items-center gap-2">
            <span className="size-4 shrink-0" style={{ background: tier.color ?? 'var(--vg-tier-1)' }} aria-hidden />
            <span className="font-bold break-words">{tier.name}:</span>
            <span className="font-medium whitespace-nowrap">{formatVnd(tier.price).replace(/\s*₫/, 'đ')}</span>
          </li>
        ))}
        {rows.some((row) => !row.tier) && (
          <li className="flex items-center gap-2">
            <span className="size-4 shrink-0" style={{ background: 'var(--vg-map-sold)' }} aria-hidden />
            <span>Chưa có giá</span>
          </li>
        )}
      </ul>
    </div>
  )
}
