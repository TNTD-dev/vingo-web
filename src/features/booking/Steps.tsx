import { icons } from '@/design/icons'
import { cn } from '@/lib/cn'

const LABELS = ['Chọn ghế', 'Thanh toán', 'Nhận vé'] as const

/** Thanh 3 bước đặt vé (Figma B3/B4): bước đã xong có dấu tích, bước hiện tại nền đen. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="hidden items-center gap-2 sm:flex" aria-label="Các bước đặt vé">
      {LABELS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-px w-8 bg-line" />}
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-pill py-1.5 pr-3.5 pl-1.5',
                active ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-pill type-mono-small',
                  done ? 'bg-ink' : active ? 'bg-agent text-foreground' : 'bg-muted text-foreground',
                )}
              >
                {done ? <img src={icons.checkSm} alt="" className="size-3" /> : n}
              </span>
              <span className="type-body-m-strong">{label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
