import { cn } from '@/lib/cn'

import { QR_CELLS } from './qrPattern'

/** QR minh hoạ dạng SVG (trang trí, không quét được). */
export function QrMini({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn('rounded-[14px] bg-white', className)}>
      {QR_CELLS.map((c, i) => (
        <rect key={i} x={12 + c.x * 9} y={12 + c.y * 9} width="8" height="8" rx="2" className="fill-ink" />
      ))}
    </svg>
  )
}
