import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeft, ImageOff, Lock, Minus, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  addSkuPrice,
  useGetAdminEvent,
  updateEvent,
  putPriceTiers,
  publishEvent,
  cancelEvent,
  cancelShowtime,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { EventDetail, EventInput, Showtime, SkuPrice } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, StateBadge, ConfirmDialog, Field, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { FormDialog } from '@/design/admin/FormDialog'
import { stateLabel } from '@/design/admin/labels'
import { dateText } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { formatVnd } from '@/lib/money'
import { categories, toUtc, vnParts } from './catalog'
import ShowtimeForm from './ShowtimeForm'
import { toast } from 'sonner'

const MATCH_FIELDS = [
  ['home_team', 'Đội nhà'],
  ['away_team', 'Đội khách'],
  ['league', 'Giải đấu'],
  ['round', 'Vòng đấu'],
] as const

export default function AdminEventDetailPage() {
  const { eventId = '' } = useParams(),
    query = useGetAdminEvent(eventId)
  // Sự kiện nháp được hoàn thiện bằng wizard; trang này dành cho sự kiện đã công bố.
  if (query.data?.status === 'DRAFT') return <Navigate to={`/admin/events/${eventId}/setup`} replace />
  return <QueryState query={query}>{query.data && <EventEditor key={eventId} event={query.data} />}</QueryState>
}

// seat_layout_id do wizard quản lý, trang sửa không gửi lại.
function initialData(
  event: EventDetail,
): Required<Omit<EventInput, 'seat_layout_id' | 'home_team' | 'away_team' | 'league' | 'round'>> &
  Pick<EventInput, 'home_team' | 'away_team' | 'league' | 'round'> {
  return {
    title: event.title ?? '',
    category: event.category ?? 'CONCERT',
    description: event.description ?? '',
    poster_mobile_url: event.poster_mobile_url ?? '',
    poster_desktop_url: event.poster_desktop_url ?? '',
    max_tickets_per_order: event.max_tickets_per_order ?? 6,
    home_team: event.home_team ?? undefined,
    away_team: event.away_team ?? undefined,
    league: event.league ?? undefined,
    round: event.round ?? undefined,
  }
}

/**
 * Sửa sự kiện đã công bố. Mọi thông tin sửa ngay trên trang và lưu một lần bằng nút “Lưu thay đổi”;
 * chỉ thêm/sửa suất và các thao tác huỷ mới mở hộp thoại.
 */
