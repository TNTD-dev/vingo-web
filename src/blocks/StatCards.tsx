import { StatusPill } from '@/design/StatusPill'

import { parseStatCards } from './adminPayloads'
import type { BlockProps } from './types'

/** Block `StatCards` (Figma StatCard 5:89): vài số liệu lớn kèm so sánh. Số lấy từ agent (get_metrics), web không tính lại. */
export function StatCards({ block }: BlockProps) {
  const { cards } = parseStatCards(block)
  if (cards.length === 0) return null
  return (
    <ul aria-label="Số liệu" className="grid w-full max-w-[750px] gap-3 sm:grid-cols-3">
      {cards.map((c, i) => (
        <li key={i} className="flex flex-col gap-4 rounded-lg bg-canvas p-5">
          <span className="type-mono-label text-ink-secondary">{c.label}</span>
          <span className="type-h1 whitespace-nowrap text-ink">{c.display}</span>
          {(c.delta || c.compare) && (
            <span className="flex flex-wrap items-center gap-2">
              {c.delta && (
                <StatusPill
                  label={c.delta.label}
                  tone={c.delta.tone === 'success' ? 'success' : c.delta.tone === 'danger' ? 'danger' : 'neutral'}
                />
              )}
              {c.compare && <span className="type-caption text-ink-tertiary">{c.compare}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
