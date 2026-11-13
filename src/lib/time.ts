const TZ = 'Asia/Ho_Chi_Minh'

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** API trả ISO 8601 UTC; hiển thị theo giờ Việt Nam. "2026-11-14T12:30:00Z" → "19:30 14/11/2026" */
export function formatDateTime(iso: string): string {
  const parts = Object.fromEntries(dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`
}
