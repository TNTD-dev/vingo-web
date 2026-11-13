import { History, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useAuth } from '@/auth/auth-context'
import { MascotAvatar } from '@/design/MascotAvatar'
import { cn } from '@/lib/cn'

import { ChatInput } from './ChatInput'
import { mascotView } from './chatView'
import type { ChatState, ContextInfo } from './chatReducer'
import { clearHistory, loadHistory, type HistoryEntry } from './history'
import { HistoryPanel } from './HistoryPanel'
import { MascotDock } from './MascotDock'
import { MessageList } from './MessageList'
import { useChat, type ChatOptions } from './useChat'

export type WelcomeApi = {
  send: (text: string) => void
  canSend: boolean
  onTypingChange: (typing: boolean) => void
  /** Hội thoại đang dở (chưa thanh toán) trong lịch sử, nếu có. */
  resume?: HistoryEntry
  openConversation: (id: string) => void
}

export type HistoryApi = {
  entries: HistoryEntry[]
  activeId?: string
  onOpen: (id: string) => void
  onNew: () => void
  onClose: () => void
}

export type SideApi = { state: ChatState; open: boolean; setOpen: (open: boolean) => void }
export type SideSlot = {
  /** Pill trên header khi panel thu gọn. */
  pill: ReactNode
  panel: ReactNode
  /** Chuyển true (vd tới bước thanh toán) thì panel tự thu gọn một lần. */
  compact?: boolean
}

type Props = {
  agent: 'buyer' | 'admin'
  /** Khoá lưu lịch sử trong localStorage (mặc định theo `agent`). */
  historyKey?: string
  placeholder?: string
  /** Màn trống trước tin đầu. Mặc định là một dòng chào trơn; Copilot sẽ truyền màn riêng. */
  welcome?: (api: WelcomeApi) => ReactNode
  /** Màn chào không nằm trong khung trắng, không có header (Figma M1: nổi trên nền ảnh sân). */
  bareWelcome?: boolean
  /** Panel phụ bên phải (buyer: "Đơn đang làm"). Copilot có thể bỏ trống. */
  side?: (api: SideApi) => SideSlot
  /** Không hiện header ở màn chào nhưng vẫn giữ khung trắng (Figma C1). */
  hideWelcomeHeader?: boolean
  /** Thay panel lịch sử mặc định (Copilot: lọc theo thao tác ghi, nối sang audit). */
  historyPanel?: (api: HistoryApi) => ReactNode
  /** Gắn nhãn mục lịch sử (Copilot: kết quả thao tác ghi). */
  describeHistory?: ChatOptions['describe']
  /** Placeholder ô nhập sau tin đầu (mặc định "Nhắn Vingo…"). */
  followUpPlaceholder?: string
  /** Dòng cam kết dưới ô nhập. */
  inputNote?: string
  /** Mascot nổi cạnh ô nhập (mặc định bật; Figma màn admin không có). */
  mascotDock?: boolean
  /** Câu hỏi mở đầu (vd từ `?q=` của Landing), gửi một lần khi đã đăng nhập và stream đã mở. */
  initialQuestion?: string
  /** Ngữ cảnh từ trang khác (chọn ghế → Vingo). */
  context?: { title: string; label: string; message: string; info?: ContextInfo }
  /** Báo đã dùng xong câu mở đầu / ngữ cảnh để trang xoá khỏi URL. */
  onInitialHandled?: () => void
}

/**
 * Khung chat dùng chung (Figma page 04): header + dòng hội thoại + block + ô nhập + mascot.
 * Dùng bởi features/agent (buyer) và sau này features/copilot (admin), khác nhau ở `welcome`, `side`, `placeholder`.
 * Xem được khi chưa đăng nhập; gửi tin, giữ ghế thì phải đăng nhập.
 */
