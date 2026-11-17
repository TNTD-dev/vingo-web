import { X } from 'lucide-react'
import { useSearchParams } from 'react-router'

/** Nhãn "đang lọc theo từ khoá" ở đầu trang Vé / Đơn hàng, bấm × để bỏ lọc (xoá ?q=). */
export function SearchChip() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q')
  if (!q) return null
  function clear() {
    const next = new URLSearchParams(params)
    next.delete('q')
    setParams(next, { replace: true })
  }
  return (
    <p className="flex w-fit max-w-full items-center gap-2 rounded-pill bg-surface py-1.5 pr-1.5 pl-4 type-caption text-ink-secondary">
      <span className="truncate">
        Đang lọc: <span className="text-foreground">{q}</span>
      </span>
      <button
        type="button"
        aria-label="Bỏ lọc"
        onClick={clear}
        className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-canvas text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </p>
  )
}
