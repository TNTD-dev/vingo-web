import { http } from '@/api/http'

/**
 * Chat đã bị bỏ khỏi contract schema v2 (sẽ thiết kế lại ở sprint 2), nên các kiểu và lời gọi
 * này viết tay tạm thời, không sinh từ yaml. Thay bằng client sinh khi contract chat quay lại.
 */
export const ChatBlockType = {
  SeatMap: 'SeatMap',
  OrderSummary: 'OrderSummary',
  PaymentQR: 'PaymentQR',
  Ticket: 'Ticket',
  ConfirmAction: 'ConfirmAction',
  StatCards: 'StatCards',
  Chart: 'Chart',
  EventList: 'EventList',
} as const
export type ChatBlockType = (typeof ChatBlockType)[keyof typeof ChatBlockType]

export type ChatBlock = {
  id?: string
  type?: ChatBlockType
  payload?: Record<string, unknown>
}

export type ChatMessage = {
  id?: string
  role?: 'user' | 'assistant'
  text?: string
  blocks?: ChatBlock[]
  created_at?: string
}

export type Conversation = { id?: string; agent?: 'BUYER_AGENT' | 'ADMIN_COPILOT'; created_at?: string }

export type SendMessageBody = {
  text?: string
  block_event?: { block_id?: string; type?: string; payload?: Record<string, unknown> }
}

export const createConversation = () => http<Conversation>('/chat/conversations', { method: 'POST' })

export const listMessages = (conversationId: string) =>
  http<{ data?: ChatMessage[]; next_cursor?: string | null }>(`/chat/conversations/${conversationId}/messages`)

export const sendMessage = (conversationId: string, body: SendMessageBody) =>
  http<{ message_id?: string }>(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const confirmAction = (actionId: string) => http<void>(`/chat/actions/${actionId}/confirm`, { method: 'POST' })

export const rejectAction = (actionId: string) => http<void>(`/chat/actions/${actionId}/reject`, { method: 'POST' })
