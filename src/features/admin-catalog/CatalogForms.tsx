import { useState, type FormEvent } from 'react'
import type { EventCreateInput, EventDetail } from '@/api/generated/model'
import { Field, ErrorNotice } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { categories } from './catalog'

export { FormDialog } from '@/design/admin/FormDialog'

export function EventForm({
  initial,
  pending,
  error,
  onSubmit,
}: {
  initial?: EventDetail
  pending: boolean
  error: unknown
  onSubmit: (data: EventCreateInput) => void
}) {
  const [data, setData] = useState<EventCreateInput>({
    title: initial?.title ?? '',
    category: initial?.category ?? 'FOOTBALL',
    description: initial?.description ?? '',
    poster_mobile_url: initial?.poster_mobile_url ?? '',
    poster_desktop_url: initial?.poster_desktop_url ?? '',
    max_tickets_per_order: initial?.max_tickets_per_order ?? 6,
    home_team: initial?.home_team ?? undefined,
    away_team: initial?.away_team ?? undefined,
    league: initial?.league ?? undefined,
    round: initial?.round ?? undefined,
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      ...data,
      title: data.title.trim(),
      poster_mobile_url: data.poster_mobile_url || undefined,
      poster_desktop_url: data.poster_desktop_url || undefined,
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Tên sự kiện *">
            <input
              required
              maxLength={200}
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Thể loại *">
          <select
            value={data.category}
            onChange={(e) => setData({ ...data, category: e.target.value as EventCreateInput['category'] })}
          >
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Giới hạn vé mỗi đơn *">
          <input
            required
            type="number"
            min={1}
            max={20}
            value={data.max_tickets_per_order}
            onChange={(e) => setData({ ...data, max_tickets_per_order: Number(e.target.value) })}
          />
        </Field>
        <Field label="Poster dọc (URL)">
          <input
            type="url"
            pattern="https?://.+"
            value={data.poster_mobile_url}
            onChange={(e) => setData({ ...data, poster_mobile_url: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Poster ngang (URL)">
          <input
            type="url"
            pattern="https?://.+"
            value={data.poster_desktop_url}
            onChange={(e) => setData({ ...data, poster_desktop_url: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Giới thiệu sự kiện">
            <textarea
              rows={5}
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
            />
          </Field>
        </div>
        {data.category === 'FOOTBALL' &&
          (['home_team', 'away_team', 'league', 'round'] as const).map((key, i) => (
            <Field key={key} label={['Đội nhà', 'Đội khách', 'Giải đấu', 'Vòng đấu'][i]}>
              <input value={data[key] ?? ''} onChange={(e) => setData({ ...data, [key]: e.target.value })} />
            </Field>
          ))}
      </fieldset>
      <ErrorNotice error={error} />
      <Button disabled={pending || !data.title.trim()} className="rounded-pill">
        {pending ? 'Đang lưu…' : initial ? 'Lưu thông tin' : 'Tạo sự kiện nháp'}
      </Button>
    </form>
  )
}
