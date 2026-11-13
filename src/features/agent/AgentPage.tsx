import { useCallback, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import { ChatPage } from '@/features/chat/ChatPage'

import { AgentWelcome } from './AgentWelcome'
import { contextLabel, contextMessage, readContext, readInitialQuestion } from './handoff'
import { OrderPanel, OrderPill } from './OrderPanel'
import { deriveOrderPanel } from './orderView'

// Agent mode của buyer (Figma page 04, M1–M6): hội thoại + panel "Đơn đang làm" + lịch sử.
export default function AgentPage() {
  const loc = useLocation()
  const [params, setParams] = useSearchParams()
  const initialQuestion = useMemo(() => readInitialQuestion(loc.search), [loc.search])
  const ctx = useMemo(() => readContext(loc.state), [loc.state])
  const context = useMemo(
    () =>
      ctx
        ? {
            title: ctx.zone ? `Chọn ghế · ${ctx.eventTitle}` : ctx.eventTitle,
            label: contextLabel(ctx),
            message: contextMessage(ctx),
            info: { eventTitle: ctx.eventTitle, subtitle: ctx.showtimeLabel, zone: ctx.zone, seats: ctx.seats },
          }
        : undefined,
    [ctx],
  )

  // Dùng xong thì bỏ `?q=` và state khỏi URL để refresh không gửi lại.
  const handled = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete('q')
    setParams(next, { replace: true, state: null })
  }, [params, setParams])

  return (
    <ChatPage
      agent="buyer"
      historyKey="buyer"
      placeholder="Hỏi Vingo…"
      initialQuestion={initialQuestion}
      context={context}
      onInitialHandled={handled}
      welcome={(api) => <AgentWelcome {...api} />}
      side={({ state, setOpen }) => {
        const view = deriveOrderPanel(state)
        return {
          compact: view.stage === 'payment' || view.stage === 'paid',
          panel: <OrderPanel view={view} onCollapse={() => setOpen(false)} />,
          pill: <OrderPill view={view} onExpand={() => setOpen(true)} />,
        }
      }}
    />
  )
}
