import { ArrowUpRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

import { parseSeatMap, type SeatCell } from './payloads'
import type { BlockProps } from './types'

/**
 * Block `SeatMap` (Figma M3): một khu ghế ngay trong chat. Ghế Vingo đề xuất được chọn sẵn;
 * người dùng chạm ghế khác để đổi, rồi gửi lại cho agent. Đây là lưới rút gọn từ payload,
 * không phải sơ đồ SVG đầy đủ (đó là `seatmap/SeatMapView`, mở bằng "Mở sơ đồ đầy đủ").
 */
export function SeatMap({ block, onBlockEvent, readOnly }: BlockProps) {
  const p = parseSeatMap(block)
  const [selected, setSelected] = useState<string[]>(p.selected)
  const changed = selected.length !== p.selected.length || selected.some((s) => !p.selected.includes(s))
  const labelOf = new Map(p.rows.flat().map((s) => [s.id, s.label]))
  const header = [p.zoneLabel, p.rowLabel, p.priceLabel].filter(Boolean).join(' · ')

  const toggle = (seat: SeatCell) => {
    if (seat.state !== 'available' || readOnly) return
    setSelected((cur) => (cur.includes(seat.id) ? cur.filter((s) => s !== seat.id) : [...cur, seat.id]))
  }

  return (
    <section aria-label="Sơ đồ ghế" className="w-full max-w-[750px] rounded-lg bg-muted/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-mono-label text-ink-secondary">{header}</h3>
        {!readOnly && <span className="type-caption text-ink-tertiary">Chạm ghế để đổi</span>}
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {(p.venueName || p.remainingLabel || p.fullMapUrl) && (
          <div className="flex shrink-0 flex-col justify-between gap-3 rounded-md bg-surface p-4 sm:w-[196px]">
            <div>
              {p.venueName && <p className="text-[15px] font-medium">{p.venueName}</p>}
              {p.remainingLabel && <p className="type-caption text-ink-secondary">{p.remainingLabel}</p>}
            </div>
            {p.fullMapUrl?.startsWith('/') && (
              <Link
                to={p.fullMapUrl}
                className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink"
              >
                Mở sơ đồ đầy đủ <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-md bg-surface p-3">
          <div className="flex w-max min-w-full flex-col items-center gap-1.5">
            {p.rows.map((row, r) => (
              <div key={r} className="flex gap-1.5">
                {row.map((seat) => {
                  const on = selected.includes(seat.id)
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      onClick={() => toggle(seat)}
                      disabled={seat.state !== 'available' || readOnly}
                      aria-label={`Ghế ${seat.label}${seat.state === 'sold' ? ', đã bán' : seat.state === 'held' ? ', đang giữ' : ''}`}
                      aria-pressed={on}
                      className={cn(
                        'size-[22px] shrink-0 rounded-full border text-[0px] transition-colors sm:size-[18px]',
                        seat.state === 'sold' && 'border-transparent bg-seat-sold',
                        seat.state === 'held' && 'border-transparent bg-seat-held',
                        seat.state === 'available' && !on && 'border-line bg-seat-available hover:border-ink',
                        on && 'border-ink bg-agent shadow-agent-glow',
                      )}
                    >
                      {seat.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <p className="mt-3 flex items-center justify-center gap-1.5 type-caption text-ink">
              <Sparkles className="size-3.5" aria-hidden />
              {changed ? 'Bạn chọn' : 'Vingo đề xuất'} · {selected.map((s) => labelOf.get(s) ?? s).join(', ')}
            </p>
          )}
        </div>
      </div>
      {changed && !readOnly && (
        <button
          type="button"
          onClick={() =>
            onBlockEvent?.(
              'seatmap.select',
              { seats: selected },
              `Mình chọn ${selected.map((s) => labelOf.get(s) ?? s).join(', ')}`,
            )
          }
          className="mt-3 rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink"
        >
          Dùng ghế này
        </button>
      )}
    </section>
  )
}
