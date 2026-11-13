import { useNavigate } from 'react-router'

import { agentPath } from './agentLink'
import { AskBar } from '@/design/AskBar'
import { useVisible } from '@/lib/hooks'
import { MascotLive } from '@/design/MascotLive'
import { EXAMPLE_PROMPTS } from './prompts'

/** CTA "Bạn muốn xem gì?": quầng lime thở, Vingo nhảy ăn mừng; vào giữa màn hình thì ô chat tự focus và gõ (spec #9). */
export function CtaSection() {
  const navigate = useNavigate()
  const [ref, visible] = useVisible<HTMLElement>(0.6)
  return (
    <section
      ref={ref}
      aria-labelledby="cta-title"
      className="relative mx-4 overflow-hidden rounded-[32px] bg-surface px-4 py-16 text-center sm:mx-6 sm:py-20 lg:py-[90px]"
    >
      <div
        aria-hidden
        className="lp-breathe pointer-events-none absolute top-[-8%] left-1/2 h-[75%] w-[90%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--vg-accent-agent)_55%,transparent),transparent)]"
      />
      <h2
        id="cta-title"
        className="relative mx-auto text-[56px] leading-none font-medium tracking-[-0.05em] sm:text-[88px] lg:text-[120px]"
      >
        Bạn muốn xem gì?
      </h2>
      <div className="relative mx-auto mt-8 flex max-w-[828px] flex-col items-center sm:mt-14">
        <MascotLive
          mood="celebrate"
          className="-mb-3 size-[96px] self-center sm:absolute sm:top-[-30px] sm:-left-[124px] sm:mb-0 sm:size-[144px]"
        />
        <AskBar
          size="cta"
          sentences={EXAMPLE_PROMPTS}
          idleText="Nói với Vingo…"
          typing={visible}
          focusOnTyping
          onSubmit={(q) => void navigate(agentPath(q))}
        />
        <p className="mt-5 type-body-m text-ink-secondary">Bạn luôn xem lại trước khi giữ ghế hay thanh toán.</p>
      </div>
    </section>
  )
}
