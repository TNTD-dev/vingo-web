import { cn } from '@/lib/cn'

export type PillTone = 'success' | 'warning' | 'info' | 'neutral' | 'agent' | 'ink'

const dot: Record<PillTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  neutral: 'bg-ink-tertiary',
  agent: 'bg-ink',
  ink: 'bg-agent',
}
const box: Record<PillTone, string> = {
  success: 'bg-surface border-line',
  warning: 'bg-surface border-line',
  info: 'bg-surface border-line',
  neutral: 'bg-surface border-line',
  agent: 'bg-agent border-transparent',
  ink: 'bg-ink text-on-ink border-transparent',
}

/** Pill trạng thái dạng mono + chấm màu (Figma Badge 5:32: ON SALE, PENDING, PAID, ISSUED…). */
export function StatusPill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string
  tone?: PillTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-[5px] type-mono-small whitespace-nowrap text-ink',
        box[tone],
        tone === 'ink' && 'text-on-ink',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', dot[tone])} />
      {label}
    </span>
  )
}
