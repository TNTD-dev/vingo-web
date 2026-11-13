import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const REDUCED = '(prefers-reduced-motion: reduce)'

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof matchMedia === 'undefined') return () => undefined
    const mq = matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}

function useMedia(query: string, fallback = false) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => (typeof matchMedia === 'undefined' ? fallback : matchMedia(query).matches),
    () => fallback,
  )
}

/** Người dùng bật "giảm chuyển động" → tắt ghim, parallax, chạy vô tận, chữ tự gõ. */
export function usePrefersReducedMotion() {
  return useMedia(REDUCED)
}

/** Con trỏ cảm ứng (điện thoại): không tự focus ô chat để khỏi bật bàn phím. */
export function useCoarsePointer() {
  return useMedia('(pointer: coarse)')
}

/**
 * Hiện hiệu ứng vào khung: IntersectionObserver 20% hiển thị, chỉ chạy một lần (Figma motion spec).
 * Không có IntersectionObserver (test, trình duyệt cũ) → coi như đã vào khung.
 */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/** Như useInView nhưng báo cả khi ra khỏi khung (dùng cho ô chat CTA: vào giữa màn hình thì gõ). */
export function useVisible<T extends Element>(threshold = 0.6) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, visible] as const
}

/**
 * Tiến độ cuộn 0→1 của một phần tử, ghi vào CSS var `--p` (không re-render).
 * 0 khi mép trên phần tử chạm `startAt` (tỉ lệ chiều cao viewport từ trên), 1 khi mép dưới chạm `endAt`.
 * `enabled=false` → đặt `--p` = `fallback` rồi dừng (reduced-motion).
 */
export function useScrollProgress<T extends HTMLElement>(opts: {
  startAt?: number
  endAt?: number
  enabled: boolean
  fallback: number
}) {
  const ref = useRef<T>(null)
  const { startAt = 0.85, endAt = 0.4, enabled, fallback } = opts
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!enabled) {
      el.style.setProperty('--p', String(fallback))
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const start = vh * startAt
      const end = vh * endAt
      const p = (start - r.top) / Math.max(start - end + r.height, 1)
      el.style.setProperty('--p', String(Math.min(1, Math.max(0, p))))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [startAt, endAt, enabled, fallback])
  return ref
}
