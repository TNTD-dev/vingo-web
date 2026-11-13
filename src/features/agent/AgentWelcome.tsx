import { ArrowUpRight, Armchair, Search, Ticket } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { AskBar } from '@/design/AskBar'
import { MascotLive } from '@/design/MascotLive'
import { StatusPill } from '@/design/StatusPill'
import type { WelcomeApi } from '@/features/chat/ChatPage'

const SENTENCES = [
  '2 vé HAGL cuối tuần, khán đài B',
  'Cuối tuần này Sài Gòn có gì vui?',
  '2 ghế liền nhau gần sân khấu dưới 2 triệu',
  'Vé trận HAGL của tôi ở cổng nào?',
] as const

const SUGGESTIONS = [
  { icon: Search, title: 'Tìm & so sánh', sample: 'Cuối tuần này Sài Gòn có gì vui?' },
  { icon: Armchair, title: 'Chọn ghế giúp', sample: '2 ghế liền nhau gần sân khấu' },
  { icon: Ticket, title: 'Tra vé', sample: 'Vé trận HAGL của tôi ở cổng nào?' },
] as const

/** Màn chào (Figma M1): mascot, ô hỏi lớn, 3 thẻ gợi ý, chip tiếp tục đơn đang dở. */
export function AgentWelcome({ send, canSend, onTypingChange, resume, openConversation }: WelcomeApi) {
  const { user } = useAuth()
  const loc = useLocation()
  const name = user?.full_name?.trim().split(/\s+/).at(-1)
  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-7">
      <MascotLive mood="wave" className="size-[150px] sm:size-[204px]" />
      <h1 className="text-center type-h1">{name ? `Chào ${name}, mình là Vingo!` : 'Chào bạn, mình là Vingo!'}</h1>
      <p className="max-w-[560px] text-center type-body-l text-lg opacity-75">
        Nói mình nghe bạn muốn xem gì — mình tìm suất, chọn ghế, giữ chỗ giúp bạn.
      </p>
      <AskBar
        sentences={SENTENCES}
        idleText="Bạn muốn đi xem gì? Ví dụ “2 vé HAGL cuối tuần, khán đài B”"
        onSubmit={(q) => q.trim() && send(q)}
        onListeningChange={onTypingChange}
        className="max-w-[760px]"
      />
      {!canSend && (
        <p className="type-body-m text-ink-secondary">
          <Link
            to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
            className="text-ink underline underline-offset-2"
          >
            Đăng nhập
          </Link>{' '}
          để nhắn Vingo, giữ ghế và thanh toán.
        </p>
      )}
      <ul className="grid w-full max-w-[760px] gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map(({ icon: Icon, title, sample }) => (
          <li key={title}>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => send(sample)}
              className="flex h-full w-full flex-col items-start gap-2.5 rounded-lg border border-line bg-canvas/70 p-[18px] text-left backdrop-blur-md transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-70"
            >
              <span className="flex size-9 items-center justify-center rounded-sm bg-surface">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="type-body-m-strong">{title}</span>
              <span className="type-caption text-ink-secondary">“{sample}”</span>
            </button>
          </li>
        ))}
      </ul>
      {resume && (
        <button
          type="button"
          onClick={() => openConversation(resume.id)}
          className="inline-flex max-w-full items-center gap-2.5 rounded-pill border border-line bg-surface py-2 pr-4 pl-2"
        >
          <StatusPill label="PENDING" tone="warning" />
          <span className="truncate type-body-m">Tiếp tục: {resume.title}</span>
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
        </button>
      )}
    </div>
  )
}
