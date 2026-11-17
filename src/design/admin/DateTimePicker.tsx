import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Bộ chọn ngày/giờ của khu admin, thay cho popup mặc định của trình duyệt (mỗi trình duyệt một kiểu, tiếng Anh,
 * xanh dương). Giá trị giữ đúng định dạng của input gốc để code gọi không phải đổi:
 * ngày `YYYY-MM-DD`, giờ `HH:mm`, ngày giờ `YYYY-MM-DDTHH:mm` — đều là giờ Việt Nam.
 */

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
/** Hôm nay theo giờ Việt Nam, không phụ thuộc múi giờ máy. */
export function todayVn() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
}
function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m: m - 1, d }
}
function weekday(date: string) {
  const { y, m, d } = parts(date)
  return new Date(Date.UTC(y, m, d)).getUTCDay()
}
function shiftDate(date: string, days: number) {
  const { y, m, d } = parts(date)
  const t = new Date(Date.UTC(y, m, d + days))
  return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
}
/** “T7, 20/12/2026” */
export function dateLabel(date: string) {
  return date ? `${WEEKDAY_SHORT[weekday(date)]}, ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : ''
}

function PickerField({
  label,
  icon,
  text,
  placeholder,
  open,
  onOpenChange,
  disabled,
  className,
  children,
}: {
  label: string
  icon: ReactNode
  text: string
  placeholder: string
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  const id = useId(),
    valueId = useId()
  return (
    <div className={cn('admin-field', className)}>
      <span id={id}>{label}</span>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="admin-picker-trigger"
            aria-labelledby={`${id} ${valueId}`}
            data-empty={!text || undefined}
            disabled={disabled}
          >
            {icon}
            <span id={valueId}>{text || placeholder}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="admin admin-picker"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            aria-label={label}
          >
            {children}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

/** Lưới tháng: tuần bắt đầu thứ Hai, phím mũi tên đi ngày/tuần, PageUp/PageDown đổi tháng. */
export function Calendar({
  value,
  onChange,
  min,
  max,
}: {
  value: string
  onChange: (date: string) => void
  min?: string
  max?: string
}) {
  const today = todayVn()
  const [focus, setFocus] = useState(value || (min && min > today ? min : today))
  const { y, m } = parts(focus)
  const grid = useRef<HTMLDivElement>(null)
  const moved = useRef(false)
  useEffect(() => {
    if (!moved.current) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus()
  }, [focus])
  const days = useMemo(() => {
    const first = iso(y, m, 1)
    const lead = (weekday(first) + 6) % 7
    return Array.from({ length: 42 }, (_, i) => shiftDate(first, i - lead))
  }, [y, m])
  const out = (d: string) => (!!min && d < min) || (!!max && d > max)
  const month = (delta: number) => {
    const t = new Date(Date.UTC(y, m + delta, 1))
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
    moved.current = false
    setFocus(iso(t.getUTCFullYear(), t.getUTCMonth(), Math.min(parts(focus).d, last)))
  }
  function onKey(e: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (step) {
      e.preventDefault()
      moved.current = true
      setFocus(shiftDate(focus, step))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      month(e.key === 'PageUp' ? -1 : 1)
    }
  }
  const visible = days.slice(35).every((d) => parts(d).m !== m) ? days.slice(0, 35) : days
  return (
    <div className="admin-calendar">
      <div className="admin-calendar-head">
        <strong aria-live="polite">
          Tháng {m + 1}, {y}
        </strong>
        <div>
          <button type="button" aria-label="Tháng trước" onClick={() => month(-1)}>
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button type="button" aria-label="Tháng sau" onClick={() => month(1)}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className="admin-calendar-grid" role="grid" ref={grid} onKeyDown={onKey}>
        {WEEKDAYS.map((w) => (
          <span key={w} role="columnheader" className="admin-calendar-weekday">
            {w}
          </span>
        ))}
        {visible.map((d) => (
          <button
            key={d}
            type="button"
            role="gridcell"
            data-date={d}
            aria-label={`${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`}
            aria-selected={d === value}
            aria-current={d === today ? 'date' : undefined}
            data-outside={parts(d).m !== m || undefined}
            tabIndex={d === focus ? 0 : -1}
            disabled={out(d)}
            onClick={() => onChange(d)}
          >
            {parts(d).d}
          </button>
        ))}
      </div>
      <div className="admin-calendar-foot">
        <button
          type="button"
          disabled={out(today)}
          onClick={() => {
            setFocus(today)
            onChange(today)
          }}
        >
          Hôm nay
        </button>
        {!!value && <span>{dateLabel(value)}</span>}
      </div>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

/** Hai cột giờ/phút (bước 5 phút; giữ nguyên phút lẻ nếu giá trị cũ có). */
export function TimeColumns({ value, onChange }: { value: string; onChange: (time: string, done: boolean) => void }) {
  const [h, mm] = value ? value.split(':') : ['', '']
  const minutes = mm && !MINUTES.includes(mm) ? [...MINUTES, mm].sort() : MINUTES
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    box.current?.querySelectorAll<HTMLElement>('[role="group"]').forEach((col, i) => {
      // Chưa có giá trị thì cuộn cột giờ tới 18h, khung giờ diễn hay dùng nhất.
      const target = col.querySelector<HTMLElement>('[aria-pressed="true"]') ?? (i === 0 ? col.children[18] : null)
      if (target instanceof HTMLElement) col.scrollTop = target.offsetTop - col.offsetTop - 72
    })
  }, [])
  return (
    <div className="admin-time" ref={box}>
      <div className="admin-time-head" aria-hidden>
        <span>Giờ</span>
        <span>Phút</span>
      </div>
      <div role="group" aria-label="Giờ">
        {HOURS.map((v) => (
          <button key={v} type="button" aria-pressed={v === h} onClick={() => onChange(`${v}:${mm || '00'}`, !!mm)}>
            {v}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Phút">
        {minutes.map((v) => (
          <button key={v} type="button" aria-pressed={v === mm} onClick={() => onChange(`${h || '00'}:${v}`, true)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  label: string
  value: string
  onChange: (date: string) => void
  min?: string
  max?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <PickerField
      label={label}
      className={className}
      icon={<CalendarDays size={16} aria-hidden />}
      text={dateLabel(value)}
      placeholder="Chọn ngày"
      open={open}
      onOpenChange={setOpen}
    >
      <Calendar
        value={value}
        min={min}
        max={max}
        onChange={(d) => {
          onChange(d)
          setOpen(false)
        }}
      />
    </PickerField>
  )
}

export function TimeField({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (time: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <PickerField
      label={label}
      className={className}
      icon={<Clock size={16} aria-hidden />}
      text={value}
      placeholder="Chọn giờ"
      open={open}
      onOpenChange={setOpen}
    >
      <TimeColumns
        value={value}
        onChange={(t, done) => {
          onChange(t)
          if (done) setOpen(false)
        }}
      />
    </PickerField>
  )
}

/** Ngày + giờ trong một ô: lịch bên trái, cột giờ/phút bên phải. Chọn ngày trước khi có giờ thì lấy `defaultTime`. */
export function DateTimeField({
  label,
  value,
  onChange,
  defaultTime = '09:00',
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  defaultTime?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const date = value.slice(0, 10),
    time = value.slice(11, 16)
  return (
    <PickerField
      label={label}
      className={className}
      icon={<CalendarDays size={16} aria-hidden />}
      text={value ? `${dateLabel(date)} · ${time}` : ''}
      placeholder="Chọn ngày giờ"
      open={open}
      onOpenChange={setOpen}
    >
      <div className="admin-picker-split">
        <Calendar value={date} onChange={(d) => onChange(`${d}T${time || defaultTime}`)} />
        <TimeColumns value={time} onChange={(t) => onChange(`${date || todayVn()}T${t}`)} />
      </div>
      <div className="admin-picker-actions">
        <button type="button" className="admin-picker-done" onClick={() => setOpen(false)}>
          Xong
        </button>
      </div>
    </PickerField>
  )
}
