import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createShowtime, updateShowtime } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Showtime, ShowtimeInput, Venue } from '@/api/generated/model'
import { ErrorNotice, Field, QueryState } from '@/design/admin/AdminUi'
import { ChoiceCard, ChoiceGroup, Segmented } from '@/design/admin/wizard'
import { Button } from '@/design/ui/button'
import { toast } from 'sonner'
import { localDateTime, nowLocal, toUtc, useLayoutDirectory, useVenueDirectory } from './catalog'
import {
  addMinutes,
  latestPublished,
  nextOpenSlot,
  presetSale,
  saleIssueText,
  validateSaleWindow,
  type SalePreset,
} from './readiness'

const presets: { value: SalePreset; label: string }[] = [
  { value: 'NOW_TO_START', label: 'Mở bán ngay khi công bố' },
  { value: 'TO_START', label: 'Đóng khi bắt đầu' },
  { value: 'BEFORE_2H', label: 'Đóng trước 2 giờ' },
]
const dm = (local: string) => (local ? `${local.slice(8, 10)}/${local.slice(5, 7)}` : '')
const ms = (local: string) => Date.parse(`${local}:00Z`)

/** Form một suất diễn: nơi diễn, giờ diễn, giờ bán. Dùng trong wizard (bước 2) và hộp thoại sửa suất. */
type Props = {
  eventId: string
  initial?: Showtime
  /** Nhân bản: điền sẵn từ suất khác, nhưng lưu thành suất mới. */
  template?: Showtime
  venueHint?: string | null
  onSaved: () => void
  onCancel: () => void
}
export default function ShowtimeEditor(props: Props) {
  const venues = useVenueDirectory()
  return <QueryState query={venues}>{venues.data && <EditorBody {...props} venues={venues.data} />}</QueryState>
}

