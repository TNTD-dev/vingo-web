import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { AGENT_PATH } from '@/features/landing/agentLink'
import { MascotLive } from '@/design/MascotLive'
import { cn } from '@/lib/cn'

import { isLauncherHidden } from './launcherRoutes'
import './vingo-launcher.css'

/*
 * Vingo Launcher — Figma: Design System › Vingo Launcher (Nghỉ / Nhún / Mời / Hover).
 * Mascot nổi góc phải dưới các màn buyer, thay công tắc "Tự đặt | Vingo" trên AppNav. Bấm → Agent mode.
 * Lần đầu trong phiên: hiện bong bóng mời 4s rồi thu về; rê chuột / focus thì hiện lại.
 */

const INVITE_MS = 4000
const SEEN_KEY = 'vingo-launcher-invited'

function invitedThisSession(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // sessionStorage bị chặn: vẫn mời, chỉ là không nhớ được.
  }
  return false
}

export function VingoLauncher() {
  const { pathname } = useLocation()
  const [inviting, setInviting] = useState(() => !invitedThisSession())
  const [hover, setHover] = useState(false)

  useEffect(() => {
    if (!inviting) return
    const t = setTimeout(() => setInviting(false), INVITE_MS)
    return () => clearTimeout(t)
  }, [inviting])

  if (isLauncherHidden(pathname)) return null

  const open = inviting || hover
  return (
    <Link
      to={AGENT_PATH}
      aria-label="Mở Vingo — để Vingo đặt vé giúp bạn"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="group fixed right-3 bottom-3 z-40 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:right-6 sm:bottom-6"
    >
      <span
        aria-hidden
        data-open={open}
        className={cn(
          'vl-bubble absolute right-[calc(100%-6px)] bottom-[68px] flex flex-col gap-0.5 rounded-[18px] rounded-br-[4px] bg-ink px-4 py-3 text-on-ink shadow-float',
          !open && 'pointer-events-none',
        )}
      >
        <span className="type-body-m-strong whitespace-nowrap">{hover ? 'Mở Vingo →' : 'Để Vingo đặt cho nè!'}</span>
        <span className="type-caption whitespace-nowrap text-on-ink-secondary">
          {hover ? 'Chuyển sang chế độ chat' : 'Nói một câu, Vingo lo phần còn lại'}
        </span>
      </span>
      <span className="relative flex size-[88px] flex-col items-center sm:size-24">
        <span className="vl-hop block size-full">
          <MascotLive mood={open ? 'wave' : 'rest'} className="size-full" />
        </span>
        <span aria-hidden className="vl-shadow absolute -bottom-1 h-2 w-12 rounded-[50%] bg-ink/15" />
      </span>
    </Link>
  )
}
