import { fetchEventSource } from '@microsoft/fetch-event-source'

import { API_BASE } from '@/api/config'
import { http } from '@/api/http'
import { ApiError } from '@/api/problem'
import { sessionStore } from '@/auth/token-store'
import { isRecord, str } from '@/blocks/payloads'

import type { ChatBlock, ChatMessage } from './chatApi'

export type DecisionDetails = { version: number; confirmPhrase?: string }
export type AdminFrame = { turnId: string; seq: number; type: string; payload: Record<string, unknown> }

export function readFrame(raw: string): AdminFrame {
  const event: unknown = JSON.parse(raw)
  if (
    !isRecord(event) ||
    typeof event.turn_id !== 'string' ||
    typeof event.seq !== 'number' ||
    typeof event.type !== 'string' ||
    !isRecord(event.payload)
  ) {
    throw new Error('Sự kiện chat không hợp lệ.')
  }
  return { turnId: event.turn_id, seq: event.seq, type: event.type, payload: event.payload }
}

export function adminBlock(data: unknown, id: string): ChatBlock | undefined {
  if (!isRecord(data) || typeof data.type !== 'string') return undefined
  const { type, ...fields } = data
  return { id, type: type as ChatBlock['type'], payload: isRecord(data.payload) ? data.payload : fields }
}

export async function streamAdminChat(
  path: string,
  body: object,
  onFrame: (frame: AdminFrame) => void,
  signal: AbortSignal,
) {
  const revision = sessionStore.revision
  let completed = false
  await fetchEventSource(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    openWhenHidden: true,
    signal,
    async onopen(response) {
      if (response.status === 401) sessionStore.expire(revision)
      if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => null))
      if (!response.headers.get('content-type')?.startsWith('text/event-stream'))
        throw new Error('Phản hồi chat không hợp lệ.')
    },
    onmessage(message) {
      if (!message.data || signal.aborted || sessionStore.revision !== revision) return
      const frame = readFrame(message.data)
      if (frame.type === 'turn.failed') throw new Error(str(frame.payload.code) || 'TURN_FAILED')
      onFrame(frame)
      if (frame.type === 'turn.completed') completed = true
    },
    onclose() {
      if (!completed) throw new Error('Kết nối chat đã gián đoạn.')
    },
    onerror(error) {
      throw error
    },
  })
}

export const createAdminConversation = () =>
  http<{ conversation_id: string }>('/chat/conversations', { method: 'POST' })

export async function uploadAdminSvg(file: File) {
  if (!file.name.toLowerCase().endsWith('.svg') || !file.size || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn SVG hợp lệ dung lượng tối đa 10 MiB.')
  }
  const body = new FormData()
  body.append('file', new Blob([file], { type: 'image/svg+xml' }), file.name)
  const { upload_id } = await http<{ upload_id: string }>('/chat/uploads', { method: 'POST', body })
  return upload_id
}

export const rejectAdminAction = (id: string, version: number) =>
  http(`/chat/actions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ command_id: crypto.randomUUID(), version }),
  })

export async function getAdminHistory(id: string) {
  const data = await http<{
    messages: { kind: string; content: Record<string, unknown>; seq: number }[]
    pending_action?: { action_id: string } | null
  }>(`/chat/conversations/${id}`)
  const messages: ChatMessage[] = data.messages.flatMap<ChatMessage>(({ kind, content, seq }) => {
    if (kind === 'USER') return [{ id: `h-${seq}`, role: 'user', text: str(content.text) }]
    if (kind !== 'ASSISTANT' && kind !== 'SYSTEM_EVENT') return []
    const blocks = Array.isArray(content.blocks)
      ? content.blocks.map((block, i) => adminBlock(block, `h-${seq}-${i}`))
      : []
    const result = blocks.find((block) => block?.type === ('ActionResult' as ChatBlock['type']))
    return [
      {
        id: `h-${seq}`,
        role: 'assistant',
        text: str(content.text) ?? str(result?.payload?.message),
        blocks: blocks.filter((block): block is ChatBlock => !!block && block !== result),
      },
    ]
  })
  return { messages, pendingId: data.pending_action?.action_id }
}
