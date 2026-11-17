import { useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ArrowLeft, ImageOff, Lock, Minus, Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useGetAdminEvent,
  updateEvent,
  putPriceTiers,
  publishEvent,
  cancelEvent,
  cancelShowtime,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { EventDetail, EventInput, Showtime } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, StateBadge, ConfirmDialog, Field, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { stateLabel } from '@/design/admin/labels'
import { dateText } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { formatVnd } from '@/lib/money'
import { categories, vnParts } from './catalog'
import ShowtimeForm from './ShowtimeForm'
import { toast } from 'sonner'

const MATCH_FIELDS = [
  ['home_team', 'Đội nhà'],
  ['away_team', 'Đội khách'],
  ['league', 'Giải đấu'],
  ['round', 'Vòng đấu'],
] as const
const AGES = [0, 13, 16, 18]

export default function AdminEventDetailPage() {
  const { eventId = '' } = useParams(),
    query = useGetAdminEvent(eventId)
  // Sự kiện nháp được hoàn thiện bằng wizard; trang này dành cho sự kiện đã công bố.
  if (query.data?.status === 'DRAFT') return <Navigate to={`/admin/events/${eventId}/setup`} replace />
  return <QueryState query={query}>{query.data && <EventEditor key={eventId} event={query.data} />}</QueryState>
}

function initialData(event: EventDetail): Required<Omit<EventInput, 'attributes'>> & Pick<EventInput, 'attributes'> {
  return {
    title: event.title ?? '',
    category: event.category ?? 'OTHER',
    description: event.description ?? '',
    poster_mobile_url: event.poster_mobile_url ?? '',
    poster_desktop_url: event.poster_desktop_url ?? '',
    age_limit: event.age_limit ?? 0,
    max_tickets_per_order: event.max_tickets_per_order ?? 6,
    attributes: event.attributes,
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
    [editor, setEditor] = useState<Showtime | 'new' | null>(null),
    [action, setAction] = useState<{ kind: 'publish' | 'cancel' | 'showtime'; show?: Showtime } | null>(null),
    [infoSaved, setInfoSaved] = useState(false)
  const [viewedAt] = useState(() => Date.now())
  const set = <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => setData({ ...data, [key]: value })
  const tiers = (event.price_tiers ?? []).map((t, i) => ({ ...t, price: tierEdits[t.id ?? i] ?? t.price }))
  const terminal = event.status === 'CANCELLED' || event.status === 'ENDED'
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
          <AdminAction secondary disabled={priceLocked} onClick={() => begin({ kind: 'cancel' })}>
            Hủy sự kiện
          </AdminAction>
          <AdminAction type="submit" form="admin-event-editor" disabled={terminal || save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
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
                    onChange={(e) => setData({ ...data, category: e.target.value as EventInput['category'] })}
                  >
                    {Object.entries(categories).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="admin-field">
                  <span id="age-label">Độ tuổi</span>
                  <div className="admin-chips" role="radiogroup" aria-labelledby="age-label">
                    {[...new Set([...AGES, data.age_limit])].map((age) => (
                      <button
                        key={age}
                        type="button"
                        role="radio"
                        aria-checked={data.age_limit === age}
                        onClick={() => set('age_limit', age)}
                      >
                        {age ? `${age}+` : 'Mọi tuổi'}
                      </button>
                    ))}
                  </div>
                </div>
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
                        value={String(data.attributes?.[key] ?? '')}
                        onChange={(e) => set('attributes', { ...data.attributes, [key]: e.target.value })}
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
                <Link className="wz-link text-sm" to={`/admin/events/${id}/setup?step=3`}>
                  Gán khu →
                </Link>
              )}
            </div>
            <p className="admin-side-label">Giá theo hạng</p>
            {priceLocked ? (
              <ul className="admin-price-list">
                {tiers.map((t, i) => (
                  <li key={t.id ?? i}>
                    <span>{t.name}</span>
                    <strong>{formatVnd(t.price ?? 0)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <Table label="Suất diễn" headings={['Bắt đầu', 'Layout / sân', 'Mở bán', 'Trạng thái', '']}>
                {event.showtimes.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs whitespace-nowrap">{dateText(s.starts_at)}</td>
                    <td className="text-xs">
                      {s.venue?.name ?? event.venue?.name ?? 'Phòng / sân'}
                      <p className="text-ink-tertiary">{s.seat_layout_id ? 'Đã gắn sơ đồ' : 'Chưa có sơ đồ'}</p>
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">{dateText(s.sale_opens_at)}</td>
                    <td>
                      <StateBadge value={s.status} />
                    </td>
                    <td aria-label={`Thao tác suất ${dateText(s.starts_at)}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="admin-more" aria-label={`Thao tác suất ${dateText(s.starts_at)}`}>
                            <img src={more} alt="" width={18} height={18} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={terminal || s.status === 'CANCELLED' || s.status === 'FINISHED'}
                            onClick={() => setEditor(s)}
                          >
                            Sửa suất diễn
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/admin/showtimes/${s.id}/seats?layoutId=${s.seat_layout_id ?? ''}&eventId=${id}`}
                            >
                              Khóa / mở ghế
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={terminal || s.status === 'CANCELLED' || s.status === 'FINISHED'}
                            variant="destructive"
                            onClick={() => begin({ kind: 'showtime', show: s })}
                          >
                            Hủy suất
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </div>
            )}
            {!tiers.length && (
              <Link className="wz-link" to={`/admin/events/${id}/setup?step=3`}>
                Thêm hạng giá →
              </Link>
            )}
            {priceLocked && (
              <p className="admin-lock-note">
                <Lock size={14} aria-hidden />
                Giá đã khóa vì có suất đã mở bán.
              </p>
            )}
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
        </div>
        <Panel>
          <div className="mb-4 flex justify-between gap-2">
            <h2>Giá theo khu</h2>
            <Link className="wz-link" to={`/admin/events/${id}/setup?step=${event.seat_layout_id ? 2 : 3}`}>
              Cấu hình giá →
            </Link>
          </div>
          <p className="mb-5 text-xs text-ink-tertiary">Giá áp cho mọi suất. Đơn vị VND, số nguyên.</p>
          <fieldset disabled={priceLocked || save.isPending} className="space-y-4">
            {tiers.map((t, i) => (
              <label key={t.id ?? i} className="admin-price-row">
                <span>{t.name}</span>
                <span className="admin-price-input">
                  <input
                    type="number"
                    form="admin-event-editor"
                    required
                    min={0}
                    step={1}
                    aria-label={`Giá ${t.name}`}
                    value={t.price}
                    onChange={(e) => setTierEdits({ ...tierEdits, [t.id ?? i]: Number(e.target.value) })}
                  />
                  <span>₫</span>
                </span>
              </label>
            ))}
          </fieldset>
          {!tiers.length && (
            <Link className="wz-link" to={`/admin/events/${id}/setup?step=${event.seat_layout_id ? 2 : 3}`}>
              Thêm hạng giá →
            </Link>
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
