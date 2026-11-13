import { FileText, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { MascotAvatar } from '@/design/MascotAvatar'
import { StatusPill, type PillTone } from '@/design/StatusPill'
import { cn } from '@/lib/cn'
import type { HistoryApi } from '@/features/chat/ChatPage'
import { groupHistory, type HistoryTag } from '@/features/chat/history'

import { filterHistory, type HistoryFilter } from './copilotHistory'

const FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'write', label: 'Có thao tác ghi' },
  { key: 'pending', label: 'Chờ duyệt' },
]

function outcome(tag: HistoryTag, pending = 0): { label: string; tone: PillTone } {
  switch (tag) {
    case 'AWAITING':
      return { label: `CHỜ DUYỆT ${pending || ''}`.trim(), tone: 'agent' }
    case 'EXECUTED':
      return { label: 'ĐÃ THỰC THI', tone: 'success' }
    case 'REJECTED':
      return { label: 'ĐÃ TỪ CHỐI', tone: 'danger' }
    default:
      return { label: 'CHỈ ĐỌC', tone: 'neutral' }
  }
}

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })

/** Lịch sử Copilot (Figma C6): theo ngày, lọc "Có thao tác ghi" / "Chờ duyệt", mỗi phiên ghi rõ kết quả, nối sang Nhật ký audit. */
export function CopilotHistoryPanel({ entries, activeId, onOpen, onNew, onClose }: HistoryApi) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const groups = useMemo(() => groupHistory(filterHistory(entries, filter, q)), [entries, filter, q])

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
        aria-label="Lịch sử Copilot"
        className="absolute inset-x-3 top-[64px] bottom-3 z-40 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float sm:inset-x-auto sm:right-4 sm:w-[386px]"
      >
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <h2 className="type-h4 text-[21px]">Lịch sử Copilot</h2>
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
              className="flex size-9 items-center justify-center rounded-full bg-canvas"
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
            placeholder="Tìm theo đơn, sự kiện, thao tác…"
            aria-label="Tìm trong lịch sử"
            className="min-w-0 flex-1 bg-transparent type-body-m outline-none placeholder:text-ink-tertiary"
          />
        </label>
        <div role="group" aria-label="Lọc lịch sử" className="flex flex-wrap gap-2 px-4 pt-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-pill px-3.5 py-1.5 type-body-m',
                filter === f.key ? 'bg-ink text-on-ink' : 'bg-canvas',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="mt-1 flex-1 overflow-y-auto px-2 pb-2">
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center type-body-m text-ink-secondary">
              {entries.length === 0 ? 'Chưa có phiên Copilot nào.' : 'Không thấy phiên nào khớp.'}
            </p>
          )}
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="px-3 pt-4 pb-1 type-mono-small text-ink-tertiary uppercase">{g.label}</h3>
              {g.entries.map((e) => {
                const o = outcome(e.tag, e.pending)
                return (
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
                        <StatusPill label={o.label} tone={o.tone} />
                        <span className="type-mono-small text-ink-tertiary">
                          {g.label === 'Hôm nay' ? time.format(e.updatedAt) : day.format(e.updatedAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </section>
          ))}
        </div>
        <footer className="flex items-center justify-between gap-3 bg-canvas px-5 py-3.5 type-caption text-ink-secondary">
          <span>Thao tác ghi cũng có trong Nhật ký audit</span>
          <Link to="/admin/audit-logs" className="inline-flex shrink-0 items-center gap-1.5 text-ink">
            <FileText className="size-3.5" aria-hidden /> Mở audit
          </Link>
        </footer>
      </aside>
    </>
  )
}
