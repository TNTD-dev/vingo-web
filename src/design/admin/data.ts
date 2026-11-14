import { useQuery } from '@tanstack/react-query'
import { listAdminEvents } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { AdminEventSummary } from '@/api/generated/model'
import { useState } from 'react'
import { formatDateTime, vnDate, vnStartOfDay } from '@/lib/time'

export function useCursor(key: string) {
  const [state, setState] = useState<{ key: string; stack: string[] }>({ key, stack: [] })
  const stack = state.key === key ? state.stack : []
  return {
    cursor: stack.at(-1),
    next: (cursor: string) => setState({ key, stack: [...stack, cursor] }),
    previous: stack.length ? () => setState({ key, stack: stack.slice(0, -1) }) : undefined,
  }
}
export function dateText(value?: string | null): string {
  return value && Number.isFinite(Date.parse(value)) ? formatDateTime(value) : '—'
}
export function vnToday() {
  const d = vnDate(new Date())
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}
export function dateBounds(from: string, to: string) {
  const start = from.split('-').map(Number),
    end = to.split('-').map(Number)
  return { from: vnStartOfDay(start[0], start[1], start[2]), to: vnStartOfDay(end[0], end[1], end[2] + 1) }
}
export function daysAgo(days: number) {
  const d = vnDate(new Date(Date.now() - days * 86400000))
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

/** Chặn công thức khi mở CSV bằng bảng tính; dấu nháy và dòng mới tuân theo CSV. */
export function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
export function csvText(rows: unknown[][]) {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
export function download(data: Blob | string, filename: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function useEventDirectory() {
  return useQuery({
    queryKey: ['admin-event-directory'],
    queryFn: async () => {
      const result: AdminEventSummary[] = [],
        seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await listAdminEvents({ cursor, limit: 100 })
        result.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result
    },
  })
}
