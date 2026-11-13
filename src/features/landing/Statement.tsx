import { usePrefersReducedMotion, useScrollProgress } from './hooks'

const TEXT = 'Một luồng, từ tìm sự kiện đến vé QR.'

/**
 * Câu tuyên bố: chữ sáng dần từ xám sang đen theo cuộn, từng từ một (Figma motion spec #4).
 * Giảm chuyển động → chữ đen sẵn.
 */
export function Statement() {
  const reduced = usePrefersReducedMotion()
  const ref = useScrollProgress<HTMLParagraphElement>({ startAt: 0.9, endAt: 0.45, enabled: !reduced, fallback: 1 })
  const words = TEXT.split(' ')
  return (
    <section className="px-5 pt-16 pb-6 sm:px-8 lg:px-16 lg:pt-24 lg:pb-8">
      <p ref={ref} className="max-w-[1100px] type-h1 leading-none tracking-[-0.04em] lg:text-[48px]">
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              // mỗi từ có một đoạn riêng của tiến độ 0→1
              color: `color-mix(in srgb, var(--vg-text-primary) calc(clamp(0, (var(--p, 1) * ${words.length} - ${i}), 1) * 100%), var(--vg-text-tertiary))`,
            }}
          >
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  )
}
