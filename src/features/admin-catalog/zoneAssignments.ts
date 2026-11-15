/**
 * API không cho đọc lại gán hạng giá theo khu của sự kiện nháp (chỉ ghi). Lưu bản sao trong sessionStorage
 * của tab này để wizard hiển thị lại sau khi tải lại trang; nguồn sự thật vẫn là backend.
 */
const key = (eventId: string) => `vingo-zone-prices:${eventId}`

export function loadZoneAssignments(eventId: string): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(key(eventId))
    const data: unknown = raw ? JSON.parse(raw) : null
    if (!data || typeof data !== 'object') return null
    return Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string')) as Record<string, string>
  } catch {
    return null
  }
}
export function saveZoneAssignments(eventId: string, value: Record<string, string>) {
  try {
    sessionStorage.setItem(key(eventId), JSON.stringify(value))
  } catch {
    /* trình duyệt chặn lưu trữ: bỏ qua */
  }
}
