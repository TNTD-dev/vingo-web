import { mascot, type MascotState } from '@/design/brand'
import { cn } from '@/lib/cn'

/** Avatar tròn nền lime nhạt, cắt mặt Vingo (Figma "Mascot/Vingo Avatar"). Kích thước theo `className` (size-*). */
export function MascotAvatar({ state = 'wave', className }: { state?: MascotState; className?: string }) {
  return (
    <span aria-hidden className={cn('relative block shrink-0 overflow-hidden rounded-full bg-agent/35', className)}>
      <img
        src={mascot[state]}
        alt=""
        className="absolute max-w-none"
        style={{ width: '172.5%', left: '-36.25%', top: '-34.75%' }}
        draggable={false}
      />
    </span>
  )
}
