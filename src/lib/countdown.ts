/** Số giây còn lại tới `expiresAtIso` (không âm). */
export function remainingSeconds(expiresAtIso: string, nowMs: number): number {
  const end = new Date(expiresAtIso).getTime()
  return Number.isFinite(end) ? Math.max(0, Math.ceil((end - nowMs) / 1000)) : 0
}

/** 552 → "09:12". Quá một giờ thì ghi giờ: 3725 → "1:02:05". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}
