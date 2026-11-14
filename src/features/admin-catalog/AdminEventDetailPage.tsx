import { useState } from 'react'
import { Link, useParams } from 'react-router'
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
import {
  AdminPage,
  Panel,
  QueryState,
  Table,
  StateBadge,
  ConfirmDialog,
  Field,
  ErrorNotice,
} from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { dateText } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { FormDialog, EventForm } from './CatalogForms'
import ShowtimeForm from './ShowtimeForm'
import EventPricing from './EventPricing'
import { toast } from 'sonner'

export default function AdminEventDetailPage() {
  const { eventId = '' } = useParams(),
    query = useGetAdminEvent(eventId)
  return <QueryState query={query}>{query.data && <EventEditor key={eventId} event={query.data} />}</QueryState>
}
function EventEditor({ event }: { event: EventDetail }) {
  const id = event.id!,
    client = useQueryClient(),
    [data, setData] = useState<EventInput>({
      title: event.title,
      category: event.category,
      description: event.description,
      max_tickets_per_order: event.max_tickets_per_order ?? 6,
    })
  const [tierEdits, setTierEdits] = useState<Record<string, number>>({}),
    [editor, setEditor] = useState<Showtime | 'new' | null>(null),
    [extra, setExtra] = useState<'pricing' | 'info' | null>(null),
    [action, setAction] = useState<{ kind: 'publish' | 'cancel' | 'showtime'; show?: Showtime } | null>(null),
    [infoSaved, setInfoSaved] = useState(false)
  const [viewedAt] = useState(() => Date.now())
  const tiers = (event.price_tiers ?? []).map((t, i) => ({ ...t, price: tierEdits[t.id ?? i] ?? t.price }))
  const terminal = event.status === 'CANCELLED' || event.status === 'ENDED'
  const priceLocked =
    terminal ||
    event.showtimes?.some((s) => s.status !== 'CANCELLED' && s.sale_opens_at && Date.parse(s.sale_opens_at) <= viewedAt)
  const save = useMutation({
    mutationFn: async () => {
      setInfoSaved(false)
      await updateEvent(id, data)
      setInfoSaved(true)
      if (JSON.stringify(tiers) !== JSON.stringify(event.price_tiers ?? [])) await putPriceTiers(id, tiers)
    },
    onSuccess: async () => {
      toast.success('Đã lưu thay đổi')
      setInfoSaved(false)
      setTierEdits({})
      await client.invalidateQueries()
    },
  })
  const advanced = useMutation({
    mutationFn: (input: EventInput) => updateEvent(id, input),
    onSuccess: async (updated) => {
      setData({
        title: updated.title,
        category: updated.category,
        description: updated.description,
        max_tickets_per_order: updated.max_tickets_per_order,
      })
      setExtra(null)
      toast.success('Đã lưu thông tin bổ sung')
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
  return (
    <AdminPage
      title={event.title ?? 'Sự kiện'}
      caption={`// SỰ KIỆN · ${event.status ?? ''}`}
      actions={
        <>
          <AdminAction secondary disabled={terminal} onClick={() => begin({ kind: 'cancel' })}>
            Hủy sự kiện
          </AdminAction>
          <AdminAction type="submit" form="admin-event-editor" disabled={terminal || save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          </AdminAction>
        </>
      }
    >
      <div className="admin-event-grid">
        <div className="space-y-4">
          <Panel>
            <div className="mb-5 flex items-center justify-between">
              <h2>Thông tin chung</h2>
              <button className="admin-more" aria-label="Thông tin bổ sung" onClick={() => setExtra('info')}>
                <img src={more} width={18} height={18} alt="" />
              </button>
            </div>
            <form
              id="admin-event-editor"
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate()
              }}
            >
              <fieldset disabled={terminal || save.isPending} className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên sự kiện">
                  <input
                    required
                    value={data.title ?? ''}
                    onChange={(e) => setData({ ...data, title: e.target.value })}
                  />
                </Field>
                <Field label="Thể loại">
                  <select
                    value={data.category}
                    onChange={(e) => setData({ ...data, category: e.target.value as EventInput['category'] })}
                  >
                    {['FOOTBALL', 'CONCERT', 'THEATER', 'OTHER'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Địa điểm (venue)">
                    <input
                      readOnly
                      value={
                        event.venue
                          ? `${event.venue.name} · ${event.venue.city ?? ''}`
                          : 'Địa điểm được xác định từ suất diễn'
                      }
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Mô tả">
                    <textarea
                      value={data.description ?? ''}
                      onChange={(e) => setData({ ...data, description: e.target.value })}
                    />
                  </Field>
                </div>
              </fieldset>
              <ErrorNotice error={save.error} />
              {save.isError && infoSaved && (
                <p className="admin-notice">Thông tin chung đã lưu. Bảng giá chưa được cập nhật.</p>
              )}
            </form>
          </Panel>
          <Panel>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="showtimes">Suất diễn</h2>
              <Button className="admin-small-button" disabled={terminal} onClick={() => setEditor('new')}>
                + Thêm suất
              </Button>
            </div>
            {!event.showtimes?.length ? (
              <p className="admin-notice">Thêm suất, cấu hình giá theo khu để công bố sự kiện.</p>
            ) : (
              <Table label="Suất diễn" headings={['Bắt đầu', 'Sơ đồ / hall', 'Mở bán', 'Trạng thái', '']}>
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
              </Table>
            )}
          </Panel>
          {event.status === 'DRAFT' && (
            <AdminAction onClick={() => begin({ kind: 'publish' })}>Công bố sự kiện</AdminAction>
          )}
        </div>
        <Panel>
          <div className="mb-4 flex justify-between gap-2">
            <h2>Giá theo khu</h2>
            <button className="admin-more" aria-label="Cấu hình hạng giá và khu" onClick={() => setExtra('pricing')}>
              <img src={more} width={18} height={18} alt="" />
            </button>
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
            <Button variant="outline" onClick={() => setExtra('pricing')}>
              Thêm hạng giá
            </Button>
          )}
          <p className="admin-notice my-5">
            {priceLocked
              ? 'Cấu hình giá đã khóa khi mở bán hoặc có đơn. Đơn đang giữ chỗ giữ nguyên mức giá.'
              : 'Cấu hình hạng giá và gán đủ các khu trước khi công bố.'}
          </p>
          <label className="admin-price-row">
            <span>Tối đa vé / đơn</span>
            <input
              className="admin-price-limit"
              type="number"
              form="admin-event-editor"
              min={1}
              max={20}
              required
              disabled={terminal}
              value={data.max_tickets_per_order}
              onChange={(e) => setData({ ...data, max_tickets_per_order: Number(e.target.value) })}
            />
          </label>
        </Panel>
      </div>
      {editor && (
        <ShowtimeForm eventId={id} initial={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} />
      )}
      {extra && (
        <FormDialog
          title={extra === 'pricing' ? 'Hạng giá & gán khu' : 'Thông tin bổ sung'}
          pending={advanced.isPending}
          onClose={() => setExtra(null)}
        >
          {extra === 'pricing' ? (
            <EventPricing event={event} />
          ) : (
            <EventForm
              initial={event}
              pending={advanced.isPending}
              error={advanced.error}
              onSubmit={(input) => advanced.mutate(input)}
            />
          )}
        </FormDialog>
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
                  { label: 'Trạng thái', value: `${action.show?.status} → CANCELLED` },
                  { label: 'Mở bán dự kiến', value: dateText(action.show?.sale_opens_at) },
                  { label: 'Suất đã mở bán?', value: 'Không hủy được (SHOWTIME_LOCKED)' },
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