export function ChatPage({
  agent,
  historyKey = agent,
  placeholder = 'Nhắn Vingo…',
  welcome,
  bareWelcome = false,
  hideWelcomeHeader = false,
  historyPanel,
  describeHistory,
  followUpPlaceholder = 'Nhắn Vingo…',
  inputNote,
  mascotDock = true,
  side,
  initialQuestion,
  context,
  onInitialHandled,
}: Props) {
  const { user } = useAuth()
  const chat = useChat(historyKey, { describe: describeHistory, supersedeOnEdit: agent === 'admin' })
  const {
    state,
    send,
    sendHidden,
    sendBlockEvent,
    showContext,
    decide,
    newChat,
    openConversation,
    canSend,
    streamReady,
  } = chat
  const [typing, setTyping] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [rev, setRev] = useState(0)
  const [panelOpen, setPanelOpen] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(min-width: 1280px)').matches,
  )

  // Gửi câu mở đầu / ngữ cảnh đúng một lần, sau khi stream đã mở.
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current || !canSend || !streamReady) return
    if (context) {
      handled.current = true
      showContext(context.label, context.info)
      sendHidden(context.message)
      onInitialHandled?.()
    } else if (initialQuestion) {
      handled.current = true
      send(initialQuestion)
      onInitialHandled?.()
    }
  }, [canSend, streamReady, context, initialQuestion, send, sendHidden, showContext, onInitialHandled])

  // Chỉ mục lịch sử đọc từ localStorage; `rev` tăng khi cần đọc lại (mở panel, xoá lịch sử).
  const userId = user?.id
  const messageCount = state.items.length
  const entries = useMemo<HistoryEntry[]>(
    () => (userId ? loadHistory(userId, historyKey) : []),
    // rev và messageCount chỉ để đọc lại khi hội thoại đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, historyKey, rev, messageCount, state.conversationId],
  )
  const refreshHistory = () => setRev((r) => r + 1)

  const sideSlot = side?.({ state, open: panelOpen, setOpen: setPanelOpen })
  const compact = !!sideSlot?.compact
  const wasCompact = useRef(false)
  useEffect(() => {
    if (compact && !wasCompact.current) setPanelOpen(false)
    wasCompact.current = compact
  }, [compact])

  const started = state.items.length > 0 || state.awaiting
  // Không có màn chào riêng (Copilot chưa làm) thì luôn hiện ô nhập.
  const showInput = started || !welcome
  const ctxItem = state.items.find((i) => i.kind === 'context')
  const handoff = !!ctxItem && !state.items.some((i) => i.kind === 'user')
  const view = mascotView(state, { typing, handoff })
  const title =
    context?.title ??
    (ctxItem?.kind === 'context' && ctxItem.info ? `Chọn ghế · ${ctxItem.info.eventTitle}` : undefined) ??
    state.items.find((i) => i.kind === 'user')?.text ??
    'Vingo'
  const resume = useMemo(
    () => entries.find((e) => e.tag === 'PENDING' && e.id !== state.conversationId),
    [entries, state.conversationId],
  )
  const panelVisible = started && !!sideSlot && panelOpen
  const bare = bareWelcome && !started && !!welcome
  const headerHidden = bare || (hideWelcomeHeader && !started && !!welcome)

  const open = (id: string) => {
    void openConversation(id)
    setHistoryOpen(false)
  }

  return (
    <div
      className={cn(
        'relative mx-3 mb-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl sm:mx-8 sm:mb-6',
        !bare && 'bg-surface',
      )}
      data-agent={agent}
    >
      <header
        className={cn('flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-6', headerHidden && 'hidden')}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MascotAvatar state={view.state} className="size-10" />
          {started && <h1 className="truncate text-[15px] font-medium">{title}</h1>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {started && !panelOpen && sideSlot?.pill}
          {user && (
            <button
              type="button"
              aria-pressed={historyOpen}
              onClick={() => {
                refreshHistory()
                setHistoryOpen((v) => !v)
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 type-body-m',
                historyOpen ? 'bg-ink text-on-ink' : 'bg-canvas',
              )}
            >
              <History className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Lịch sử</span>
            </button>
          )}
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1.5 rounded-pill bg-canvas px-3.5 py-2 type-body-m"
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Mới</span>
          </button>
        </div>
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', panelVisible && 'xl:pr-[360px]')}>
        {started ? (
          <MessageList
            state={state}
            readOnly={!canSend}
            onBlockEvent={(blockId, type, payload, label) => sendBlockEvent(blockId, type, payload, label)}
            onDecide={(id, d) => void decide(id, d)}
            onQuickReply={send}
          />
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
            {welcome?.({ send, canSend, onTypingChange: setTyping, resume, openConversation: open })}
          </div>
        )}
      </div>

      {panelVisible && sideSlot.panel}
      {historyOpen &&
        (historyPanel ? (
          historyPanel({
            entries,
            activeId: state.conversationId,
            onOpen: open,
            onNew: () => {
              newChat()
              setHistoryOpen(false)
            },
            onClose: () => setHistoryOpen(false),
          })
        ) : (
          <HistoryPanel
            entries={entries}
            activeId={state.conversationId}
            onOpen={open}
            onNew={() => {
              newChat()
              setHistoryOpen(false)
            }}
            onClear={() => {
              if (user?.id) clearHistory(user.id, historyKey)
              refreshHistory()
            }}
            onClose={() => setHistoryOpen(false)}
          />
        ))}

      {showInput && (
        <div className="relative flex flex-col items-center px-4 pt-2 pb-4">
          <div className="relative w-full max-w-[760px]">
            {mascotDock && (
              <MascotDock
                state={view.state}
                bubble={view.bubble}
                className="absolute right-3 bottom-full z-30 hidden -translate-y-1 sm:flex"
              />
            )}
            <ChatInput
              onSend={send}
              onTypingChange={setTyping}
              placeholder={state.items.length > 0 ? followUpPlaceholder : placeholder}
              note={inputNote}
              busy={state.awaiting}
              canSend={canSend}
            />
          </div>
        </div>
      )}
    </div>
  )
}
