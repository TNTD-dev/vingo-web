import { useEffect, useState } from 'react'

/** Số giây còn lại tới `iso` (không âm). Không có `iso` → undefined. */
export function secondsLeft(iso: string | undefined, now: number): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return Math.max(0, Math.ceil((t - now) / 1000))
}

/** 522 → "08:42" */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Đếm ngược theo giây tới hạn `iso` (giữ ghế, thanh toán). */
export function useCountdown(iso: string | undefined): number | undefined {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [iso])
  return secondsLeft(iso, now)
}
