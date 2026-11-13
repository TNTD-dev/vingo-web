import { Check, ShieldCheck, X } from 'lucide-react'

import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'

import { parseConfirmAction } from './payloads'
import type { BlockProps } from './types'

/**
 * Block `ConfirmAction` (Figma 10:137): agent đề xuất thao tác ghi (giữ ghế, tạo thanh toán…),
 * chỉ gọi API khi người dùng bấm "Đồng ý". Quyết định đi qua `onDecide`, block không tự gọi API.
 */
export function ConfirmAction({ block, actionState, onDecide, readOnly, stale }: BlockProps) {
  const p = parseConfirmAction(block)
  const state = p.actionId ? actionState?.[p.actionId] : undefined
  const resolved = state === 'confirmed' || state === 'rejected' || state === 'expired'
  const busy = state === 'confirming'
  const disabled = readOnly || busy || !p.actionId || !onDecide || !!stale

  return (
    <section
      aria-label="Cần bạn xác nhận"
      className={cn(
        'w-full max-w-[420px] rounded-lg border-2 bg-surface p-5',
        resolved ? 'border-line' : 'border-agent shadow-agent-glow/40',
      )}
    >
      <header className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-agent">
          <ShieldCheck className="size-3.5" aria-hidden />
        </span>
        <span className="type-mono-label text-ink-secondary">Cần bạn xác nhận</span>
      </header>
      <h3 className="mt-3 type-h4">{p.title}</h3>
      {p.rows.length > 0 && (
        <dl className="mt-4 space-y-2 rounded-md bg-canvas p-4 text-sm">
          {p.rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 type-caption whitespace-nowrap text-ink-secondary">{r.label}</dt>
              <dd className={cn('text-right', r.strong ? 'type-h4' : 'type-body-m text-ink')}>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4">
        {resolved ? (
          <p
            className={cn(
              'flex items-center gap-2 type-body-m-strong',
              state === 'confirmed' ? 'text-success' : 'text-ink-secondary',
            )}
          >
            {state === 'confirmed' ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            {state === 'confirmed'
              ? 'Đã đồng ý'
              : state === 'rejected'
                ? 'Đã từ chối'
                : 'Đề xuất đã hết hạn hoặc đã được xử lý'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                disabled={disabled}
                onClick={() => p.actionId && onDecide?.(p.actionId, 'confirm')}
                className="h-auto rounded-pill bg-ink px-5 py-3 text-on-ink hover:bg-ink-raised"
              >
                {busy ? 'Đang xử lý…' : p.confirmLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => p.actionId && onDecide?.(p.actionId, 'reject')}
                className="h-auto rounded-pill border-line bg-surface px-5 py-3"
              >
                {p.rejectLabel}
              </Button>
            </div>
            {stale && !readOnly && (
              <p className="mt-2 type-caption text-ink-secondary">
                Bạn đã đổi lựa chọn phía trên. Bấm “Cập nhật” để Vingo tính lại trước khi duyệt.
              </p>
            )}
            {readOnly && <p className="mt-2 type-caption text-ink-secondary">Đăng nhập để đồng ý.</p>}
            {state === 'failed' && (
              <p role="alert" className="mt-2 type-caption text-danger">
                Chưa xử lý được, bạn thử lại nhé.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
