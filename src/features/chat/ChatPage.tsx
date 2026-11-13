import { useState } from 'react'

import type { ChatBlock } from '@/api/generated/model'
import { useAuth } from '@/auth/auth-context'
import { BlockView } from '@/blocks/registry'
import { Button } from '@/design/ui/button'
import { Input } from '@/design/ui/input'
import { useMeStream, type MeStreamEvent } from '@/realtime/useMeStream'

type Turn = { text: string; blocks: ChatBlock[]; done: boolean }

/**
 * Khung chat dùng chung cho buyer và admin — dùng bởi features/agent và features/copilot.
 * Luồng: POST sendMessage (202) → câu trả lời về qua /me/stream: chat.delta / chat.block / chat.done.
 * Chưa nối createConversation/sendMessage — chỉ dựng bố cục và đọc stream.
 */
export function ChatPage({ agent }: { agent: 'buyer' | 'admin' }) {
  const { user } = useAuth()
  const [turn, setTurn] = useState<Turn | null>(null)
  const [draft, setDraft] = useState('')

  useMeStream((e: MeStreamEvent) => {
    if (!e.type.startsWith('chat.')) return
    const data = (e.data ?? {}) as { text?: string; block?: ChatBlock }
    setTurn((t) => {
      const cur = t && !t.done ? t : { text: '', blocks: [], done: false }
      if (e.type === 'chat.delta') return { ...cur, text: cur.text + (data.text ?? '') }
      if (e.type === 'chat.block' && data.block) return { ...cur, blocks: [...cur.blocks, data.block] }
      return { ...cur, done: true }
    })
  })

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-sm text-muted-foreground">
          {agent === 'buyer' ? 'Chat mua vé' : 'Admin Copilot'} — khung tạm, chờ thiết kế.
        </p>
        {turn && (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap">{turn.text}</p>
            {turn.blocks.map((b, i) => (
              <BlockView key={b.id ?? i} block={b} />
            ))}
          </div>
        )}
      </div>
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          setDraft('')
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={user ? 'Nhập tin nhắn…' : 'Đăng nhập để bắt đầu chat'}
          disabled={!user}
        />
        <Button type="submit" disabled={!user || !draft.trim()}>
          Gửi
        </Button>
      </form>
    </div>
  )
}
