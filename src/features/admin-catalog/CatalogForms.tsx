import { useState, type FormEvent } from 'react'
import type { EventCreateInput, EventDetail, Venue, VenueCreateInput } from '@/api/generated/model'
import { Field, ErrorNotice } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { categories, cities, venueTypes } from './catalog'
import { AdminAction } from '@/design/admin/AdminAction'

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
    age_limit: initial?.age_limit ?? 0,
    max_tickets_per_order: initial?.max_tickets_per_order ?? 6,
    attributes: initial?.attributes,
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
        <Field label="Độ tuổi tối thiểu">
          <input
            type="number"
            min={0}
            max={100}
            value={data.age_limit}
            onChange={(e) => setData({ ...data, age_limit: Number(e.target.value) })}
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
          ['home_team', 'away_team', 'league', 'round'].map((key, i) => (
            <Field key={key} label={['Đội nhà', 'Đội khách', 'Giải đấu', 'Vòng đấu'][i]}>
              <input
                value={String(data.attributes?.[key] ?? '')}
                onChange={(e) => setData({ ...data, attributes: { ...data.attributes, [key]: e.target.value } })}
              />
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
export function VenueForm({
  initial,
  pending,
  error,
  onSubmit,
  compact = false,
  onCancel,
}: {
  initial?: Venue
  pending: boolean
  error: unknown
  onSubmit: (data: VenueCreateInput) => void
  compact?: boolean
  onCancel?: () => void
}) {
  const [data, setData] = useState<VenueCreateInput>({
    name: initial?.name ?? '',
    type: initial?.type ?? 'STADIUM',
    address: initial?.address ?? '',
    city: initial?.city ?? 'HCM',
    district: initial?.district ?? '',
    info: initial?.info ?? {},
    lat: initial?.lat,
    lng: initial?.lng,
  })
  if (compact)
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit({ ...data, name: data.name?.trim(), address: data.address?.trim() })
        }}
      >
        <fieldset disabled={pending} className="space-y-4">
          <Field label="Tên sân *">
            <input
              required
              maxLength={200}
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </Field>
          <div>
            <p className="admin-caption mb-2">Loại</p>
            <div className="admin-type-options">
              {Object.keys(venueTypes).map((type) => (
                <button
                  type="button"
                  aria-pressed={data.type === type}
                  key={type}
                  onClick={() => setData({ ...data, type: type as VenueCreateInput['type'] })}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <Field label="Thành phố">
            <select
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value as VenueCreateInput['city'] })}
            >
              {Object.entries(cities).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Địa chỉ *">
            <input required value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} />
          </Field>
        </fieldset>
        <p className="admin-notice">Sau khi tạo sân, thêm hall rồi nhập sơ đồ ghế SVG cho từng hall.</p>
        <ErrorNotice error={error} />
        <div className="flex items-center gap-2">
          <AdminAction disabled={pending || !data.name?.trim() || !data.address?.trim()}>
            {pending ? 'Đang tạo…' : 'Tạo sân'}
          </AdminAction>
          <Button type="button" className="admin-small-button" variant="outline" disabled={pending} onClick={onCancel}>
            Hủy
          </Button>
        </div>
      </form>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ ...data, name: data.name?.trim(), address: data.address?.trim() })
      }}
      className="space-y-5"
    >
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Tên địa điểm *">
            <input
              required
              maxLength={200}
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Loại địa điểm *">
          <select
            value={data.type}
            onChange={(e) => setData({ ...data, type: e.target.value as VenueCreateInput['type'] })}
          >
            {Object.entries(venueTypes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Thành phố *">
          <select
            value={data.city}
            onChange={(e) => setData({ ...data, city: e.target.value as VenueCreateInput['city'] })}
          >
            {Object.entries(cities).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Địa chỉ *">
            <input required value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} />
          </Field>
        </div>
        <Field label="Quận / huyện">
          <input value={data.district} onChange={(e) => setData({ ...data, district: e.target.value })} />
        </Field>
        <Field label="Giờ mở cửa">
          <input
            value={String(data.info?.opening_hours ?? '')}
            onChange={(e) => setData({ ...data, info: { ...data.info, opening_hours: e.target.value } })}
          />
        </Field>
        {(['lat', 'lng'] as const).map((k) => (
          <Field key={k} label={k === 'lat' ? 'Vĩ độ' : 'Kinh độ'}>
            <input
              type="number"
              step="any"
              min={k === 'lat' ? -90 : -180}
              max={k === 'lat' ? 90 : 180}
              value={data[k] ?? ''}
              onChange={(e) => setData({ ...data, [k]: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>
        ))}
        {(['parking', 'rules'] as const).map((k) => (
          <div key={k} className="sm:col-span-2">
            <Field label={k === 'parking' ? 'Hướng dẫn gửi xe' : 'Nội quy'}>
              <textarea
                value={String(data.info?.[k] ?? '')}
                onChange={(e) => setData({ ...data, info: { ...data.info, [k]: e.target.value } })}
              />
            </Field>
          </div>
        ))}
      </fieldset>
      <ErrorNotice error={error} />
      <Button disabled={pending || !data.name?.trim() || !data.address?.trim()} className="rounded-pill">
        {pending ? 'Đang lưu…' : initial ? 'Lưu địa điểm' : 'Tạo địa điểm'}
      </Button>
    </form>
  )
}
