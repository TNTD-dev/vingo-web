import { useEffect, useState } from 'react'

/** Số giây còn lại tới `expiresAtIso` (không âm). Giá trị sai thì 0. */
export function remainingSeconds(expiresAtIso: string, nowMs: number): number {
  const end = new Date(expiresAtIso).getTime()
  return Number.isFinite(end) ? Math.max(0, Math.ceil((end - nowMs) / 1000)) : 0
}

/** Số giây còn lại tới `iso` (không âm). Không có `iso` hoặc sai định dạng → undefined. */
export function secondsLeft(iso: string | undefined, now: number): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return undefined
  return Math.max(0, Math.ceil((t - now) / 1000))
}

/** 552 → "09:12". Quá một giờ thì ghi giờ: 3725 → "1:02:05". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
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
