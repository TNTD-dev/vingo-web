import { useEffect, useState, type ReactNode } from 'react'

import { CityCode, EventCategory } from '@/api/generated/model'
import { icons } from '@/design/icons'
import { cn } from '@/lib/cn'
import { formatDateRange } from '@/lib/time'
import { formatVnd } from '@/lib/money'

import {
  CATEGORY_LABEL,
  CITY_LABEL,
  hasActiveFilters,
  PRICE_LIMIT,
  PRICE_STEP,
  WHEN,
  whenLabel,
  whenRange,
  type EventFilters,
} from './eventFilters'

/*
 * Khối "Bộ lọc" bên trái màn Khám phá (Figma B1 › filters).
 * Khác Figma vì API: thể loại chỉ chọn được một (API nhận một `category`), không có số đếm cạnh thể loại.
 */

type Props = {
  filters: EventFilters
  onChange: (next: EventFilters) => void
  now: Date
  className?: string
}

export function EventFiltersPanel({ filters: f, onChange, now, className }: Props) {
  const set = (patch: Partial<EventFilters>) => onChange({ ...f, ...patch })
  const range = f.when ? whenRange(f.when, now) : undefined

  return (
    <div className={cn('flex flex-col gap-7 rounded-lg bg-surface p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={icons.filter} alt="" className="size-4" />
          <h2 className="type-h4 text-foreground">Bộ lọc</h2>
        </div>
        <button
          type="button"
          disabled={!hasActiveFilters(f)}
          onClick={() => onChange({ q: f.q, sort: f.sort, available: false })}
          className="type-caption text-ink-tertiary hover:text-foreground disabled:pointer-events-none"
        >
          Xoá lọc
        </button>
      </div>

      <Section title="Thành phố" className="gap-3">
        <div className="flex flex-wrap gap-2">
          {Object.values(CityCode).map((c) => (
            <Chip key={c} active={f.city === c} onClick={() => set({ city: f.city === c ? undefined : c })}>
              {CITY_LABEL[c]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Thể loại" className="gap-3.5">
        {Object.values(EventCategory).map((c) => (
          <Checkbox
            key={c}
            checked={f.category === c}
            onChange={() => set({ category: f.category === c ? undefined : c })}
          >
            {CATEGORY_LABEL[c]}
          </Checkbox>
        ))}
      </Section>

      <Section title="Thời gian" className="gap-3">
        <div className="flex flex-wrap gap-2">
          {WHEN.map((w) => (
            <Chip key={w} active={f.when === w} onClick={() => set({ when: f.when === w ? undefined : w })}>
              {whenLabel(w, now)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-[12px] bg-canvas px-3.5 py-3">
          <img src={icons.calendar} alt="" className="size-4" />
          <span className={cn('type-body-m', range ? 'text-foreground' : 'text-ink-tertiary')}>
            {range ? formatDateRange(range.from, range.to) : 'Mọi thời gian'}
          </span>
        </div>
      </Section>

      <PriceSlider key={f.priceMax ?? 'all'} value={f.priceMax} onCommit={(priceMax) => set({ priceMax })} />

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="type-body-m-strong text-foreground">Chỉ hiện còn vé</span>
          <span className="type-caption text-ink-tertiary">Ẩn suất đã đóng bán</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={f.available}
          aria-label="Chỉ hiện còn vé"
          onClick={() => set({ available: !f.available })}
          className={cn(
            'flex h-[26px] w-[46px] shrink-0 items-center rounded-pill p-[3px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            f.available ? 'justify-end bg-ink' : 'justify-start bg-muted',
          )}
        >
          <span className="size-5 rounded-pill bg-surface" />
        </button>
      </div>
    </div>
  )
}

function Section({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <h3 className="type-mono-label text-ink-secondary">{title}</h3>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-pill border px-3.5 py-2 type-body-m-strong outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-ink bg-ink text-on-ink' : 'border-line bg-surface text-foreground hover:bg-canvas',
      )}
    >
      {children}
    </button>
  )
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          'flex size-5 items-center justify-center rounded-[6px] peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          checked ? 'bg-ink' : 'border border-line bg-surface',
        )}
      >
        {checked && <img src={icons.check} alt="" className="size-[13px]" />}
      </span>
      <span className="type-body-m text-foreground">{children}</span>
    </label>
  )
}

/** Thanh giá: kéo thì cập nhật nhãn ngay, thả tay 300ms mới đổi bộ lọc để không gọi API liên tục. */
function PriceSlider({ value, onCommit }: { value?: number; onCommit: (v: number | undefined) => void }) {
  // Nơi gọi đặt key theo value nên khi bộ lọc đổi từ ngoài (Xoá lọc), state khởi tạo lại.
  const [draft, setDraft] = useState(value ?? PRICE_LIMIT)
  useEffect(() => {
    const current = value ?? PRICE_LIMIT
    if (draft === current) return
    const t = setTimeout(() => onCommit(draft >= PRICE_LIMIT ? undefined : draft), 300)
    return () => clearTimeout(t)
  }, [draft, value, onCommit])

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between">
        <h3 className="type-mono-label text-ink-secondary">Giá vé</h3>
        <span className="type-body-m-strong text-foreground">
          {draft >= PRICE_LIMIT ? 'Mọi mức giá' : `≤ ${formatVnd(draft)}`}
        </span>
      </div>
      <div className="relative h-1 rounded-[4px] bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring">
        <div className="h-1 rounded-[4px] bg-ink" style={{ width: `${(draft / PRICE_LIMIT) * 100}%` }} />
        <input
          type="range"
          min={0}
          max={PRICE_LIMIT}
          step={PRICE_STEP}
          value={draft}
          onChange={(e) => setDraft(Number(e.target.value))}
          aria-label="Giá vé tối đa"
          aria-valuetext={draft >= PRICE_LIMIT ? 'Mọi mức giá' : formatVnd(draft)}
          className="absolute inset-x-0 -top-2 h-5 w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex justify-between type-caption text-ink-tertiary">
        <span>{formatVnd(0)}</span>
        <span>{formatVnd(PRICE_LIMIT)}</span>
      </div>
    </div>
  )
}
