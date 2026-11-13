import { QR_CELLS } from '@/design/qrPattern'
import { cn } from '@/lib/cn'

/**
 * Hiển thị mã QR. Backend cấp ảnh (`image`: URL hoặc data URI) thì vẽ ảnh đó.
 * Chưa có ảnh thì vẽ mẫu minh hoạ (KHÔNG quét được) — web chưa có thư viện sinh QR; xem docs/agent-mode-notes.md.
 */
export function QrCode({ image, label, className }: { image?: string; label: string; className?: string }) {
  const safe = image && /^(https:\/\/|data:image\/)/.test(image) ? image : undefined
  if (safe) {
    return <img src={safe} alt={label} className={cn('rounded-md bg-white object-contain', className)} />
  }
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${label} (mẫu minh hoạ)`}
      className={cn('rounded-md bg-white', className)}
    >
      {QR_CELLS.map((c, i) => (
        <rect key={i} x={12 + c.x * 9} y={12 + c.y * 9} width="8" height="8" rx="1.5" className="fill-ink" />
      ))}
    </svg>
  )
}
