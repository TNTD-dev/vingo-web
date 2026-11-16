import { Bento } from './Bento'
import { CtaSection } from './CtaSection'
import { DemoPinned } from './DemoPinned'
import { Faq } from './Faq'
import { FeaturedEvents } from './FeaturedEvents'
import { Hero } from './Hero'
import { LandingFooter } from './LandingFooter'
import { Statement } from './Statement'

import './landing.css'

// Landing (route `/`, Figma page 02 · Landing): Hero → Statement → Bento → Sự kiện nổi bật →
// Demo ghim → FAQ → CTA → Footer. Ô chat dẫn sang Agent mode `/vingo?q=…` (xem agentLink.ts).
export default function LandingPage() {
  return (
    <div className="lp w-full bg-canvas text-ink">
      <Hero />
      <Statement />
      <Bento />
      <FeaturedEvents />
      <DemoPinned />
      <div id="faq">
        <Faq />
      </div>
      <CtaSection />
      <LandingFooter />
      <p className="flex flex-col gap-1 px-5 py-6 type-caption text-ink-tertiary sm:flex-row sm:justify-between sm:px-12 lg:px-[calc(var(--lp-gutter)+3rem)]">
        <span>© 2026 Vingo. Đặt vé sự kiện qua chat.</span>
        <span>Thanh toán được bảo đảm bởi VNPay</span>
      </p>
    </div>
  )
}
