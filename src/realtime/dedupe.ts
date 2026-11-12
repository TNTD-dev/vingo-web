/** Nhớ N id gần nhất để bỏ sự kiện SSE trùng khi nối lại (server phát lại có độ lùi 10 giây). */
export function createDeduper(capacity = 500) {
  const seen = new Set<string>()
  return (id: string | undefined): boolean => {
    if (!id) return true
    if (seen.has(id)) return false
    seen.add(id)
    if (seen.size > capacity) seen.delete(seen.values().next().value as string)
    return true
  }
}
