import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import {
  createEvent,
  publishEvent,
  updateEvent,
  useGetAdminEvent,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { EventCreateInput, EventDetail } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { dateText } from '@/design/admin/data'
import { ChecklistRow, ChoiceCard, ChoiceGroup, LightButton, Segmented } from '@/design/admin/wizard'
import { formatVnd } from '@/lib/money'
import { toast } from 'sonner'
import { categories, useVenueDirectory, vnParts } from './catalog'
import { activeShowtimes, stepLabels, useEventLayouts, useZoneAssignments } from './eventSetup'
import EventPricing from './EventPricing'
import EventShowtimesStep from './EventShowtimesStep'
import { eventChecklist, readinessSummary } from './readiness'
import { stepItems, WizardShell } from './WizardShell'

export default function EventWizardPage() {
  const { eventId } = useParams(),
    [params] = useSearchParams(),
    navigate = useNavigate(),
    venueHint = params.get('venueId')
  const query = useGetAdminEvent(eventId ?? '', { query: { enabled: !!eventId } })
  const step = Math.min(4, Math.max(1, Number(params.get('step')) || 2))
  const goStep = (n: number, id = eventId) =>
    navigate(`/admin/events/${id}/setup?step=${n}${venueHint ? `&venueId=${venueHint}` : ''}`)
  if (!eventId) return <EventInfoStep goStep={goStep} />
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
  THEATER: 'Kịch, nhạc kịch',
  OTHER: 'Hội chợ, stand-up…',
}
const ages = [
  { value: 0, label: 'Mọi lứa tuổi' },
  { value: 13, label: '13+' },
  { value: 16, label: '16+' },
  { value: 18, label: '18+' },
]
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
    age_limit: event?.age_limit ?? 0,
    max_tickets_per_order: event?.max_tickets_per_order ?? 6,
    attributes: event?.attributes,
  })
  const valid = !!data.title.trim() && isUrl(data.poster_mobile_url) && isUrl(data.poster_desktop_url)
  const save = useMutation({
    mutationFn: async (then: 'next' | 'list') => {
      const body: EventCreateInput = {
        ...data,
        title: data.title.trim(),
        poster_mobile_url: data.poster_mobile_url || undefined,
        poster_desktop_url: data.poster_desktop_url || undefined,
        attributes: data.category === 'FOOTBALL' ? data.attributes : event ? {} : undefined,
      }
      const saved = event?.id ? await updateEvent(event.id, body) : await createEvent(body)
      return { id: saved.id ?? event?.id, then }
    },
    onSuccess: async ({ id, then }) => {
      await client.invalidateQueries()
      toast.success(event ? 'Đã lưu thông tin' : 'Đã tạo sự kiện nháp')
      if (then === 'list') navigate('/admin/events')
      else goStep(2, id)
    },
  })
  const description = data.description ?? ''
  const qty = data.max_tickets_per_order ?? 6
  return (
    <WizardShell
      title={event ? 'Thông tin' : 'Tạo sự kiện'}
      caption={`// ${event ? event.title?.toUpperCase() : 'SỰ KIỆN MỚI'} · BƯỚC 1/4`}
      steps={stepItems(stepLabels(event), 0)}
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
            <p className="admin-caption">Thể loại *</p>
            <ChoiceGroup label="Thể loại" className="!mt-2">
              {(Object.keys(categories) as (keyof typeof categories)[]).map((c) => (
                <ChoiceCard
                  key={c}
                  title={categories[c]}
                  hint={categoryHints[c]}
                  selected={data.category === c}
                  onSelect={() => setData({ ...data, category: c })}
                />
              ))}
            </ChoiceGroup>
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
                    <input
                      value={String(data.attributes?.[key] ?? '')}
                      onChange={(e) => setData({ ...data, attributes: { ...data.attributes, [key]: e.target.value } })}
                    />
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
              <div>
                <p className="admin-caption mb-2">Độ tuổi tối thiểu</p>
                <Segmented
                  variant="pills"
                  label="Độ tuổi tối thiểu"
                  options={ages}
                  value={data.age_limit ?? 0}
                  onChange={(age_limit) => setData({ ...data, age_limit })}
                />
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
    assignments = useZoneAssignments(event),
    venues = useVenueDirectory()
  const [confirm, setConfirm] = useState(false)
  const shows = activeShowtimes(event)
  const checks = eventChecklist({ event, layouts: layouts.data ?? {}, assignments: assignments.data ?? null })
  const { ok, total, canPublish } = readinessSummary(checks)
  const draft = event.status === 'DRAFT'
  const publish = useMutation({
    mutationFn: () => publishEvent(event.id!),
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success('Đã công bố sự kiện')
      navigate('/admin/events')
    },
  })
  const zones = [
    ...new Map(Object.values(layouts.data ?? {}).flatMap((l) => l.zones.map((z) => [z.id, z] as const))).values(),
  ]
  const hallOf = (id?: string) =>
    venues.data?.flatMap((v) => (v.halls ?? []).map((h) => ({ v, h }))).find((x) => x.h.id === id)
  const first = shows
    .map((s) => s.sale_opens_at)
    .filter((v): v is string => !!v)
    .sort()[0]
  const fb = event.attributes
  return (
    <WizardShell
      title="Xem lại & công bố"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC 4/4`}
      steps={stepItems(stepLabels(event), 3)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <LightButton back onClick={() => goStep(3)}>
          Quay lại
        </LightButton>
      }
    >
      <div className="wz-grid wz-grid-wide-side">
        <div className="wz-stack">
          <Panel className="wz-panel">
            <div className="flex justify-between gap-3">
              <h2>Thông tin</h2>
              <button className="wz-link" onClick={() => goStep(1)}>
                Sửa ở bước 1 →
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
                  <span className="wz-chip">{event.age_limit ? `${event.age_limit}+` : 'Mọi lứa tuổi'}</span>
                  <span className="wz-chip">Tối đa {event.max_tickets_per_order ?? 6} vé/đơn</span>
                </div>
                <p className="text-sm text-ink-secondary">
                  {[fb?.league, fb?.round].filter(Boolean).join(' · ')} {event.description}
                </p>
              </div>
            </div>
          </Panel>
          <Panel className="wz-panel">
            <div className="flex justify-between gap-3">
              <h2>{shows.length} suất diễn</h2>
              <button className="wz-link" onClick={() => goStep(2)}>
                Sửa ở bước 2 →
              </button>
            </div>
            <ul className="mt-3 divide-y">
              {shows.map((s) => {
                const p = vnParts(s.starts_at),
                  e = vnParts(s.ends_at),
                  o = vnParts(s.sale_opens_at),
                  w = hallOf(s.hall_id)
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 text-sm">
                    <span className="wz-mono w-24">
                      {p?.weekday} {p?.day}/{p?.month}
                    </span>
                    <strong className="font-medium">
                      {p?.time}–{e?.time}
                    </strong>
                    <span className="min-w-0 flex-1 text-ink-secondary">
                      {w ? `${w.v.name} · ${w.h.name}` : 'Hall'}
                    </span>
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
              <button className="wz-link" onClick={() => goStep(3)}>
                Sửa ở bước 3 →
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {event.price_tiers?.map((t) => {
                const mine = assignments.data ? zones.filter((z) => assignments.data![z.id] === t.id) : []
                return (
                  <div key={t.id} className="rounded-xl bg-canvas p-4">
                    <p className="text-xs text-ink-secondary">{t.name}</p>
                    <p className="wz-money">{formatVnd(t.price)}</p>
                    <p className="admin-caption">
                      {assignments.data
                        ? `${mine.length} khu · ${mine.reduce((s, z) => s + z.capacity, 0).toLocaleString('vi-VN')} ghế`
                        : '—'}
                    </p>
                  </div>
                )
              })}
              {!event.price_tiers?.length && <p className="admin-notice sm:col-span-3">Chưa có hạng giá.</p>}
            </div>
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
                  <button type="button" onClick={() => goStep(c.step!)}>
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
