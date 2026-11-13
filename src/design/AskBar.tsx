import { ArrowUp, Mic } from 'lucide-react'
import { IconSweep } from '@/design/IconSweep'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { cn } from '@/lib/cn'

import './vingo-motion.css'

import { useCoarsePointer, usePrefersReducedMotion } from '@/lib/hooks'
import { MascotLive } from './MascotLive'
import { TYPE_MS, typewriterStart, typewriterStep, typewriterText } from '@/lib/typewriter'

/** Placeholder tự gõ lần lượt 4 câu ví dụ (Figma motion spec #2). */
function useTypewriter(sentences: readonly string[], active: boolean) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) return
    let state = typewriterStart
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const next = typewriterStep(state, sentences)
      state = next.state
      setText(typewriterText(state, sentences))
      timer = setTimeout(tick, next.delay)
    }
    timer = setTimeout(tick, TYPE_MS)
    return () => clearTimeout(timer)
  }, [active, sentences])
  return active ? text : ''
}

type Props = {
  size?: 'hero' | 'cta'
  /** Câu ví dụ để gõ. */
  sentences: readonly string[]
  /** Placeholder tĩnh khi chưa gõ hoặc khi bật giảm chuyển động. */
  idleText: string
  /** Cho phép placeholder bắt đầu gõ (CTA: chỉ khi khối vào giữa màn hình). */
  typing?: boolean
  /** Tự focus ô chat khi `typing` chuyển sang true (bỏ qua trên màn cảm ứng). */
  focusOnTyping?: boolean
  onSubmit: (question: string) => void
  /** Báo khi người dùng đang gõ, để Vingo chuyển sang "Lắng nghe". */
  onListeningChange?: (listening: boolean) => void
  className?: string
}

/** Ô chat Landing (Figma AskBar 24:24): gõ hoặc bấm Enter → vào Agent mode kèm câu đó. */
export function AskBar({
  size = 'hero',
  sentences,
  idleText,
  typing = true,
  focusOnTyping = false,
  onSubmit,
  onListeningChange,
  className,
}: Props) {
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const animate = typing && !reduced
  const typed = useTypewriter(sentences, animate)
  const placeholder = animate && typed ? typed : idleText
  const empty = value.length === 0
  const cta = size === 'cta'

  useEffect(() => {
    if (focusOnTyping && typing && !coarse) inputRef.current?.focus({ preventScroll: true })
  }, [focusOnTyping, typing, coarse])

  const change = (next: string) => {
    setValue(next)
    onListeningChange?.(next.length > 0)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[22px] border border-line bg-surface p-2.5 pl-3 shadow-float transition-[border-color,box-shadow] duration-200 sm:gap-3.5',
        'focus-within:border-agent focus-within:shadow-agent-glow',
        cta ? 'max-w-[828px] rounded-[25px] sm:gap-4' : 'max-w-[720px]',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative shrink-0 overflow-hidden rounded-full bg-agent/35',
          cta ? 'size-12 sm:size-[55px]' : 'size-10 sm:size-12',
        )}
      >
        <MascotLive className="absolute top-[-26px] left-[-24px] w-[96px] max-w-none sm:top-[-30px] sm:left-[-28px] sm:w-[112px]" />
      </span>
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => change(e.target.value)}
          maxLength={500}
          aria-label="Hỏi Vingo"
          autoComplete="off"
          enterKeyHint="send"
          className={cn(
            'w-full bg-transparent font-light tracking-[0.02em] text-ink outline-none',
            cta ? 'text-base sm:text-[18.4px]' : 'text-base',
          )}
        />
        {empty && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center overflow-hidden font-light tracking-[0.02em] whitespace-nowrap text-ink-tertiary',
              cta ? 'text-base sm:text-[18.4px]' : 'text-base',
            )}
          >
            <span className="truncate">{placeholder}</span>
            {animate && typed && <span className="vg-caret ml-px inline-block h-[1.1em] w-px bg-ink-tertiary" />}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <kbd className="hidden rounded-[8px] bg-canvas px-2 py-1 type-mono-small text-ink-tertiary md:block">⌘K</kbd>
        <button
          type="button"
          disabled
          title="Nhập bằng giọng nói: sắp có"
          aria-label="Nhập bằng giọng nói (sắp có)"
          className={cn(
            'hidden items-center justify-center rounded-[14px] bg-canvas text-ink disabled:opacity-100 sm:flex',
            cta ? 'size-[55px]' : 'size-12',
          )}
        >
          <Mic className="size-[18px]" />
        </button>
        <button
          type="submit"
          aria-label="Gửi cho Vingo"
          className={cn(
            'group flex items-center justify-center rounded-[14px] bg-ink text-agent transition-transform duration-150 hover:scale-105',
            cta ? 'size-11 sm:size-[55px]' : 'size-11 sm:size-12',
          )}
        >
          <IconSweep direction="up" className="size-full rounded-[14px]">
            <ArrowUp className="size-5" />
          </IconSweep>
        </button>
      </div>
    </form>
  )
}
