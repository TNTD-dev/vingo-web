import { useEffect, useState } from 'react'

import { cn } from '@/lib/cn'

import { describeSeats, lockable, parseSeatLock, toggleLockSeat } from './adminPayloads'
import { parseSeatMap } from './payloads'
import type { BlockProps } from './types'

/**
 * Sơ đồ khoá ghế (Figma C5): Vingo chọn sẵn ghế định khoá; admin chạm để thêm/bớt. Ghế đã bán luôn bỏ qua
 * (không chạm được, không bao giờ nằm trong danh sách khoá). BLOCK_SEATS chỉ chạy ở ConfirmAction.
 */
export function SeatLock({ block, onBlockEvent, onDirtyChange, readOnly }: BlockProps) {
  const lock = parseSeatLock(block, parseSeatMap(block).rows)
  const [start, setStart] = useState(lock.selected)
  const [selected, setSelected] = useState(start)
  const dirty = selected.length !== start.length || selected.some((s) => !start.includes(s))
  const labelOf = new Map(lock.rows.flat().map((s) => [s.id, s.label]))
  // Theo thứ tự sơ đồ, không theo thứ tự chạm.
  const ordered = lock.rows
    .flat()
    .filter((s) => selected.includes(s.id))
    .map((s) => s.label)

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  if (lock.rows.length === 0) return null

  const send = () => {
    onBlockEvent?.(
      'seatmap.select',
      { mode: 'block', seats: selected },
      selected.length === 0 ? 'Bỏ hết ghế, chưa khoá' : `Khoá ${describeSeats(ordered)}`,
    )
    setStart(selected)
  }

  return (
    <section aria-label="Chọn ghế để khoá" className="w-full max-w-[750px] rounded-lg bg-canvas p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-mono-label text-ink-secondary uppercase">{lock.header}</h3>
        {!readOnly && <span className="type-caption text-ink-tertiary">Chạm ghế để thêm/bớt</span>}
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="mx-auto flex w-max flex-col gap-1.5">
          {lock.rows.map((row, r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="w-5 type-mono-small text-ink-tertiary">{lock.rowNames[r]}</span>
              {row.map((seat) => {
                const on = selected.includes(seat.id)
                return (
                  <button
                    key={seat.id}
                    type="button"
                    disabled={!lockable(seat.state) || readOnly}
                    aria-pressed={on}
                    aria-label={`Ghế ${seat.label}${seat.state === 'sold' ? ', đã bán, bỏ qua' : seat.state === 'held' ? ', đang giữ' : on ? ', sẽ khoá' : ''}`}
                    onClick={() => setSelected((cur) => toggleLockSeat(cur, seat))}
                    className={cn(
                      'size-[22px] shrink-0 rounded-[6px] border',
                      seat.state === 'sold' && 'border-transparent bg-muted',
                      seat.state === 'held' && 'border-transparent bg-seat-held',
                      seat.state === 'available' && !on && 'border-line bg-surface hover:border-ink',
                      on && 'border-ink/20 bg-agent',
                    )}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 type-caption text-ink-secondary">
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-agent" aria-hidden /> Sẽ khoá
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] border border-line bg-surface" aria-hidden /> Trống
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3.5 rounded-[4px] bg-muted" aria-hidden /> Đã bán (bỏ qua)
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="type-caption text-ink">
          {selected.length === 0
            ? 'Chưa chọn ghế nào'
            : `${dirty ? 'Bạn chọn' : 'Vingo đề xuất'} · ${describeSeats(ordered.length ? ordered : selected.map((s) => labelOf.get(s) ?? s))}`}
        </p>
        {dirty && !readOnly && (
          <button type="button" onClick={send} className="rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink">
            Cập nhật ghế
          </button>
        )}
      </div>
    </section>
  )
}
