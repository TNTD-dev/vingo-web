import type { ChatBlock, ChatMessage } from '@/api/generated/model'
import type { ActionState } from '@/blocks/types'

export type { ActionState }

/** Sự kiện SSE mà khung chat quan tâm (tập con của MeStreamEvent). */
export type ChatStreamEvent = { id?: string; type: string; data: unknown }

/** Thông tin đơn mang theo từ trang khác (chọn ghế → Vingo), để panel "Đơn đang làm" hiện ngay. */
export type ContextInfo = { eventTitle: string; subtitle?: string; zone?: string; seats: string[] }

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  /** Chip ngữ cảnh khi chuyển từ trang chọn ghế sang (Figma M1b). */
  | { kind: 'context'; id: string; label: string; info?: ContextInfo }
  | {
      kind: 'assistant'
      id: string
      text: string
      blocks: ChatBlock[]
      done: boolean
      /** Gợi ý trả lời nhanh, đi kèm chat.done (`data.quick_replies`) — đề xuất mở rộng contract. */
      quickReplies?: string[]
    }
  /** Mốc đơn/vé từ stream (đã giữ ghế, đã thanh toán…), hiện thành pill trong dòng hội thoại. */
  | { kind: 'event'; id: string; type: string; data: Record<string, unknown> }

/** Sự kiện đơn/vé từ /me/stream, dùng để đoán bước đang chạy và hiện pill trong chat. */
export type OrderEvent = { type: string; data: Record<string, unknown> }

export type ChatState = {
  conversationId?: string
  items: ChatItem[]
  /** Đã gửi tin, đang chờ agent trả lời xong (chat.done). */
  awaiting: boolean
  error?: string
  actions: Record<string, ActionState>
  orderEvents: OrderEvent[]
}

export const initialChatState: ChatState = { items: [], awaiting: false, actions: {}, orderEvents: [] }

export type ChatAction =
  | { type: 'reset'; conversationId?: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'userSent'; id: string; text: string }
  | { type: 'awaiting' }
  | { type: 'context'; id: string; label: string; info?: ContextInfo }
  | { type: 'event'; event: ChatStreamEvent }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'actionState'; actionId: string; state: ActionState }
  | { type: 'failed'; message: string }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const ORDER_EVENTS = new Set([
  'order.held',
  'order.paid',
  'order.expired',
  'order.needs_review',
  'payment.failed',
  'ticket.issued',
])

function upsertAssistant(
  items: ChatItem[],
  id: string,
  update: (cur: Extract<ChatItem, { kind: 'assistant' }>) => ChatItem,
) {
  const idx = items.findIndex((i) => i.kind === 'assistant' && i.id === id)
  if (idx === -1) return [...items, update({ kind: 'assistant', id, text: '', blocks: [], done: false })]
  return items.map((it, i) => (i === idx ? update(it as Extract<ChatItem, { kind: 'assistant' }>) : it))
}

function applyEvent(state: ChatState, event: ChatStreamEvent): ChatState {
  const data = isRecord(event.data) ? event.data : {}
  // Stream là của cả người dùng; nếu sự kiện ghi rõ cuộc hội thoại khác thì bỏ qua.
  const conv = typeof data.conversation_id === 'string' ? data.conversation_id : undefined
  if (conv && state.conversationId && conv !== state.conversationId) return state

  if (ORDER_EVENTS.has(event.type)) {
    return {
      ...state,
      orderEvents: [...state.orderEvents, { type: event.type, data }],
      items: [...state.items, { kind: 'event', id: event.id ?? `e-${state.items.length}`, type: event.type, data }],
    }
  }
  const messageId = typeof data.message_id === 'string' ? data.message_id : 'assistant-current'
  switch (event.type) {
    case 'chat.delta': {
      const text = typeof data.text === 'string' ? data.text : ''
      return { ...state, items: upsertAssistant(state.items, messageId, (m) => ({ ...m, text: m.text + text })) }
    }
    case 'chat.block': {
      const block = isRecord(data.block) ? (data.block as ChatBlock) : undefined
      if (!block) return state
      return {
        ...state,
        items: upsertAssistant(state.items, messageId, (m) => {
          // Sự kiện có thể trùng hoặc block cập nhật theo cùng id → thay thế, không nhân đôi.
          const i = block.id ? m.blocks.findIndex((b) => b.id === block.id) : -1
          const blocks = i === -1 ? [...m.blocks, block] : m.blocks.map((b, j) => (j === i ? block : b))
          return { ...m, blocks }
        }),
      }
    }
    case 'chat.done':
      return {
        ...state,
        awaiting: false,
        items: upsertAssistant(state.items, messageId, (m) => {
          const q = Array.isArray(data.quick_replies)
            ? data.quick_replies.filter((x): x is string => typeof x === 'string')
            : undefined
          return { ...m, done: true, quickReplies: q?.length ? q : m.quickReplies }
        }),
      }
    default:
      return state
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'reset':
      return { ...initialChatState, conversationId: action.conversationId }
    case 'conversation':
      return { ...state, conversationId: action.conversationId }
    case 'userSent':
      return {
        ...state,
        awaiting: true,
        error: undefined,
        items: [...state.items, { kind: 'user', id: action.id, text: action.text }],
      }
    case 'awaiting':
      return { ...state, awaiting: true, error: undefined }
    case 'context':
      return {
        ...state,
        items: [...state.items, { kind: 'context', id: action.id, label: action.label, info: action.info }],
      }
    case 'event':
      return applyEvent(state, action.event)
    case 'history':
      return {
        ...state,
        items: action.messages.map((m, i): ChatItem => {
          const id = m.id ?? `h-${i}`
          return m.role === 'user'
            ? { kind: 'user', id, text: m.text ?? '' }
            : { kind: 'assistant', id, text: m.text ?? '', blocks: m.blocks ?? [], done: true }
        }),
      }
    case 'actionState':
      return { ...state, actions: { ...state.actions, [action.actionId]: action.state } }
    case 'failed':
      return { ...state, awaiting: false, error: action.message }
  }
}
