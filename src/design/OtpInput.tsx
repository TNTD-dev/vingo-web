import { useRef } from 'react'

import { cn } from '@/lib/cn'

/** Ô nhập mã OTP 6 số (Figma B8/B15): mỗi ô một chữ số, tự nhảy ô, hỗ trợ dán cả mã. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  length?: number
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const set = (i: number, d: string) => {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, length))
  }

  return (
    <fieldset className="flex gap-2 sm:gap-[10px]">
      <legend className="sr-only">Mã OTP</legend>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Chữ số ${i + 1}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, '').slice(-1)
            set(i, c)
            if (c && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
            if (!text) return
            e.preventDefault()
            onChange(text)
            refs.current[Math.min(text.length, length - 1)]?.focus()
          }}
          className={cn(
            'h-16 min-w-0 flex-1 rounded-[12px] bg-surface text-center text-[28px] leading-none tracking-[-0.01em] text-foreground transition-shadow outline-none sm:max-w-14',
            'focus:ring-2 focus:ring-foreground',
            invalid && 'ring-2 ring-danger',
          )}
        />
      ))}
    </fieldset>
  )
}
