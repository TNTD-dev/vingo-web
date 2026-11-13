import { ChartColumn, CalendarDays, CreditCard, Lock } from 'lucide-react'

import { useAdminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useAuth } from '@/auth/auth-context'
import { AskBar } from '@/design/AskBar'
import { MascotLive } from '@/design/MascotLive'
import { StatusPill } from '@/design/StatusPill'
import type { WelcomeApi } from '@/features/chat/ChatPage'

const SENTENCES = [
  'Xử lý 4 đơn cần duyệt',
  'Tạo suất HAGL vòng 13, giống vòng 12',
  'Khoá 6 ghế khu A cho khách mời',
  'Doanh thu tuần này theo khu',
] as const

const SUGGESTIONS = [
  { icon: CreditCard, title: 'Duyệt đơn hàng loạt', sample: 'Xử lý 4 đơn NEEDS_REVIEW' },
  { icon: CalendarDays, title: 'Tạo suất diễn', sample: 'Tạo suất HAGL vòng 13, giống vòng 12' },
  { icon: Lock, title: 'Khoá ghế', sample: 'Khoá 6 ghế khu A cho khách mời' },
  { icon: ChartColumn, title: 'Báo cáo', sample: 'Doanh thu tuần này theo khu' },
] as const

/** Số đơn NEEDS_REVIEW (tối đa một trang); `more` khi còn trang sau. Đọc qua client sinh, không tự gọi URL. */
function useNeedsReview() {
  const q = useAdminListOrders({ status: 'NEEDS_REVIEW', limit: 50 })
  const count = q.data?.data?.length ?? 0
  return { count, more: !!q.data?.next_cursor }
}

/** Màn chào Copilot (Figma C1): mascot, ô giao việc, 4 thẻ việc hay làm, "Cần chú ý hôm nay". */
export function CopilotWelcome({ send, canSend, onTypingChange }: WelcomeApi) {
  const { user } = useAuth()
  const name = user?.full_name?.trim().split(/\s+/).at(-1)
  const review = useNeedsReview()
  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-7">
      <MascotLive mood="wave" className="size-[150px] sm:size-[190px]" />
      <h1 className="text-center type-h1">{name ? `Chào ${name}, hôm nay mình làm gì?` : 'Hôm nay mình làm gì?'}</h1>
      <AskBar
        sentences={SENTENCES}
        idleText="Giao việc cho Copilot… ví dụ “xử lý 4 đơn cần duyệt”"
        onSubmit={(q) => q.trim() && send(q)}
        onListeningChange={onTypingChange}
        className="max-w-[760px]"
      />
      <ul className="grid w-full max-w-[760px] grid-cols-2 gap-3 md:grid-cols-4">
        {SUGGESTIONS.map(({ icon: Icon, title, sample }) => (
          <li key={title}>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => send(sample)}
              className="flex h-full w-full flex-col items-start gap-2.5 rounded-lg bg-canvas p-[18px] text-left transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-70"
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
      {review.count > 0 && (
        <section aria-label="Cần chú ý hôm nay" className="w-full max-w-[760px] rounded-lg bg-canvas p-4 sm:p-5">
          <h2 className="type-mono-small text-ink-secondary uppercase">Cần chú ý hôm nay</h2>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => send(`Xử lý ${review.count} đơn NEEDS_REVIEW`)}
            className="mt-3 flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-left"
          >
            <StatusPill label={`${review.count}${review.more ? '+' : ''} NEEDS REVIEW`} tone="warning" />
            <span className="type-body-m text-ink-secondary">Tiền về sau hạn giữ ghế hoặc lệch số tiền</span>
          </button>
        </section>
      )}
    </div>
  )
}
