import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/cn'

import { parseReviewTable, type ReviewAction } from './adminPayloads'
import { decisions, initialRows, isChanged, setRowAction, summarize, toggleRow } from './reviewState'
import type { BlockProps } from './types'

const ACTION_LABEL: Record<ReviewAction, string> = { ISSUE_TICKETS: 'Phát hành vé', SKIP: 'Để sau' }

const TONE = { success: 'text-success', danger: 'text-danger', warning: 'text-warning', neutral: 'text-ink-tertiary' }

/**
 * Bảng duyệt đơn NEEDS_REVIEW hàng loạt (Figma C3). Vingo đề xuất cách xử lý từng đơn; admin bỏ chọn hoặc đổi đề xuất,
 * rồi bấm "Cập nhật" để Vingo tính lại ConfirmAction bên dưới. Bảng không tự gọi API: việc ghi chỉ chạy ở ConfirmAction.
 * Chỉ có "Phát hành vé" và "Để sau"; không có hoàn tiền.
 */
export function ReviewTable({ block, onBlockEvent, onDirtyChange, readOnly }: BlockProps) {
  const { orders } = parseReviewTable(block)
  const [start, setStart] = useState(() => initialRows(orders))
  const [rows, setRows] = useState(start)
  const dirty = isChanged(start, rows)
  const sum = summarize(rows, orders)

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  if (orders.length === 0) return null

  const send = () => {
    const picked = decisions(rows)
    onBlockEvent?.(
      'review.change',
      { decisions: picked },
      picked.length === 0 ? 'Bỏ chọn hết, chưa duyệt đơn nào' : `Chỉ duyệt ${picked.length}/${rows.length} đơn đã chọn`,
    )
    setStart(rows)
  }

  return (
    <section aria-label="Đơn cần duyệt" className="w-full max-w-[750px] rounded-lg bg-canvas p-2 sm:p-4">
      <div
        aria-hidden
        className="hidden grid-cols-[28px_96px_1fr_176px_96px] items-center gap-3 px-4 py-2 type-mono-small text-ink-tertiary sm:grid"
      >
        <span />
        <span>MÃ</span>
        <span>LÝ DO · KIỂM TRA</span>
        <span>ĐỀ XUẤT</span>
        <span />
      </div>
      <ul className="flex flex-col">
        {orders.map((o, i) => {
          const row = rows[i]!
          return (
            <li
              key={o.orderId}
              className="grid grid-cols-[28px_1fr] items-center gap-x-3 gap-y-2 border-t border-line px-3 py-3 sm:grid-cols-[28px_96px_1fr_176px_96px] sm:px-4"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={row.selected}
                aria-label={`Duyệt đơn ${o.code}`}
                disabled={readOnly}
                onClick={() => setRows((r) => toggleRow(r, o.orderId))}
                className={cn(
                  'flex size-5 items-center justify-center rounded-[5px] border-[1.5px]',
                  row.selected ? 'border-ink bg-ink text-on-ink' : 'border-ink-tertiary bg-surface',
                )}
              >
                {row.selected && <Check className="size-3.5" aria-hidden />}
              </button>
              <span className="type-mono-small text-ink">{o.code}</span>
              <span className="col-start-2 min-w-0 sm:col-start-auto">
                <span className="block text-[15px] text-ink">{o.reason}</span>
                {o.check && <span className={cn('block type-caption', TONE[o.check.tone])}>{o.check.label}</span>}
              </span>
              <span className="relative col-start-2 sm:col-start-auto">
                <select
                  aria-label={`Cách xử lý đơn ${o.code}`}
                  value={row.action}
                  disabled={readOnly}
                  onChange={(e) => setRows((r) => setRowAction(r, o.orderId, e.target.value as ReviewAction))}
                  className={cn(
                    'w-full appearance-none rounded-pill border bg-surface py-1.5 pr-8 pl-3.5 type-body-m',
                    row.action === o.action && o.action === 'ISSUE_TICKETS' ? 'border-agent' : 'border-line',
                  )}
                >
                  {(Object.keys(ACTION_LABEL) as ReviewAction[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2"
                  aria-hidden
                />
              </span>
              <span className={cn('col-start-2 type-caption sm:col-start-auto', TONE[o.statusTone])}>
                {o.statusLabel}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 pt-3 sm:px-4">
        <p aria-live="polite" className="type-caption text-ink-secondary">
          {dirty
            ? 'Bạn đã đổi lựa chọn. Bấm “Cập nhật” để Vingo tính lại trước khi duyệt.'
            : `Sẽ duyệt ${sum.count}/${sum.total} đơn${sum.skipped > 0 ? ` · ${sum.skipped} đơn để sau` : ''}`}
        </p>
        {dirty && !readOnly && (
          <button type="button" onClick={send} className="rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink">
            Cập nhật đề xuất
          </button>
        )}
      </div>
    </section>
  )
}
