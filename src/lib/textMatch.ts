/** Bỏ dấu tiếng Việt và viết thường để so khớp "hagl", "Việt Nam" như người dùng gõ. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

/** Mọi từ trong `query` đều phải xuất hiện ở ít nhất một trong các trường. Query rỗng = khớp hết. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const hay = foldText(fields.filter(Boolean).join(' '))
  return words.every((w) => hay.includes(w))
}
