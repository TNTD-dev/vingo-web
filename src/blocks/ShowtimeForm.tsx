import { Sparkles } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

import { StatusPill } from '@/design/StatusPill'
import { cn } from '@/lib/cn'

import { parseShowtimeForm } from './adminPayloads'
import { editedFields, hasEdits, initialValues, isAgentFilled, isComplete } from './formState'
import type { BlockProps } from './types'

/**
 * Form suất diễn mới do Vingo điền sẵn (Figma C4). Ô viền lime là Vingo điền; admin sửa thẳng rồi bấm "Cập nhật"
 * để Vingo tính lại ConfirmAction. Form không tạo suất: chỉ ConfirmAction mới gọi API.
 */
export function ShowtimeForm({ block, onBlockEvent, onDirtyChange, readOnly }: BlockProps) {
  const p = parseShowtimeForm(block)
  const uid = useId()
  const [sent, setSent] = useState(() => initialValues(p.fields))
  const [values, setValues] = useState(sent)
  // So với giá trị đã gửi gần nhất (để sau khi cập nhật, nút biến mất nhưng ô vẫn đánh dấu là admin sửa).
  const dirty = p.fields.some((f) => (values[f.key] ?? '') !== (sent[f.key] ?? ''))
  const everEdited = hasEdits(p.fields, values)

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  if (p.fields.length === 0) return null

  const send = () => {
    const edits = editedFields(p.fields, values)
    onBlockEvent?.(
      'showtime.edit',
      { fields: Object.fromEntries(p.fields.map((f) => [f.key, values[f.key] ?? ''])) },
      `Sửa suất: ${Object.keys(edits)
        .map((k) => p.fields.find((f) => f.key === k)?.label.toLowerCase())
        .join(', ')}`,
    )
    setSent(values)
  }

  return (
    <section aria-label={p.title} className="w-full max-w-[750px] rounded-lg bg-canvas p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="type-h4">{p.title}</h3>
        <StatusPill label={p.statusLabel} tone="info" />
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {p.fields.map((f) => {
          const filled = isAgentFilled(f, values)
          return (
            <label key={f.key} htmlFor={`${uid}-${f.key}`} className="flex flex-col gap-1.5">
              <span className="type-mono-small text-ink-tertiary uppercase">{f.label}</span>
              <span
                className={cn(
                  'flex items-center gap-2 rounded-md border bg-surface px-3.5 py-3 focus-within:border-ink',
                  filled ? 'border-agent' : 'border-line',
                )}
              >
                <input
                  id={`${uid}-${f.key}`}
                  value={values[f.key] ?? ''}
                  disabled={readOnly}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="min-w-0 flex-1 bg-transparent type-body-m outline-none"
                />
                {filled && <Sparkles className="size-3.5 shrink-0" aria-label="Vingo điền" />}
              </span>
            </label>
          )
        })}
      </div>
      {p.prices.length > 0 && (
        <div className="mt-4">
          {p.priceTitle && <p className="type-mono-small text-ink-tertiary uppercase">{p.priceTitle}</p>}
          <ul className="mt-2 flex flex-wrap gap-2">
            {p.prices.map((c) => (
              <li
                key={c.key}
                className={cn(
                  'flex items-center gap-2 rounded-pill border bg-surface px-3.5 py-1.5',
                  c.changed ? 'border-agent' : 'border-line',
                )}
              >
                <span className="type-mono-small text-ink-tertiary uppercase">{c.label}</span>
                <span className="type-body-m-strong">{c.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="type-caption text-ink-secondary">
          {dirty
            ? 'Bạn đã sửa form. Bấm “Cập nhật” để Vingo tính lại trước khi tạo suất.'
            : everEdited
              ? 'Đã gửi chỉnh sửa của bạn cho Vingo.'
              : 'Ô viền lime là Vingo điền; bạn sửa thẳng trong ô trước khi tạo.'}
        </p>
        {dirty && !readOnly && (
          <button
            type="button"
            disabled={!isComplete(values)}
            onClick={send}
            className="rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink disabled:opacity-40"
          >
            Cập nhật
          </button>
        )}
      </div>
    </section>
  )
}
