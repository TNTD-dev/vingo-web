/** "minhanh@gmail.com" → "m***@gmail.com". Không có @ thì che toàn bộ trừ ký tự đầu. */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at < 1) return `${email.slice(0, 1)}***`
  return `${email[0]}***${email.slice(at)}`
}

/** Che ba số cuối ("+84912345678" → "+84 912 345 ***"); đầu vào thiếu trả chuỗi rỗng, chuỗi ngắn che toàn bộ. */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return ''
  if (phone.length <= 3) return '***'
  return `${phone.slice(0, -3)}***`.replace(/^(\+84)(\d{3})(\d{3})\*{3}$/, '$1 $2 $3 ***')
}