function EditorBody({ eventId, initial, template, venueHint, onSaved, onCancel, venues }: Props & { venues: Venue[] }) {
  const client = useQueryClient(),
    source = initial ?? template
  const hallOf = source?.hall_id ?? ''
  const [venueId, setVenueId] = useState(
    () => venues.find((v) => v.halls?.some((h) => h.id === hallOf))?.id ?? venueHint ?? '',
  )
  const [hall, setHall] = useState(hallOf),
    [layout, setLayout] = useState(source?.seat_layout_id ?? '')
  const startLocal = localDateTime(source?.starts_at),
    endLocal = localDateTime(source?.ends_at)
  const shift = template && !initial ? 7 * 1440 : 0
  const shifted = (iso?: string) => (shift ? addMinutes(localDateTime(iso), shift) : localDateTime(iso))
  const [date, setDate] = useState(shifted(source?.starts_at).slice(0, 10)),
    [start, setStart] = useState(startLocal.slice(11)),
    [end, setEnd] = useState(endLocal.slice(11)),
    [open, setOpen] = useState(shifted(source?.sale_opens_at)),
    [close, setClose] = useState(shifted(source?.sale_closes_at)),
    [preset, setPreset] = useState<SalePreset | null>(() => {
      const s = shifted(source?.starts_at),
        c = shifted(source?.sale_closes_at)
      return !c || !s ? 'TO_START' : c === s ? 'TO_START' : c === addMinutes(s, -120) ? 'BEFORE_2H' : null
    })
  const startsAt = date && start ? `${date}T${start}` : '',
    endsAt = date && end ? `${date}T${end}` : ''
  const effectiveClose = close
  const window = { starts_at: startsAt, ends_at: endsAt, sale_opens_at: open, sale_closes_at: effectiveClose }
  const issues = validateSaleWindow(window)
  const valid = !!hall && !!layout && !issues.length

  function applyPreset(next: SalePreset, startsAtValue = startsAt) {
    setPreset(next)
    const r = presetSale(next, startsAtValue, nextOpenSlot(nowLocal()), { open, close })
    setOpen(r.open)
    setClose(r.close)
  }
  function changeDate(nextDate: string, nextStart: string) {
    setDate(nextDate)
    setStart(nextStart)
    if (nextStart && !end) setEnd(addMinutes(`2000-01-01T${nextStart}`, 120).slice(11))
    const s = nextDate && nextStart ? `${nextDate}T${nextStart}` : ''
    if (preset && s) {
      const r = presetSale(preset === 'NOW_TO_START' ? 'TO_START' : preset, s, nowLocal(), { open, close })
      setClose(r.close)
    }
  }

  const mutation = useMutation({
    mutationFn: (data: ShowtimeInput) =>
      initial?.id ? updateShowtime(initial.id, data) : createShowtime(eventId, data),
    onSuccess: async () => {
      toast.success('Đã lưu suất diễn')
      await client.invalidateQueries()
      onSaved()
    },
  })
  const venue = venues.find((v) => v.id === venueId)
  const span = startsAt && endsAt && open ? { a: ms(open), c: ms(effectiveClose || startsAt), e: ms(endsAt) } : null
  const total = span ? span.e - span.a : 0
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / total) * 100))}%`
  const days = span ? Math.max(0, Math.round((span.c - span.a) / 86400000)) : 0
  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid)
            mutation.mutate({
              hall_id: hall,
              seat_layout_id: layout,
              starts_at: toUtc(startsAt),
              ends_at: toUtc(endsAt),
              sale_opens_at: toUtc(open),
              sale_closes_at: toUtc(effectiveClose),
            })
        }}
      >
        <fieldset disabled={mutation.isPending} className="space-y-6">
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <span className="wz-step-dot" data-state="active">
                1
              </span>
              Nơi diễn
            </h3>
            <Field label="Sân">
              <select
                value={venueId}
                onChange={(e) => {
                  setVenueId(e.target.value)
                  setHall('')
                  setLayout('')
                }}
              >
                <option value="">Chọn sân</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.city_name ?? v.city}
                  </option>
                ))}
              </select>
            </Field>
            {venue && (
              <ChoiceGroup label="Hall">
                {venue.halls?.map((h) => (
                  <HallCard
                    key={h.id}
                    venueId={venue.id!}
                    hall={h}
                    selected={hall === h.id}
                    auto={!hall && venue.halls?.length === 1}
                    keepLayout={
                      hall === h.id ? layout : initial?.hall_id === h.id ? initial?.seat_layout_id : undefined
                    }
                    onSelect={(layoutId) => {
                      setHall(h.id!)
                      setLayout(layoutId)
                    }}
                  />
                ))}
                {!venue.halls?.length && <p className="admin-notice">Sân này chưa có hall.</p>}
              </ChoiceGroup>
            )}
          </section>
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <span className="wz-step-dot" data-state="active">
                2
              </span>
              Giờ diễn
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ngày">
                <input type="date" required value={date} onChange={(e) => changeDate(e.target.value, start)} />
              </Field>
              <Field label="Bắt đầu">
                <input type="time" required value={start} onChange={(e) => changeDate(date, e.target.value)} />
              </Field>
              <Field label="Kết thúc">
                <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          </section>
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <span className="wz-step-dot" data-state="active">
                3
              </span>
              Giờ bán
            </h3>
            <Segmented
              variant="pills"
              label="Cách mở và đóng bán"
              options={presets}
              value={preset}
              onChange={(p) => applyPreset(p)}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Mở bán">
                <input
                  type="datetime-local"
                  required
                  value={open}
                  onChange={(e) => {
                    setOpen(e.target.value)
                    if (preset === 'NOW_TO_START') setPreset('TO_START')
                  }}
                />
              </Field>
              <Field label="Đóng bán">
                <input
                  type="datetime-local"
                  required
                  value={close}
                  onChange={(e) => {
                    setClose(e.target.value)
                    setPreset(null)
                  }}
                />
              </Field>
            </div>
            {span && total > 0 && span.c >= span.a && (
              <div className="wz-timeline mt-4" aria-label="Dòng thời gian bán vé">
                <div className="wz-timeline-bar">
                  <i style={{ width: pct(span.c - span.a) }} />
                  <i style={{ width: pct(span.e - span.c) }} />
                </div>
                <p>
                  <span>
                    Mở bán {dm(open)} {open.slice(11)}
                  </span>
                  <span>Bán {days} ngày</span>
                  <span>
                    Diễn {dm(startsAt)} {start}–{end}
                  </span>
                </p>
              </div>
            )}
          </section>
        </fieldset>
        <p className="wz-soft" role="status">
          {issues.length
            ? issues.map((i) => saleIssueText[i]).join(' ')
            : '✓ Hợp lệ: đóng bán không sau giờ diễn, kết thúc sau bắt đầu. Giờ theo Việt Nam (UTC+7).'}
        </p>
        {!layout && !!hall === false && venue && (
          <p className="admin-notice">Chọn hall có sơ đồ đã phát hành để gắn vào suất.</p>
        )}
        <ErrorNotice error={mutation.error} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={!valid || mutation.isPending} className="admin-small-button">
            {mutation.isPending ? 'Đang lưu…' : 'Lưu suất diễn'}
          </Button>
          <Button type="button" variant="outline" className="admin-small-button" onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </form>
    </>
  )
}

function HallCard({
  venueId,
  hall,
  selected,
  keepLayout,
  auto,
  onSelect,
}: {
  venueId: string
  hall: { id?: string; name?: string }
  selected: boolean
  keepLayout?: string
  /** Chỉ có một hall: chọn sẵn khi hall đã có sơ đồ phát hành. */
  auto?: boolean
  onSelect: (layoutId: string) => void
}) {
  const layouts = useLayoutDirectory(hall.id!)
  const published = layouts.data?.filter((l) => l.status === 'PUBLISHED') ?? []
  const chosen = published.find((l) => l.id === keepLayout) ?? latestPublished(published)
  const chosenId = chosen?.id
  useEffect(() => {
    if (auto && chosenId) onSelect(chosenId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, chosenId])
  return (
    <div className="flex flex-col gap-1">
      <ChoiceCard
        title={hall.name ?? 'Hall'}
        selected={selected}
        disabled={layouts.isPending || !chosen}
        onSelect={() => chosen?.id && onSelect(chosen.id)}
        hint={
          layouts.isPending
            ? 'Đang tải…'
            : chosen
              ? `Sơ đồ v${chosen.version} · ${chosen.zone_count ?? '—'} khu · ${(chosen.seat_count ?? 0).toLocaleString('vi-VN')} ghế`
              : 'Chưa có sơ đồ phát hành'
        }
      />
      {!layouts.isPending && !chosen && (
        <Link className="wz-link text-xs" to={`/admin/venues/${venueId}/setup?step=2`}>
          Thêm sơ đồ →
        </Link>
      )}
    </div>
  )
}
