import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  adminBlock,
  createAdminConversation,
  getAdminHistory,
  rejectAdminAction,
  streamAdminChat,
  uploadAdminSvg,
  type AdminFrame,
  type DecisionDetails,
} from './adminChatTransport'
import { confirmAction, createConversation, listMessages, rejectAction, sendMessage } from './chatApi'
import { parseConfirmAction, str } from '@/blocks/payloads'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { useMeStream } from '@/realtime/useMeStream'

import { chatReducer, initialChatState, type ChatState, type ContextInfo } from './chatReducer'
import { upsertHistory, type HistoryEntry, type HistoryTag } from './history'

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
export type ChatOptions = {
  /** Gắn nhãn cho mục lịch sử (mặc định: nhãn đơn hàng của buyer). Copilot dùng nhãn kết quả thao tác ghi. */
  describe?: (state: ChatState) => Pick<HistoryEntry, 'tag'> & Partial<Pick<HistoryEntry, 'kinds' | 'pending'>>
  /** Sửa trên block (bảng, form, ghế) làm các ConfirmAction đang chờ hết hiệu lực. Admin Copilot bật. */
  supersedeOnEdit?: boolean
  adminProtocol?: boolean
}

export function useChat(agent: string, options: ChatOptions = {}) {
  const { describe, supersedeOnEdit = false, adminProtocol = false } = options
  const { user } = useAuth()
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const convRef = useRef<Promise<string> | undefined>(undefined)
  const seq = useRef(0)
  const activeStream = useRef<AbortController | undefined>(undefined)
  const visibleAction = useRef<{ action_id: string; version: number } | undefined>(undefined)
  useEffect(() => () => activeStream.current?.abort(), [user?.id])

  const receiveAdminFrame = useCallback((frame: AdminFrame) => {
    const { turnId, seq, type, payload } = frame
    const emit = (eventType: string, data: object) =>
      dispatch({ type: 'event', event: { type: eventType, data: { message_id: turnId, ...data } } })
    if (type === 'text.delta') emit('chat.delta', { text: payload.text })
    if (type === 'notice') emit('chat.delta', { text: `\n${str(payload.message) ?? str(payload.text) ?? ''}` })
    if (type === 'turn.completed') emit('chat.done', {})
    if (type !== 'block') return
    const block = adminBlock(payload, `${turnId}-${seq}`)
    if (!block) return
    if (String(block.type) === 'ActionResult') {
      emit('chat.delta', { text: str(block.payload?.message) ?? '' })
      const id = str(block.payload?.action_id)
      if (id) {
        dispatch({
          type: 'actionState',
          actionId: id,
          state: block.payload?.status === 'SUCCEEDED' ? 'confirmed' : 'failed',
        })
        if (visibleAction.current?.action_id === id) visibleAction.current = undefined
      }
    } else {
      if (block.type === 'ConfirmAction') {
        const { actionId, version } = parseConfirmAction(block)
        if (actionId && version) {
          dispatch({ type: 'supersede' })
          visibleAction.current = { action_id: actionId, version }
        }
      }
      emit('chat.block', { block })
    }
  }, [])

  const [streamReady, setStreamReady] = useState(false)
  useMeStream(
    (e) => dispatch({ type: 'event', event: e }),
    () => setStreamReady(true),
  )

  const ensureConversation = useCallback(() => {
    const create = adminProtocol
      ? () => createAdminConversation().then((value) => value.conversation_id)
      : () => createConversation().then((value) => value.id ?? '')
    convRef.current ??= create().then((id) => {
      dispatch({ type: 'conversation', conversationId: id })
      return id
    })
    convRef.current.catch(() => {
      convRef.current = undefined
    })
    return convRef.current
  }, [adminProtocol])

  const post = useCallback(
    async (body: Parameters<typeof sendMessage>[1], files: File[] = []) => {
      if (adminProtocol && activeStream.current) return
      const controller = adminProtocol ? new AbortController() : undefined
      if (controller) activeStream.current = controller
      try {
        const id = await ensureConversation()
        if (!controller) {
          await sendMessage(id, body)
          return
        }
        const uploadIds = []
        for (const file of files) {
          if (controller.signal.aborted) return
          uploadIds.push(await uploadAdminSvg(file))
        }
        if (controller.signal.aborted) return
        const text = body.text ?? body.block_event?.type ?? ''
        await streamAdminChat(
          `/chat/conversations/${id}/messages`,
          {
            command_id: crypto.randomUUID(),
            text,
            visible_action: visibleAction.current,
            ...(uploadIds.length ? { upload_ids: uploadIds } : {}),
          },
          receiveAdminFrame,
          controller.signal,
        )
      } catch (e) {
        if (!controller?.signal.aborted) dispatch({ type: 'failed', message: errorMessage(e) })
      } finally {
        if (activeStream.current === controller) activeStream.current = undefined
      }
    },
    [adminProtocol, ensureConversation, receiveAdminFrame],
  )

  const send = useCallback(
    (text: string, files: File[] = []) => {
      const t = text.trim()
      if (!t || !user || (adminProtocol && activeStream.current)) return
      dispatch({ type: 'userSent', id: `u-${++seq.current}`, text: t })
      void post({ text: t }, files)
    },
    [adminProtocol, user, post],
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
      if (supersedeOnEdit) dispatch({ type: 'supersede' })
      if (label) dispatch({ type: 'userSent', id: `u-${++seq.current}`, text: label })
      void post({ block_event: { block_id: blockId, type, payload } })
    },
    [user, post, supersedeOnEdit],
  )

  const showContext = useCallback((label: string, info?: ContextInfo) => {
    dispatch({ type: 'context', id: `c-${++seq.current}`, label, info })
  }, [])

  /** Chỉ gọi API khi người dùng bấm: đây là chỗ duy nhất thực thi thao tác ghi do agent đề xuất. */
  const decide = useCallback(
    async (actionId: string, decision: Decision, details?: DecisionDetails) => {
      if (adminProtocol && (!details || activeStream.current)) return
      const controller = adminProtocol ? new AbortController() : undefined
      if (controller) activeStream.current = controller
      dispatch({ type: 'actionState', actionId, state: 'confirming' })
      try {
        if (controller && details) {
          if (decision === 'confirm') {
            await streamAdminChat(
              `/chat/actions/${actionId}/confirm`,
              {
                command_id: crypto.randomUUID(),
                version: details.version,
                confirm_phrase: details.confirmPhrase,
              },
              receiveAdminFrame,
              controller.signal,
            )
            return
          }
          await rejectAdminAction(actionId, details.version)
          if (visibleAction.current?.action_id === actionId) visibleAction.current = undefined
        } else if (decision === 'confirm') await confirmAction(actionId)
        else await rejectAction(actionId)
        dispatch({ type: 'actionState', actionId, state: decision === 'confirm' ? 'confirmed' : 'rejected' })
      } catch (e) {
        // 409: action hết hạn hoặc đã xử lý ở nơi khác.
        if (!controller?.signal.aborted) {
          dispatch({
            type: 'actionState',
            actionId,
            state: isApiError(e, 'ACTION_STATE_INVALID') ? 'expired' : 'failed',
          })
        }
      } finally {
        if (activeStream.current === controller) activeStream.current = undefined
      }
    },
    [adminProtocol, receiveAdminFrame],
  )

  const resetAdmin = useCallback(() => {
    activeStream.current?.abort()
    activeStream.current = undefined
    visibleAction.current = undefined
  }, [])

  const newChat = useCallback(() => {
    resetAdmin()
    convRef.current = undefined
    dispatch({ type: 'reset' })
  }, [resetAdmin])

  const openConversation = useCallback(
    async (id: string) => {
      resetAdmin()
      const current = Promise.resolve(id)
      convRef.current = current
      dispatch({ type: 'reset', conversationId: id })
      try {
        if (adminProtocol) {
          const { messages, pendingId } = await getAdminHistory(id)
          if (convRef.current !== current) return
          dispatch({ type: 'history', messages })
          for (const item of messages)
            for (const block of item.blocks ?? []) {
              if (block.type !== 'ConfirmAction') continue
              const { actionId, version } = parseConfirmAction(block)
              if (!actionId) continue
              if (actionId === pendingId && version) visibleAction.current = { action_id: actionId, version }
              else dispatch({ type: 'actionState', actionId, state: 'expired' })
            }
          return
        }
        const page = await listMessages(id)
        // Contract không nói thứ tự trang: sắp theo created_at tăng dần để chắc chắn.
        const sorted = [...(page.data ?? [])].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
        dispatch({ type: 'history', messages: sorted })
      } catch {
        if (convRef.current === current) dispatch({ type: 'failed', message: 'Không tải được hội thoại này.' })
      }
    },
    [adminProtocol, resetAdmin],
  )

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
  const described = describe ? describe(state) : { tag: historyTag(state) }
  const { tag } = described
  const kindsKey = described.kinds?.join(',')
  const pending = described.pending
  useEffect(() => {
    if (!user?.id || !conversationId || !title) return
    upsertHistory(user.id, agent, {
      id: conversationId,
      title: title.slice(0, 60),
      preview: lastAssistant?.kind === 'assistant' ? lastAssistant.text.slice(0, 100) : '',
      tag,
      kinds: kindsKey ? kindsKey.split(',') : undefined,
      pending,
      updatedAt: Date.now(),
    })
  }, [user?.id, agent, conversationId, title, lastAssistant, tag, kindsKey, pending])

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
