import { QrCode } from 'lucide-react'

import type { Ticket } from '@/api/generated/model'
import { isNotImplemented } from '@/api/problem'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'

import { useTicketQr } from './useTicketQr'

/** Câu giải thích khi không có ảnh QR để hiện. */
function qrFallbackText(status: Ticket['status'], error: unknown): string {
  if (status === 'USED') return 'Vé đã được sử dụng'
  if (status === 'VOID') return 'Vé đã bị vô hiệu'
  return isNotImplemented(error) ? 'Mã QR đang được hoàn thiện' : 'Chưa tải được mã QR'
}

/** Ảnh QR của vé. ISSUED mới tải; vé USED/VOID hay lỗi tải thì hiện trạng thái rõ ràng thay vì ô trống. */
export function QrImage({
  ticket,
  className,
  compact,
}: {
  ticket: Pick<Ticket, 'id' | 'code' | 'status'>
  className?: string
  compact?: boolean
}) {
  const issued = ticket.status === 'ISSUED'
  const qr = useTicketQr(ticket.id, issued)
  if (issued && qr.url) {
    return <img src={qr.url} alt={`Mã QR vé ${ticket.code}`} className={cn('object-contain', className)} />
  }
  if (issued && qr.isPending) return <Skeleton className={className} />
  return (
    <output
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[10px] bg-muted p-2 text-center text-ink-secondary',
        className,
      )}
    >
      <QrCode className={compact ? 'size-5' : 'size-10'} strokeWidth={1.25} aria-hidden />
      <span className={compact ? 'type-mono-small' : 'type-body-m'}>{qrFallbackText(ticket.status, qr.error)}</span>
    </output>
  )
}
