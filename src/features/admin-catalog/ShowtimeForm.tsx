import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createShowtime, updateShowtime } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Showtime, ShowtimeInput } from '@/api/generated/model'
import { Field, ErrorNotice, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { FormDialog } from './CatalogForms'
import { localDateTime, toUtc, useLayoutDirectory, useVenueDirectory } from './catalog'
import { toast } from 'sonner'

export default function ShowtimeForm({
  eventId,
  initial,
  onClose,
}: {
  eventId: string
  initial?: Showtime
  onClose: () => void
}) {
  const venues = useVenueDirectory(),
    client = useQueryClient()
  const [hall, setHall] = useState(initial?.hall_id ?? ''),
    [layout, setLayout] = useState(initial?.seat_layout_id ?? '')
  const [dates, setDates] = useState({
    starts_at: localDateTime(initial?.starts_at),
    ends_at: localDateTime(initial?.ends_at),
    sale_opens_at: localDateTime(initial?.sale_opens_at),
    sale_closes_at: localDateTime(initial?.sale_closes_at),
  })
  const layouts = useLayoutDirectory(hall)
  const valid =
    !!hall &&
    !!layout &&
    Object.values(dates).every(Boolean) &&
    dates.starts_at < dates.ends_at &&
    dates.sale_opens_at < dates.sale_closes_at &&
    dates.sale_closes_at <= dates.starts_at
  const mutation = useMutation({
    mutationFn: (data: ShowtimeInput) =>
      initial?.id ? updateShowtime(initial.id, data) : createShowtime(eventId, data),
    onSuccess: async () => {
      toast.success('Đã lưu suất diễn')
      await client.invalidateQueries()
      onClose()
    },
  })
  return (
    <FormDialog title={initial ? 'Sửa suất diễn' : 'Thêm suất diễn'} pending={mutation.isPending} onClose={onClose}>
      <QueryState query={venues}>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid)
              mutation.mutate({
                hall_id: hall,
                seat_layout_id: layout,
                starts_at: toUtc(dates.starts_at),
                ends_at: toUtc(dates.ends_at),
                sale_opens_at: toUtc(dates.sale_opens_at),
                sale_closes_at: toUtc(dates.sale_closes_at),
              })
          }}
        >
          <p className="admin-notice">
            Tất cả thời gian theo giờ Việt Nam (UTC+7). Sơ đồ phải được phát hành trước khi gắn vào suất.
          </p>
          <fieldset disabled={mutation.isPending} className="grid gap-4 sm:grid-cols-2">
            <Field label="Phòng / sân *">
              <select
                required
                value={hall}
                onChange={(e) => {
                  setHall(e.target.value)
                  setLayout('')
                }}
              >
                <option value="">Chọn phòng / sân</option>
                {venues.data?.map((v) => (
                  <optgroup key={v.id} label={v.name}>
                    {v.halls?.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Sơ đồ đã phát hành *">
              <select
                required
                disabled={!hall || layouts.isPending}
                value={layout}
                onChange={(e) => setLayout(e.target.value)}
              >
                <option value="">{layouts.isPending && hall ? 'Đang tải…' : 'Chọn sơ đồ'}</option>
                {layouts.data
                  ?.filter((l) => l.status === 'PUBLISHED' || l.id === initial?.seat_layout_id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · v{l.version}
                    </option>
                  ))}
              </select>
            </Field>
            {(Object.keys(dates) as (keyof typeof dates)[]).map((k, i) => (
              <Field key={k} label={['Bắt đầu diễn *', 'Kết thúc diễn *', 'Mở bán *', 'Đóng bán *'][i]}>
                <input
                  type="datetime-local"
                  required
                  value={dates[k]}
                  onInput={(e) => {
                    const value = e.currentTarget.value
                    setDates((previous) => ({ ...previous, [k]: value }))
                  }}
                />
              </Field>
            ))}
          </fieldset>
          <ErrorNotice error={layouts.error} />
          {Object.values(dates).every(Boolean) && !valid && (
            <p className="admin-notice">
              Chọn sân và sơ đồ; mở bán trước đóng bán; đóng bán không sau giờ diễn; kết thúc sau giờ bắt đầu.
            </p>
          )}
          <ErrorNotice error={mutation.error} />
          <Button disabled={!valid || mutation.isPending} className="rounded-pill">
            {mutation.isPending ? 'Đang lưu…' : 'Lưu suất diễn'}
          </Button>
        </form>
      </QueryState>
    </FormDialog>
  )
}
