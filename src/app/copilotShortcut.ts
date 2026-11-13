import { useEffect } from 'react'
import { useNavigate } from 'react-router'

/** ⌘J (Mac) hoặc Ctrl+J: phím tắt vào/ra Copilot. Không bắt khi kèm Shift/Alt để khỏi đè phím tắt khác. */
export function isCopilotShortcut(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j'
}

/** Gắn ⌘J ở layout admin: `to` là nơi chuyển tới (từ quản trị → Copilot, từ Copilot → quản trị). */
export function useCopilotShortcut(to: string) {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCopilotShortcut(e)) return
      e.preventDefault()
      void navigate(to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, to])
}
