import gsap from 'gsap'

/** Số giây "ảo" của timeline; tiến độ cuộn (scrub) hoặc tự chạy một lần đều dùng chung timeline này. */
export const DEMO_DURATION = 10

/** Bước đang sáng ở thời điểm t (0 = TÌM … 4 = CÓ VÉ), khớp các mốc trong timeline bên dưới. */
export const DEMO_STEP_AT = [0, 3.4, 4.8, 6.2, 7.6] as const

/**
 * Timeline demo "một lượt đặt vé" (Figma motion spec #7):
 * tin nhắn → 3 bước tick lime → ghế mờ dần, D-14/D-15 sáng lime → nút "Đồng ý" gợn sóng →
 * vé bay ra xoay → pháo giấy + Vingo ăn mừng. Thanh 5 bước chạy theo.
 * DOM mặc định đã ở trạng thái cuối; mọi tween dùng `from` nên bỏ timeline đi là về đúng trạng thái cuối.
 */
export function buildDemoTimeline(root: HTMLElement): gsap.core.Timeline {
  const q = gsap.utils.selector(root)
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })

  tl.from(q('[data-demo="user"]'), { autoAlpha: 0, y: 20, duration: 0.8 }, 0)
  tl.from(q('[data-demo="assistant"]'), { autoAlpha: 0, y: 20, duration: 0.8 }, 0.8)

  q('[data-demo="tick"]').forEach((tick, i) => {
    tl.from(tick, { autoAlpha: 0, x: -12, duration: 0.5 }, 1.8 + i * 0.6)
    tl.from(
      tick.querySelector('[data-demo="tick-dot"]'),
      { scale: 0, duration: 0.4, ease: 'back.out(2)' },
      1.8 + i * 0.6,
    )
  })

  tl.from(q('[data-demo="seatcard"]'), { autoAlpha: 0, y: 24, duration: 0.8 }, 2.4)
  tl.from(q('[data-demo="seat-dim"]'), { opacity: 1, duration: 1, stagger: { each: 0.01, from: 'center' } }, 3.8)
  tl.from(
    q('[data-demo="seat-pick"]'),
    { backgroundColor: 'rgb(255 255 255)', boxShadow: '0 0 0 rgb(0 0 0 / 0)', duration: 0.6, stagger: 0.15 },
    4.4,
  )
  tl.from(q('[data-demo="seat-label"]'), { autoAlpha: 0, y: 10, duration: 0.4 }, 5)

  tl.from(q('[data-demo="consent"]'), { autoAlpha: 0.35, scale: 0.96, duration: 0.4 }, 5.2)
  tl.fromTo(
    q('[data-demo="ripple"]'),
    { scale: 0.3, autoAlpha: 0.9 },
    { scale: 1.6, autoAlpha: 0, duration: 0.8, ease: 'power1.out' },
    5.6,
  )

  tl.from(
    q('[data-demo="ticket"]'),
    { autoAlpha: 0, x: 140, y: 80, rotation: -18, scale: 0.7, duration: 1.4, ease: 'back.out(1.3)' },
    6.4,
  )
  tl.from(q('[data-demo="confetti"]'), { autoAlpha: 0, y: -60, rotation: 0, duration: 1, stagger: 0.1 }, 7.8)
  tl.from(q('[data-demo="mascot"]'), { autoAlpha: 0, y: 60, duration: 0.9, ease: 'back.out(1.6)' }, 8)

  // thanh 5 bước chạy theo
  const dots = q('[data-demo="step-dot"]')
  const lines = q('[data-demo="step-line"]')
  const labels = q('[data-demo="step-label"]')
  DEMO_STEP_AT.forEach((at, i) => {
    if (i === 0) return
    tl.from(lines[i - 1], { scaleX: 0, transformOrigin: 'left center', duration: 0.4, ease: 'none' }, at - 0.4)
    tl.from(dots[i], { opacity: 0.25, scale: 0.6, duration: 0.3 }, at)
    tl.from(labels[i], { opacity: 0.35, duration: 0.3 }, at)
  })

  tl.set({}, {}, DEMO_DURATION) // đệm cho timeline đúng 10s
  return tl
}
