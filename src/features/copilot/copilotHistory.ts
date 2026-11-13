import { parseConfirmAction } from '@/blocks/payloads'
import type { ChatState } from '@/features/chat/chatReducer'
import type { HistoryEntry, HistoryTag } from '@/features/chat/history'

/** Kết quả của một phiên Copilot (Figma C6): chờ duyệt, đã thực thi, đã từ chối, hoặc chỉ đọc (không có thao tác ghi). */
export function describeSession(state: ChatState): { tag: HistoryTag; kinds: string[]; pending: number } {
  const confirms = state.items.flatMap((i) =>
    i.kind === 'assistant' ? i.blocks.filter((b) => b.type === 'ConfirmAction').map(parseConfirmAction) : [],
  )
  if (confirms.length === 0) return { tag: 'READ_ONLY', kinds: [], pending: 0 }
  const stateOf = (id?: string) => (id ? state.actions[id] : undefined)
  // Đề xuất bị thay bằng bản mới (admin sửa) sẽ ở trạng thái expired: không tính là chờ duyệt.
  const pending = confirms.filter((c) => [undefined, 'failed', 'confirming'].includes(stateOf(c.actionId))).length
  const executed = confirms.some((c) => stateOf(c.actionId) === 'confirmed')
  const kinds = [...new Set(confirms.flatMap((c) => (c.kind ? [c.kind] : [])))]
  return { tag: pending > 0 ? 'AWAITING' : executed ? 'EXECUTED' : 'REJECTED', kinds, pending }
}

export type HistoryFilter = 'all' | 'write' | 'pending'

/** Lọc lịch sử: "Có thao tác ghi" = mọi phiên không phải chỉ đọc; "Chờ duyệt" = còn đề xuất chưa quyết. Kèm tìm theo chữ. */
export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter, query = ''): HistoryEntry[] {
  const needle = query.trim().toLowerCase()
  return entries.filter((e) => {
    if (filter === 'write' && e.tag === 'READ_ONLY') return false
    if (filter === 'pending' && e.tag !== 'AWAITING') return false
    if (!needle) return true
    return `${e.title} ${e.preview} ${(e.kinds ?? []).join(' ')}`.toLowerCase().includes(needle)
  })
}
