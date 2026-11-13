import { ArrowUp, Mic } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'

import { IconSweep } from '@/design/IconSweep'
import { MascotAvatar } from '@/design/MascotAvatar'
import { cn } from '@/lib/cn'

type Props = {
  onSend: (text: string) => void
  onTypingChange?: (typing: boolean) => void
  placeholder: string
  /** Đang chờ agent trả lời: vẫn gõ được nhưng chưa gửi tiếp. */
  busy?: boolean
  /** Chưa đăng nhập: xem được, không gửi được. */
  canSend: boolean
  className?: string
}

/** Ô nhập chat (Figma ChatInput 10:376) + dòng cam kết "chỉ giữ ghế khi bạn bấm đồng ý". */
export function ChatInput({ onSend, onTypingChange, placeholder, busy, canSend, className }: Props) {
  const [value, setValue] = useState('')
  const loc = useLocation()

  const change = (v: string) => {
    setValue(v)
    onTypingChange?.(v.length > 0)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSend || busy || !value.trim()) return
    onSend(value)
    change('')
  }

  return (
    <div className={cn('w-full max-w-[760px]', className)}>
      <form
        onSubmit={submit}
        className="flex items-center gap-2.5 rounded-[22px] border border-line bg-surface p-2.5 pl-3 shadow-float transition-[border-color,box-shadow] duration-200 focus-within:border-agent focus-within:shadow-agent-glow sm:gap-3.5"
      >
        <MascotAvatar className="size-10 sm:size-12" />
        <input
          value={value}
          onChange={(e) => change(e.target.value)}
          maxLength={4000}
          disabled={!canSend}
          aria-label="Nhắn Vingo"
          autoComplete="off"
          enterKeyHint="send"
          placeholder={canSend ? placeholder : 'Đăng nhập để chat với Vingo'}
          className="min-w-0 flex-1 bg-transparent text-base font-light tracking-[0.02em] text-ink outline-none placeholder:text-ink-tertiary disabled:cursor-not-allowed"
        />
        <kbd className="hidden rounded-[8px] bg-canvas px-2 py-1 type-mono-small text-ink-tertiary md:block">⌘K</kbd>
        <button
          type="button"
          disabled
          title="Nhập bằng giọng nói: sắp có"
          aria-label="Nhập bằng giọng nói (sắp có)"
          className="hidden size-12 items-center justify-center rounded-[14px] bg-canvas text-ink sm:flex"
        >
          <Mic className="size-[18px]" />
        </button>
        <button
          type="submit"
          disabled={!canSend || busy || !value.trim()}
          aria-label="Gửi cho Vingo"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-ink text-agent transition-transform duration-150 enabled:hover:scale-105 disabled:opacity-100 sm:size-12"
        >
          <IconSweep direction="up" className="size-full rounded-[14px]">
            <ArrowUp className="size-5" />
          </IconSweep>
        </button>
      </form>
      <p className="mt-2 text-center type-caption text-ink-tertiary">
        {canSend ? (
          'Vingo chỉ giữ ghế hay tạo thanh toán khi bạn bấm đồng ý.'
        ) : (
          <>
            <Link
              to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
              className="text-ink underline underline-offset-2"
            >
              Đăng nhập
            </Link>{' '}
            để nhắn Vingo, giữ ghế và thanh toán.
          </>
        )}
      </p>
    </div>
  )
}
