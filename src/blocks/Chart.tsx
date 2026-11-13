import { cn } from '@/lib/cn'

import { parseChart } from './adminPayloads'
import type { BlockProps } from './types'

/** Block `Chart` (Figma C2): cột nhóm theo khu, cột cuối mỗi nhóm là kỳ hiện tại. Vẽ bằng div, không thêm thư viện. */
export function Chart({ block }: BlockProps) {
  const c = parseChart(block)
  if (c.groups.length === 0) return null
  const summary = c.groups.map((g) => `${g.label}: ${g.bars.map((b) => b.value).join(', ')}`).join('; ')
  return (
    <section aria-label={c.title} className="w-full max-w-[750px] rounded-lg bg-canvas p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-mono-label text-ink-secondary">{c.title}</h3>
        {c.unitLabel && <span className="type-caption text-ink-tertiary">{c.unitLabel}</span>}
      </div>
      <div role="img" aria-label={`${c.title}. ${summary}`} className="mt-4 flex h-[150px] items-end gap-3 sm:gap-8">
        {c.groups.map((g, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              {g.bars.map((b, j) => (
                <span
                  key={j}
                  className={cn(
                    'w-full max-w-[22px] rounded-[3px]',
                    b.highlight ? (g.tone === 'danger' ? 'bg-danger' : 'bg-ink') : 'bg-muted',
                  )}
                  style={{ height: `${c.max > 0 ? Math.max(4, (b.value / c.max) * 100) : 4}%` }}
                />
              ))}
            </div>
            <span className="type-caption text-ink-secondary">{g.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
