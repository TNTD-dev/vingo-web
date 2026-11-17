import { useState } from 'react'
import { Field } from '@/design/admin/AdminUi'

type Props = { label: string; value?: string; onChange: (hours: string) => void }

export function OpeningHoursFields({ label, value, onChange }: Props) {
  const range = value?.match(/^([01]?\d|2[0-3])[:h]([0-5]\d)\s*[-–]\s*([01]?\d|2[0-3])[:h]([0-5]\d)$/)
  const [pending, setPending] = useState<{ start: string; end: string }>()
  const start = pending?.start ?? (range ? range[1].padStart(2, '0') + ':' + range[2] : '')
  const end = pending?.end ?? (range ? range[3].padStart(2, '0') + ':' + range[4] : '')

  function update(start: string, end: string) {
    setPending(start && end ? undefined : { start, end })
    onChange(start && end ? `${start}–${end}` : '')
  }

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mở cửa">
          <input type="time" value={start} onChange={(event) => update(event.target.value, end)} />
        </Field>
        <Field label="Đóng cửa">
          <input type="time" value={end} onChange={(event) => update(start, event.target.value)} />
        </Field>
      </div>
    </fieldset>
  )
}
