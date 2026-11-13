import { mascot, type MascotState } from '@/design/brand'
import { cn } from '@/lib/cn'

/** VingoDock (Figma 29:116): mascot theo trạng thái agent + bong bóng thoại ngắn, nằm cạnh ô chat. */
export function MascotDock({ state, bubble, className }: { state: MascotState; bubble?: string; className?: string }) {
  return (
    <div aria-live="polite" className={cn('pointer-events-none flex items-end gap-1', className)}>
      {bubble && (
        <span className="mb-10 rounded-pill border border-line bg-surface px-3.5 py-2 type-body-m-strong whitespace-nowrap shadow-float">
          {bubble}
        </span>
      )}
      <img src={mascot[state]} alt="" data-state={state} className="h-[96px] w-auto select-none" draggable={false} />
    </div>
  )
}