function EventEditor({ event }: { event: EventDetail }) {
  const id = event.id!,
    client = useQueryClient(),
    original = initialData(event),
    [data, setData] = useState(original)
  const [tierEdits, setTierEdits] = useState<Record<string, number>>({}),
    [priceTarget, setPriceTarget] = useState<{ id: string; name: string; price: number } | null>(null),
    [editor, setEditor] = useState<Showtime | 'new' | null>(null),
    [action, setAction] = useState<{ kind: 'publish' | 'cancel' | 'showtime'; show?: Showtime } | null>(null),
    [infoSaved, setInfoSaved] = useState(false)
  const [viewedAt] = useState(() => Date.now())
  const set = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => setData({ ...data, [key]: value })
  const tiers = (event.price_tiers ?? []).map((t, i) => ({ ...t, price: tierEdits[t.id ?? i] ?? t.price }))
  const terminal = event.status === 'CANCELLED'
  const priceLocked =
    terminal ||
    event.showtimes?.some((s) => s.status !== 'CANCELLED' && s.sale_opens_at && Date.parse(s.sale_opens_at) <= viewedAt)
  const infoDirty = JSON.stringify(data) !== JSON.stringify(original),
    dirty = infoDirty || Object.keys(tierEdits).length > 0
  const save = useMutation({
    mutationFn: async () => {
      setInfoSaved(false)
      if (infoDirty)
        await updateEvent(id, {
          ...data,
          title: data.title.trim(),
          poster_mobile_url: data.poster_mobile_url || undefined,
          poster_desktop_url: data.poster_desktop_url || undefined,
        })
      setInfoSaved(true)
      if (Object.keys(tierEdits).length) await putPriceTiers(id, tiers)
    },
    onSuccess: async () => {
      toast.success('Đã lưu thay đổi')
      setInfoSaved(false)
      setTierEdits({})
      await client.invalidateQueries()
    },
  })
  const change = useMutation({
    mutationFn: async (reason: string) => {
      if (action?.kind === 'publish') await publishEvent(id)
      else if (action?.kind === 'showtime') await cancelShowtime(action.show!.id!, { reason })
      else await cancelEvent(id, { reason })
    },
    onSuccess: async () => {
      setAction(null)
      await client.invalidateQueries()
      toast.success('Đã cập nhật trạng thái')
    },
  })
  const begin = (a: NonNullable<typeof action>) => {
    change.reset()
    setAction(a)
  }
  const max = data.max_tickets_per_order
  return (
    <AdminPage
      title={event.title ?? 'Sự kiện'}
      caption={
        <span className="admin-page-crumbs">
          <Link to="/admin/events" className="admin-backlink">
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            Sự kiện
          </Link>
          <StateBadge value={event.status} />
        </span>
      }
      actions={
        <>
          {dirty && !save.isPending && (
            <Button
              type="button"
              variant="outline"
              className="wz-light"
              onClick={() => {
                setData(original)
                setTierEdits({})
              }}
            >
              Bỏ thay đổi
            </Button>
          )}
          <AdminAction type="submit" form="admin-event-editor" disabled={terminal || !dirty || save.isPending}>
            {save.isPending ? 'Đang lưu…' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
          </AdminAction>
        </>
      }
    >
      <form
        id="admin-event-editor"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      />
      <fieldset form="admin-event-editor" disabled={terminal || save.isPending} className="admin-event-layout">
        <div className="admin-event-main">
          <Panel>
            <h2 className="mb-5">Thông tin sự kiện</h2>
            <div className="admin-event-info">
              <Field label="Tên sự kiện">
                <input
                  form="admin-event-editor"
                  required
                  maxLength={200}
                  value={data.title}
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <div className="admin-event-row">
                <Field label="Thể loại">
                  <select
                    form="admin-event-editor"
                    value={data.category}
                    disabled={!!event.seat_layout_id}
                    onChange={(e) => set('category', e.target.value as EventInput['category'] & string)}
                  >
                    {Object.entries(categories).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Mô tả">
                <textarea
                  form="admin-event-editor"
                  rows={4}
                  value={data.description}
                  placeholder="Giới thiệu ngắn hiển thị ở trang sự kiện"
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              {data.category === 'FOOTBALL' && (
                <div className="admin-event-match" role="group" aria-labelledby="match-label">
                  <p id="match-label" className="admin-side-label">
                    Thông tin trận đấu
                  </p>
                  {MATCH_FIELDS.map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        form="admin-event-editor"
                        value={data[key] ?? ''}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          <ShowtimeList
            event={event}
            viewedAt={viewedAt}
            terminal={terminal}
            onAdd={() => setEditor('new')}
            onEdit={setEditor}
            onCancel={(s) => begin({ kind: 'showtime', show: s })}
          />
          <Panel>
            <div className="admin-panel-head">
              <h2>Ảnh bìa</h2>
              <span className="text-xs text-ink-tertiary">Dán đường dẫn ảnh https://</span>
            </div>
            <div className="admin-posters">
              <PosterField
                label="Ảnh dọc · điện thoại"
                ratio="3 / 4"
                value={data.poster_mobile_url}
                onChange={(v) => set('poster_mobile_url', v)}
              />
              <PosterField
                label="Ảnh ngang · máy tính"
                ratio="16 / 9"
                value={data.poster_desktop_url}
                onChange={(v) => set('poster_desktop_url', v)}
              />
            </div>
          </Panel>

          <ErrorNotice error={save.error} />
          {save.isError && infoSaved && (
            <p className="admin-notice">Thông tin sự kiện đã lưu. Bảng giá chưa được cập nhật.</p>
          )}
        </div>
        <aside className="admin-event-side">
          <Panel>
            <div className="admin-panel-head">
              <h2>Bán vé</h2>
              {!priceLocked && (
                <Link className="wz-link text-sm" to={`/admin/events/${id}/setup?step=${event.seat_layout_id ? 2 : 3}`}>
                  Gán khu →
                </Link>
              )}
            </div>
            <p className="admin-side-label">Giá theo hạng</p>
            {priceLocked ? (
              <ul className="admin-price-list">
                {tiers.map((t, i) => (
                  <li key={t.id ?? i} className="flex-col items-stretch gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t.name}</span>
                      <span className="flex items-center gap-2">
                        <strong>{formatVnd(t.price ?? 0)}</strong>
                        {!terminal && t.id && (
                          <button
                            type="button"
                            className="wz-link text-xs"
                            onClick={() => setPriceTarget({ id: t.id!, name: t.name, price: t.price })}
                          >
                            Đổi giá
                          </button>
                        )}
                      </span>
                    </div>
                    <SkuPriceHistory prices={t.prices} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <div key={t.id ?? i} className="space-y-1">
                    <label className="admin-price-row">
                      <span>{t.name}</span>
                      <span className="admin-price-input">
                        <input
                          type="number"
                          form="admin-event-editor"
                          required
                          min={0}
                          step={1000}
                          aria-label={`Giá ${t.name}`}
                          value={t.price}
                          onChange={(e) => setTierEdits({ ...tierEdits, [t.id ?? i]: Number(e.target.value) })}
                        />
                        <span>₫</span>
                      </span>
                    </label>
                    <SkuPriceHistory prices={t.prices} />
                  </div>
                ))}
              </div>
            )}
            {!tiers.length && (
              <Link className="wz-link" to={`/admin/events/${id}/setup?step=${event.seat_layout_id ? 2 : 3}`}>
                Thêm hạng giá →
              </Link>
            )}
            {priceLocked && (
              <p className="admin-lock-note">
                <Lock size={14} aria-hidden />
                Hạng giá đã khóa vì có suất đang bán; có thể thêm mốc giá mới theo lịch.
              </p>
            )}
            {priceTarget && <SkuPriceDialog eventId={id} target={priceTarget} onClose={() => setPriceTarget(null)} />}
            <hr className="admin-side-rule" />
            <div className="admin-stepper-row">
              <span>
                <span id="max-label">Tối đa vé mỗi đơn</span>
                <small>Từ 1 đến 20 vé</small>
              </span>
              <div className="admin-stepper" role="group" aria-labelledby="max-label">
                <button
                  type="button"
                  aria-label="Bớt 1 vé"
                  disabled={max <= 1}
                  onClick={() => set('max_tickets_per_order', max - 1)}
                >
                  <Minus size={14} aria-hidden />
                </button>
                <output aria-live="polite">{max}</output>
                <button
                  type="button"
                  aria-label="Thêm 1 vé"
                  disabled={max >= 20}
                  onClick={() => set('max_tickets_per_order', max + 1)}
                >
                  <Plus size={14} aria-hidden />
                </button>
              </div>
            </div>
          </Panel>
          {event.status === 'DRAFT' && (
            <AdminAction onClick={() => begin({ kind: 'publish' })}>Công bố sự kiện</AdminAction>
          )}
          {!terminal && (
            <div className="admin-danger-zone">
              <div>
                <strong>Hủy sự kiện</strong>
                <span>Dừng bán mọi suất. Không hoàn tác được.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="wz-light admin-danger-light"
                disabled={priceLocked}
                onClick={() => begin({ kind: 'cancel' })}
              >
                Hủy sự kiện
              </Button>
            </div>
          )}
        </aside>
      </fieldset>
      <div className="admin-page-end" aria-hidden />
      {editor && (
        <ShowtimeForm
          eventId={id}
          event={event}
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
      {action && (
        <ConfirmDialog
          key={`${action.kind}-${action.show?.id}`}
          open
          title={
            action.kind === 'publish'
              ? 'Công bố sự kiện?'
              : action.kind === 'showtime'
                ? `Hủy suất ${dateText(action.show?.starts_at)}?`
                : 'Hủy toàn bộ sự kiện?'
          }
          description={
            action.kind === 'publish'
              ? 'Sự kiện sẽ hiển thị tới người mua. Kiểm tra lịch diễn, sơ đồ và giá theo khu trước khi công bố.'
              : 'Thao tác không thể hoàn tác. Hệ thống sẽ kiểm tra trạng thái suất và các đơn bị ảnh hưởng trước khi hủy.'
          }
          requireReason={action.kind !== 'publish'}
          danger={action.kind !== 'publish'}
          cancelLabel={action.kind === 'showtime' ? 'Giữ suất' : 'Quay lại'}
          facts={
            action.kind === 'showtime'
              ? [
                  { label: 'Trạng thái', value: `${stateLabel(action.show?.status)} → Đã huỷ` },
                  { label: 'Mở bán dự kiến', value: dateText(action.show?.sale_opens_at) },
                  { label: 'Suất đã mở bán?', value: 'Không hủy được nữa' },
                ]
              : undefined
          }
          pending={change.isPending}
          error={change.error}
          label={action.kind === 'publish' ? 'Công bố' : action.kind === 'showtime' ? 'Hủy suất' : 'Hủy sự kiện'}
          onClose={() => setAction(null)}
          onConfirm={(reason) => change.mutate(reason)}
        />
      )}
    </AdminPage>
  )
}

/** Ô ảnh bìa: xem trước ngay theo đúng tỉ lệ, dán đường dẫn bên dưới. */
function PosterField({
  label,
  ratio,
  value,
  onChange,
}: {
  label: string
  ratio: string
  value: string
  onChange: (value: string) => void
}) {
  const [broken, setBroken] = useState<string | null>(null)
  let preview: ReactNode = (
    <span className="admin-poster-empty">
      <ImageOff size={20} aria-hidden />
      Chưa có ảnh
    </span>
  )
  if (value && broken !== value)
    preview = <img src={value} alt={`Xem trước ${label.toLowerCase()}`} onError={() => setBroken(value)} />
  else if (value)
    preview = (
      <span className="admin-poster-empty">
        <ImageOff size={20} aria-hidden />
        Không tải được ảnh
      </span>
    )
  return (
    <div className="admin-poster">
      <div className="admin-poster-frame" style={{ aspectRatio: ratio }}>
        {preview}
      </div>
      <Field label={label}>
        <input
          form="admin-event-editor"
          type="url"
          pattern="https?://.+"
          placeholder="https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    </div>
  )
}

function ShowtimeList({
  event,
  viewedAt,
  terminal,
  onAdd,
  onEdit,
  onCancel,
}: {
  event: EventDetail
  viewedAt: number
  terminal: boolean
  onAdd: () => void
  onEdit: (s: Showtime) => void
  onCancel: (s: Showtime) => void
}) {
  const shows = [...(event.showtimes ?? [])].sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  const live = shows.filter((s) => s.status !== 'CANCELLED')
  return (
    <Panel>
      <div className="admin-panel-head">
        <h2 id="showtimes">
          Suất diễn <span className="admin-count">{live.length}</span>
        </h2>
        <Button type="button" className="admin-small-button" disabled={terminal} onClick={onAdd}>
          <Plus size={16} aria-hidden />
          Thêm suất
        </Button>
      </div>
      {!shows.length ? (
        <p className="admin-notice">Thêm suất, cấu hình giá theo khu để công bố sự kiện.</p>
      ) : (
        <ul className="admin-show-list" aria-label="Suất diễn">
          {shows.map((s) => {
            const st = vnParts(s.starts_at),
              en = vnParts(s.ends_at),
              op = vnParts(s.sale_opens_at),
              cl = vnParts(s.sale_closes_at)
            const a = Date.parse(s.sale_opens_at ?? ''),
              c = Date.parse(s.sale_closes_at ?? '')
            const progress = a && c && c > a ? Math.max(0, Math.min(1, (viewedAt - a) / (c - a))) : 0
            const locked = terminal || s.status === 'CANCELLED' || s.status === 'FINISHED'
            return (
              <li key={s.id} className="admin-show-row" data-cancelled={s.status === 'CANCELLED' || undefined}>
                <div className="admin-show-date" aria-hidden>
                  <small>{st?.weekday}</small>
                  <strong>{st?.day}</strong>
                  <small>Th{st?.month}</small>
                </div>
                <div className="admin-show-main">
                  <strong>
                    {st?.time}
                    {en && ` – ${en.time}`}
                    <span className="sr-only">
                      {' '}
                      {st?.weekday} {st?.day}/{st?.month}
                    </span>
                  </strong>
                  <span>{s.venue?.name ?? event.venue?.name ?? 'Chưa chọn sân'}</span>
                </div>
                <div className="admin-show-sale">
                  <span>
                    Bán {op ? `${op.day}/${op.month} ${op.time}` : '—'} →{' '}
                    {cl ? `${cl.day}/${cl.month} ${cl.time}` : '—'}
                  </span>
                  <i aria-hidden>
                    <b style={{ width: `${progress * 100}%` }} />
                  </i>
                </div>
                <StateBadge value={s.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="admin-more" aria-label={`Thao tác suất ${dateText(s.starts_at)}`}>
                      <img src={more} alt="" width={18} height={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={locked} onClick={() => onEdit(s)}>
                      Sửa suất diễn
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to={`/admin/showtimes/${s.id}/seats?layoutId=${s.seat_layout_id ?? ''}&eventId=${event.id}`}
                      >
                        Khóa / mở ghế
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={locked} variant="destructive" onClick={() => onCancel(s)}>
                      Hủy suất
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function SkuPriceHistory({ prices }: { prices?: SkuPrice[] }) {
  if (!prices?.length) return null
  return (
    <ul className="space-y-0.5 pl-2 text-xs text-ink-tertiary" aria-label="Lịch sử giá">
      {prices.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {formatVnd(p.price)} · từ {dateText(p.effective_from)}
          </span>
          {p.reason && <span className="truncate">{p.reason}</span>}
        </li>
      ))}
    </ul>
  )
}

function SkuPriceDialog({
  eventId,
  target,
  onClose,
}: {
  eventId: string
  target: { id: string; name: string; price: number }
  onClose: () => void
}) {
  const client = useQueryClient()
  const [price, setPrice] = useState(target.price)
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [reason, setReason] = useState('')
  const save = useMutation({
    mutationFn: () =>
      addSkuPrice(eventId, target.id, {
        price,
        effective_from: effectiveFrom ? (toUtc(effectiveFrom) ?? null) : null,
        reason: reason.trim() || null,
      }),
    onSuccess: async () => {
      toast.success(`Đã cập nhật giá ${target.name}`)
      await client.invalidateQueries()
      onClose()
    },
  })
  return (
    <FormDialog title={`Đổi giá · ${target.name}`} pending={save.isPending} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Field label="Giá mới (VND) *">
          <input
            type="number"
            required
            min={0}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </Field>
        <Field label="Hiệu lực từ (để trống = ngay lập tức)">
          <input type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>
        <Field label="Lý do điều chỉnh">
          <input
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Early bird kết thúc"
          />
        </Field>
        <ErrorNotice error={save.error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <AdminAction type="submit" disabled={save.isPending || price < 0}>
            {save.isPending ? 'Đang lưu…' : 'Lưu mốc giá'}
          </AdminAction>
        </div>
      </form>
    </FormDialog>
  )
}
