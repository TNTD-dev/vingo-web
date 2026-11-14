/** "minhanh@gmail.com" → "m***@gmail.com". Không có @ thì che toàn bộ trừ ký tự đầu. */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return ''
  const at = email.indexOf('@')
  if (at < 1) return `${email.slice(0, 1)}***`
  return `${email[0]}***${email.slice(at)}`
}
