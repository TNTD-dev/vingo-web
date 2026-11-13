import { isEmail, isVnPhone, MIN_PASSWORD } from '@/lib/validate'

export type RegisterFields = { full_name: string; phone: string; email: string; password: string; confirm: string }
export type RegisterErrors = Partial<Record<keyof RegisterFields | 'terms', string>>

export function validateRegister(v: RegisterFields, terms: boolean): RegisterErrors {
  const e: RegisterErrors = {}
  if (!v.full_name.trim()) e.full_name = 'Nhập họ và tên'
  if (!isVnPhone(v.phone)) e.phone = 'Số điện thoại chưa đúng'
  if (!isEmail(v.email)) e.email = 'Email chưa đúng'
  if (v.password.length < MIN_PASSWORD) e.password = `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự`
  if (v.confirm !== v.password) e.confirm = 'Mật khẩu nhập lại chưa khớp'
  if (!terms) e.terms = 'Cần đồng ý Điều khoản để tiếp tục'
  return e
}
