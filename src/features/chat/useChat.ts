import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  confirmAction,
  createConversation,
  listMessages,
  rejectAction,
  sendMessage,
} from '@/api/generated/endpoints/chat/chat'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { useMeStream } from '@/realtime/useMeStream'

import { chatReducer, initialChatState, type ChatState, type ContextInfo } from './chatReducer'
import { upsertHistory, type HistoryTag } from './history'

export type Decision = 'confirm' | 'reject'

/** Gắn nhãn trạng thái cho mục lịch sử từ nội dung hội thoại. */
export function historyTag(state: ChatState): HistoryTag {
  const last = state.orderEvents.at(-1)?.type
  if (last === 'order.paid' || last === 'ticket.issued') return 'PAID'
  if (last === 'order.expired') return 'EXPIRED'
  const blocks = state.items.flatMap((i) => (i.kind === 'assistant' ? i.blocks : []))
  if (blocks.some((b) => b.type === 'PaymentQR')) return 'PENDING'
  if (blocks.some((b) => b.type === 'ConfirmAction' || b.type === 'SeatMap')) return 'DRAFT'
  return 'QA'
}

function errorMessage(e: unknown): string {
  if (isApiError(e, 'RATE_LIMITED')) return 'Bạn gửi hơi nhanh, thử lại sau ít giây nhé.'
  if (isApiError(e) && e.status === 401) return 'Phiên đăng nhập đã hết, hãy đăng nhập lại.'
  return 'Không gửi được tin nhắn, thử lại nhé.'
}

/**
 * Trạng thái hội thoại + thao tác gửi/duyệt. Luồng (contract): POST sendMessage trả 202,
 * câu trả lời về qua /me/stream (chat.delta → chat.block → chat.done). Người dùng chưa đăng nhập thì chỉ xem,
 * không mở stream và không gửi được.
 */
export function useChat(agent: string) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const convRef = useRef<Promise<string> | undefined>(undefined)
  const seq = useRef(0)

  const [streamReady, setStreamReady] = useState(false)
  useMeStream(
    (e) => dispatch({ type: 'event', event: e }),
    () => setStreamReady(true),
  )

  const ensureConversation = useCallback(() => {
    convRef.current ??= createConversation().then((c) => {
      const id = c.id ?? ''
      dispatch({ type: 'conversation', conversationId: id })
      return id
    })
    convRef.current.catch(() => {
      convRef.current = undefined
    })
    return convRef.current
  }, [])

  const post = useCallback(
    async (body: Parameters<typeof sendMessage>[1]) => {
      try {
        const id = await ensureConversation()
        await sendMessage(id, body)
      } catch (e) {
        dispatch({ type: 'failed', message: errorMessage(e) })
      }
    },
    [ensureConversation],
  )

  const send = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t || !user) return
      dispatch({ type: 'userSent', id: `u-${++seq.current}`, text: t })
      void post({ text: t })
    },
    [user, post],
  )

  /** Gửi tin cho agent mà không hiện thành bong bóng của người dùng (vd ngữ cảnh từ trang chọn ghế). */
  const sendHidden = useCallback(
    (text: string) => {
      if (!user) return
      dispatch({ type: 'awaiting' })
      void post({ text })
    },
    [user, post],
  )

  /** Thao tác trên block (chọn ghế, chọn trận…) gửi về agent. */
  const sendBlockEvent = useCallback(
    (blockId: string | undefined, type: string, payload: Record<string, unknown>, label?: string) => {
      if (!user) return
      if (label) dispatch({ type: 'userSent', id: `u-${++seq.current}`, text: label })
      void post({ block_event: { block_id: blockId, type, payload } })
    },
    [user, post],
  )

  const showContext = useCallback((label: string, info?: ContextInfo) => {
    dispatch({ type: 'context', id: `c-${++seq.current}`, label, info })
  }, [])

  /** Chỉ gọi API khi người dùng bấm: đây là chỗ duy nhất thực thi thao tác ghi do agent đề xuất. */
  const decide = useCallback(async (actionId: string, decision: Decision) => {
    dispatch({ type: 'actionState', actionId, state: 'confirming' })
    try {
      if (decision === 'confirm') await confirmAction(actionId)
      else await rejectAction(actionId)
      dispatch({ type: 'actionState', actionId, state: decision === 'confirm' ? 'confirmed' : 'rejected' })
    } catch (e) {
      // 409: action hết hạn hoặc đã xử lý ở nơi khác.
      dispatch({ type: 'actionState', actionId, state: isApiError(e, 'ACTION_STATE_INVALID') ? 'expired' : 'failed' })
    }
  }, [])

  const newChat = useCallback(() => {
    convRef.current = undefined
    dispatch({ type: 'reset' })
  }, [])

  const openConversation = useCallback(async (id: string) => {
    convRef.current = Promise.resolve(id)
    dispatch({ type: 'reset', conversationId: id })
    try {
      const page = await listMessages(id)
      // Contract không nói thứ tự trang: sắp theo created_at tăng dần để chắc chắn.
      const sorted = [...(page.data ?? [])].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      dispatch({ type: 'history', messages: sorted })
    } catch {
      dispatch({ type: 'failed', message: 'Không tải được hội thoại này.' })
    }
  }, [])

  // Cập nhật chỉ mục lịch sử khi hội thoại có nội dung.
  const { conversationId, items } = state
  const firstUser = items.find((i) => i.kind === 'user')
  const ctxItem = items.find((i) => i.kind === 'context')
  const title =
    firstUser?.kind === 'user'
      ? firstUser.text
      : ctxItem?.kind === 'context' && ctxItem.info
        ? `Chọn ghế · ${ctxItem.info.eventTitle}`
        : undefined
  const lastAssistant = [...items].reverse().find((i) => i.kind === 'assistant')
  const tag = historyTag(state)
  useEffect(() => {
    if (!user?.id || !conversationId || !title) return
    upsertHistory(user.id, agent, {
      id: conversationId,
      title: title.slice(0, 60),
      preview: lastAssistant?.kind === 'assistant' ? lastAssistant.text.slice(0, 100) : '',
      tag,
      updatedAt: Date.now(),
    })
  }, [user?.id, agent, conversationId, title, lastAssistant, tag])

  return {
    state,
    send,
    sendHidden,
    sendBlockEvent,
    showContext,
    decide,
    newChat,
    openConversation,
    canSend: !!user,
    streamReady,
  }
}
