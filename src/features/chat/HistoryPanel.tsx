import { Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { MascotAvatar } from '@/design/MascotAvatar'
import { StatusPill, type PillTone } from '@/design/StatusPill'
import { cn } from '@/lib/cn'

import { groupHistory, HISTORY_DAYS, type HistoryEntry, type HistoryTag } from './history'

const TAG: Record<HistoryTag, { label: string; tone: PillTone }> = {
  DRAFT: { label: 'NHÁP', tone: 'neutral' },
  PENDING: { label: 'PENDING', tone: 'warning' },
  PAID: { label: 'PAID', tone: 'success' },
  EXPIRED: { label: 'EXPIRED', tone: 'neutral' },
  QA: { label: 'HỎI ĐÁP', tone: 'info' },
  EXECUTED: { label: 'ĐÃ THỰC THI', tone: 'success' },
  AWAITING: { label: 'CHỜ DUYỆT', tone: 'agent' },
  REJECTED: { label: 'ĐÃ TỪ CHỐI', tone: 'danger' },
  READ_ONLY: { label: 'CHỈ ĐỌC', tone: 'neutral' },
}

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })

type Props = {
  entries: HistoryEntry[]
  activeId?: string
  onOpen: (id: string) => void
  onNew: () => void
  onClear: () => void
  onClose: () => void
}

/** Panel "Lịch sử với Vingo" (Figma M6): lưu 90 ngày, chỉ chủ xem. */
export function HistoryPanel({ entries, activeId, onOpen, onNew, onClear, onClose }: Props) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle ? entries.filter((e) => `${e.title} ${e.preview}`.toLowerCase().includes(needle)) : entries
    return groupHistory(list)
  }, [entries, q])

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Đóng lịch sử"
        onClick={onClose}
        className="absolute inset-0 z-40 cursor-default bg-ink/10"
      />
      <aside
        aria-label="Lịch sử với Vingo"
        className="absolute inset-x-3 top-[64px] bottom-3 z-40 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float sm:inset-x-auto sm:right-4 sm:w-[386px]"
      >
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <h2 className="type-h4 text-[21px]">Lịch sử với Vingo</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNew}
              className="inline-flex items-center gap-1.5 rounded-pill bg-ink px-4 py-2 type-body-m-strong text-on-ink"
            >
              <Plus className="size-3.5" aria-hidden /> Mới
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng lịch sử"
              className="flex size-9 items-center justify-center rounded-full bg-ink text-on-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <label className="mx-4 flex items-center gap-2 rounded-md bg-canvas px-3.5 py-3">
          <Search className="size-4 text-ink" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm trong lịch sử…"
            aria-label="Tìm trong lịch sử"
            className="min-w-0 flex-1 bg-transparent type-body-m outline-none placeholder:text-ink-tertiary"
          />
        </label>
        <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center type-body-m text-ink-secondary">
              {entries.length === 0 ? 'Chưa có hội thoại nào.' : 'Không thấy hội thoại khớp.'}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="px-3 pt-4 pb-1 type-mono-small text-ink-tertiary">{g.label}</h3>
              {g.entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpen(e.id)}
                  className={cn(
                    'flex w-full gap-3 rounded-md p-3 text-left hover:bg-canvas',
                    e.id === activeId && 'bg-agent-soft hover:bg-agent-soft',
                  )}
                >
                  <MascotAvatar className="size-[34px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{e.title}</span>
                    {e.preview && <span className="line-clamp-2 type-caption text-ink-tertiary">{e.preview}</span>}
                    <span className="mt-2 flex items-center gap-2">
                      <StatusPill label={TAG[e.tag].label} tone={TAG[e.tag].tone} />
                      <span className="type-mono-small text-ink-tertiary">
                        {g.label === 'Hôm nay' ? time.format(e.updatedAt) : day.format(e.updatedAt)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
        <footer className="flex items-center justify-between gap-3 bg-canvas px-5 py-3.5 type-caption text-ink-secondary">
          <span>Lưu {HISTORY_DAYS} ngày · chỉ bạn xem được</span>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 text-ink">
            <Trash2 className="size-3.5" aria-hidden /> Xoá lịch sử
          </button>
        </footer>
      </aside>
    </>
  )
}
