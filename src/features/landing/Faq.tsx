import { ChevronsRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'

import { cn } from '@/lib/cn'

import { agentPath } from './agentLink'

const ITEMS = [
  {
    q: 'Ghế được giữ trong bao lâu?',
    a: 'Ghế được giữ 10 phút kể từ lúc bạn bấm giữ. Hết hạn mà chưa thanh toán, ghế tự trả lại cho người khác.',
  },
  {
    q: 'Vingo có tự trừ tiền của tôi không?',
    a: 'Không. Vingo chỉ đề xuất; giữ ghế hay thanh toán đều chờ bạn bấm “Đồng ý”. Bạn trả tiền trên trang VNPay.',
  },
  {
    q: 'Tôi có thể huỷ hoặc đổi ghế sau khi thanh toán?',
    a: 'Hiện chưa có hoàn tiền hay đổi ghế sau khi thanh toán, nên hãy kiểm tra kỹ ghế ở bước xác nhận.',
  },
  {
    q: 'Vé được gửi qua đâu?',
    a: 'Vé QR gửi qua email và xem được trong mục “Vé của tôi”, sau khi VNPay xác nhận thanh toán.',
  },
]

/** Accordion: mở bằng chiều cao 250ms ease-out, dấu + xoay thành −, mỗi lúc chỉ mở một câu (Figma motion spec #8). */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  const base = useId()
  return (
    <section
      aria-labelledby="faq-title"
      className="flex flex-col gap-10 px-5 py-16 sm:px-8 lg:flex-row lg:gap-16 lg:px-[calc(var(--lp-gutter)+4rem)] lg:py-24"
    >
      <div className="flex shrink-0 flex-col items-start gap-5 lg:w-[440px]">
        <p className="type-mono-label text-ink-secondary">{'// Câu hỏi thường gặp'}</p>
        <h2 id="faq-title" className="max-w-[440px] type-h1">
          Mọi điều bạn cần biết trước khi đặt vé.
        </h2>
        <p className="max-w-[380px] type-body-m text-ink-secondary">
          Không tìm thấy câu trả lời? Hỏi thẳng Vingo, nó đọc được đơn hàng của bạn.
        </p>
        <Link
          to={agentPath()}
          className="group relative flex h-[54px] items-center rounded-[14px] bg-ink pr-6 pl-[73px] type-body-m-strong text-on-ink"
        >
          {/* Hover/focus: ô trắng trượt sang mép phải, chữ dịch trái đúng bằng phần ô trắng nhường lại. */}
          <span
            aria-hidden
            className="absolute top-[5px] left-[5px] flex h-11 w-12 items-center justify-center rounded-[10px] bg-surface text-ink transition-[left] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-safe:group-hover:left-[calc(100%-53px)] motion-safe:group-focus-visible:left-[calc(100%-53px)]"
          >
            <ChevronsRight className="size-5" />
          </span>
          <span className="transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-safe:group-hover:-translate-x-[49px] motion-safe:group-focus-visible:-translate-x-[49px]">
            Hỏi Vingo
          </span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {ITEMS.map((it, i) => {
          const isOpen = open === i
          const panel = `${base}-p${i}`
          const btn = `${base}-b${i}`
          return (
            <div key={it.q} className={cn('rounded-[16px] bg-surface px-6 py-[22px]', !isOpen && 'border border-line')}>
              <h3>
                <button
                  id={btn}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <span className="type-h4 text-ink">{it.q}</span>
                  <span
                    data-open={isOpen}
                    aria-hidden
                    className={cn(
                      'lp-acc-icon relative flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-250',
                      isOpen ? 'bg-ink text-on-ink' : 'bg-canvas text-ink',
                    )}
                  >
                    <span className="absolute h-0.5 w-3 rounded-full bg-current" />
                    <span className="lp-acc-bar lp-acc-bar-v absolute h-3 w-0.5 rounded-full bg-current" />
                  </span>
                </button>
              </h3>
              <section id={panel} aria-labelledby={btn} data-open={isOpen} className="lp-acc-body">
                <div className="overflow-hidden">
                  <p className="max-w-[640px] pt-3 type-body-m text-ink-secondary">{it.a}</p>
                </div>
              </section>
            </div>
          )
        })}
      </div>
    </section>
  )
}
