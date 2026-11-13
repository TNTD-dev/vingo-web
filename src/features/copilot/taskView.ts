import { blockView } from '@/blocks/adminPayloads'
import { internalAdminPath, parseConfirmAction, root, str } from '@/blocks/payloads'
import type { ChatBlock } from '@/api/generated/model'
import type { ChatState } from '@/features/chat/chatReducer'

/** Việc Copilot đang làm, suy ra từ block trong hội thoại (contract chưa có sự kiện bước tool). */
export type TaskKind = 'REPORT' | 'RESOLVE_REVIEW' | 'CREATE_SHOWTIME' | 'BLOCK_SEATS' | 'OTHER'
export type TaskStatus = 'DRAFT' | 'AWAITING' | 'DONE' | 'REJECTED' | 'EXPIRED'
export type TaskStep = { key: string; title: string; code: string; status: 'done' | 'active' | 'todo' }
export type TaskView = {
  kind: TaskKind
  title: string
  status: TaskStatus
  rows: { label: string; value: string }[]
  steps: TaskStep[]
  open: { label: string; to: string; hint: string }
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  DRAFT: 'NHÁP',
  AWAITING: 'CHỜ DUYỆT',
  DONE: 'XONG',
  REJECTED: 'ĐÃ TỪ CHỐI',
  EXPIRED: 'HẾT HẠN',
}
export const taskStatusLabel = (s: TaskStatus) => STATUS_LABEL[s]

/** Bước cố định theo loại việc (tên tool của Vingo agent theo Figma C2–C5). `gate` = bước chờ admin duyệt. */
const TEMPLATE: Record<TaskKind, { steps: { title: string; code: string }[]; gate: number }> = {
  REPORT: {
    steps: [
      { title: 'Lấy số liệu', code: 'GET_METRICS' },
      { title: 'Trình bày kết quả', code: '—' },
    ],
    gate: -1,
  },
  RESOLVE_REVIEW: {
    steps: [
      { title: 'Lấy đơn cần duyệt', code: 'LIST_ORDERS' },
      { title: 'Kiểm tra ghế & tiền', code: 'GET_AVAILABILITY' },
      { title: 'Chờ bạn duyệt', code: 'RESOLVE_REVIEW' },
      { title: 'Gửi vé cho khách', code: 'RESEND_TICKET' },
    ],
    gate: 2,
  },
  CREATE_SHOWTIME: {
    steps: [
      { title: 'Sao chép cấu hình suất cũ', code: 'GET_EVENT' },
      { title: 'Chọn sơ đồ đã publish', code: 'LIST_SEAT_LAYOUTS' },
      { title: 'Chờ bạn duyệt', code: 'CREATE_SHOWTIME' },
      { title: 'Đặt giá theo khu', code: 'PUT_ZONE_PRICES' },
    ],
    gate: 2,
  },
  BLOCK_SEATS: {
    steps: [
      { title: 'Đọc sơ đồ khu ghế', code: 'GET_SEATMAP' },
      { title: 'Chọn ghế liền nhau', code: '—' },
      { title: 'Chờ bạn duyệt', code: 'BLOCK_SEATS' },
      { title: 'Ghi audit', code: 'AUDIT_LOG' },
    ],
    gate: 2,
  },
  OTHER: { steps: [{ title: 'Chờ bạn duyệt', code: 'CONFIRM_ACTION' }], gate: 0 },
}

const OPEN: Record<TaskKind, { label: string; to: string }> = {
  REPORT: { label: 'Mở màn quản trị tương ứng', to: '/admin/reports' },
  RESOLVE_REVIEW: { label: 'Đơn hàng · NEEDS REVIEW', to: '/admin/orders' },
  CREATE_SHOWTIME: { label: 'Sự kiện & suất diễn', to: '/admin/events' },
  BLOCK_SEATS: { label: 'Sơ đồ ghế của suất', to: '/admin/events' },
  OTHER: { label: 'Màn quản trị', to: '/admin' },
}

export function kindOf(kind: string | undefined): TaskKind {
  return kind === 'RESOLVE_REVIEW' || kind === 'CREATE_SHOWTIME' || kind === 'BLOCK_SEATS' ? kind : 'OTHER'
}

function assistantBlocks(state: ChatState): ChatBlock[] {
  return state.items.flatMap((i) => (i.kind === 'assistant' ? i.blocks : []))
}

/** Panel "Việc đang làm": ConfirmAction mới nhất nếu có (thao tác ghi), không thì báo cáo (chỉ đọc). */
export function deriveTask(state: ChatState): TaskView | undefined {
  const blocks = assistantBlocks(state)
  const confirm = [...blocks].reverse().find((b) => b.type === 'ConfirmAction')
  if (confirm) {
    const c = parseConfirmAction(confirm)
    const kind = kindOf(c.kind)
    const tpl = TEMPLATE[kind]
    const st = c.actionId ? state.actions[c.actionId] : undefined
    const status: TaskStatus =
      st === 'confirmed'
        ? 'DONE'
        : st === 'rejected'
          ? 'REJECTED'
          : st === 'expired'
            ? 'EXPIRED'
            : kind === 'CREATE_SHOWTIME'
              ? 'DRAFT'
              : 'AWAITING'
    const steps = tpl.steps.map((s, i): TaskStep => {
      const stepStatus =
        status === 'DONE'
          ? 'done'
          : i < tpl.gate
            ? 'done'
            : i === tpl.gate && (status === 'AWAITING' || status === 'DRAFT')
              ? 'active'
              : 'todo'
      return { key: s.code + i, ...s, status: stepStatus }
    })
    return {
      kind,
      title: c.taskTitle ?? c.title,
      status,
      rows: c.summaryRows.length ? c.summaryRows : c.rows.slice(0, 3).map(({ label, value }) => ({ label, value })),
      steps,
      open: {
        label: OPEN[kind].label,
        to: c.adminUrl ?? OPEN[kind].to,
        hint: 'Chuyển về chế độ Quản trị, giữ nguyên lựa chọn.',
      },
    }
  }
  const reports = blocks.filter((b) => (b.type === 'StatCards' || b.type === 'Chart') && !blockView(b)).reverse()
  if (reports.length === 0) return undefined
  const tpl = TEMPLATE.REPORT
  // Tên việc / link có thể nằm ở StatCards hoặc Chart: lấy block mới nhất có khai báo.
  const pick = (key: string) => reports.map((b) => str(root(b)[key])).find(Boolean)
  return {
    kind: 'REPORT',
    title: pick('task_title') ?? 'Báo cáo',
    status: 'DONE',
    rows: [],
    steps: tpl.steps.map((s, i) => ({ key: s.code + i, ...s, status: 'done' })),
    open: {
      label: OPEN.REPORT.label,
      to: internalAdminPath(pick('admin_url')) ?? OPEN.REPORT.to,
      hint: 'Xem bản đầy đủ ở Báo cáo, giữ nguyên bộ lọc.',
    },
  }
}
