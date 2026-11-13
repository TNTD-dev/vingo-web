import { cn } from '@/lib/cn'

/** Tone theo Figma: Design System › Badge. */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'dark'

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-ink-tertiary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  dark: 'bg-agent',
}

/** Nhãn trạng thái dạng pill có chấm màu, chữ mono viết hoa (ON SALE, CÒN 18, HẾT VÉ…). */
export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-[5px]',
        tone === 'dark' ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-foreground',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-pill', DOT[tone])} />
      <span className="type-mono-small whitespace-nowrap">{children}</span>
    </span>
  )
}
