/**
 * Danh sách hội thoại cho panel "Lịch sử" (Figma M6).
 * Contract chưa có endpoint liệt kê hội thoại (chỉ tạo + đọc tin theo id), nên web giữ một chỉ mục nhẹ
 * (id, tiêu đề, đoạn trích, trạng thái) trong localStorage theo người dùng. Không lưu token hay nội dung tin đầy đủ.
 */
export const HISTORY_DAYS = 90
const MAX_ITEMS = 100

export type HistoryTag =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'QA'
  // Admin Copilot: kết quả của phiên (xem features/copilot/copilotHistory.ts)
  | 'EXECUTED'
  | 'AWAITING'
  | 'REJECTED'
  | 'READ_ONLY'

export type HistoryEntry = {
  id: string
  title: string
  preview: string
  tag: HistoryTag
  /** Copilot: loại thao tác ghi trong phiên (RESOLVE_REVIEW, BLOCK_SEATS…). */
  kinds?: string[]
  /** Copilot: số đề xuất đang chờ duyệt. */
  pending?: number
  /** ms epoch */
  updatedAt: number
}

const key = (userId: string, agent: string) => `vingo.chat-history.${agent}.${userId}`

export function loadHistory(userId: string, agent: string, now = Date.now()): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(key(userId, agent))
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : []
    const min = now - HISTORY_DAYS * 86_400_000
    return list
      .filter((e) => e && typeof e.id === 'string' && e.updatedAt >= min)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

function save(userId: string, agent: string, list: HistoryEntry[]) {
  try {
    localStorage.setItem(key(userId, agent), JSON.stringify(list.slice(0, MAX_ITEMS)))
  } catch {
    /* localStorage bị chặn: bỏ qua, lịch sử chỉ là tiện ích */
  }
}

export function upsertHistory(userId: string, agent: string, entry: HistoryEntry) {
  const rest = loadHistory(userId, agent).filter((e) => e.id !== entry.id)
  save(userId, agent, [entry, ...rest])
}

export function clearHistory(userId: string, agent: string) {
  try {
    localStorage.removeItem(key(userId, agent))
  } catch {
    /* bỏ qua */
  }
}

export type HistoryGroup = { label: string; entries: HistoryEntry[] }

/** Nhóm theo "Hôm nay / Hôm qua / Tuần trước / Cũ hơn" (giờ địa phương). */
export function groupHistory(entries: HistoryEntry[], now = Date.now()): HistoryGroup[] {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const today = startOfDay.getTime()
  const groups: HistoryGroup[] = [
    { label: 'Hôm nay', entries: [] },
    { label: 'Hôm qua', entries: [] },
    { label: 'Tuần trước', entries: [] },
    { label: 'Cũ hơn', entries: [] },
  ]
  for (const e of entries) {
    const idx =
      e.updatedAt >= today ? 0 : e.updatedAt >= today - 86_400_000 ? 1 : e.updatedAt >= today - 7 * 86_400_000 ? 2 : 3
    groups[idx]!.entries.push(e)
  }
  return groups.filter((g) => g.entries.length > 0)
}
