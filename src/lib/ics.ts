const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/[,;]/g, (c) => `\\${c}`)
    .replace(/\r?\n/g, '\\n')

/** Nội dung file .ics cho một suất diễn (giờ UTC). Thiếu giờ kết thúc thì mặc định 2 giờ. */
export function buildIcs(e: {
  uid: string
  title: string
  startIso: string
  endIso?: string
  location?: string
}): string {
  const end = e.endIso ?? new Date(new Date(e.startIso).getTime() + 2 * 3_600_000).toISOString()
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vingo//Web//VI',
    'BEGIN:VEVENT',
    `UID:${e.uid}@vingo`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startIso)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Tải file .ics về máy. */
export function downloadIcs(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
