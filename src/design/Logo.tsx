import { logoMark } from '@/design/brand'
import { cn } from '@/lib/cn'

/** Logo Vingo: mark + chữ "vingo" (Figma: Design System › Logo, Theme=Light/Dark). */
export function Logo({ theme = 'light', className }: { theme?: 'light' | 'dark'; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <img src={logoMark[theme]} alt="" className="h-[30px] w-auto shrink-0" />
      <span
        className={cn(
          'font-brand text-[26px] leading-[1.2] font-semibold tracking-[-0.02em]',
          theme === 'light' ? 'text-foreground' : 'text-on-ink',
        )}
      >
        vingo
      </span>
    </span>
  )
}
