import { ApiError } from '@/api/problem'

type Field = 'full_name' | 'phone' | 'email'
export type ProfileFieldErrors = Partial<Record<Field, string>>

const FIELD_ALIASES: Record<string, Field> = {
  full_name: 'full_name',
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
}

const FIELD_MESSAGES: Record<Field, string> = {
  full_name: 'Nhập họ và tên người nhận vé',
  phone: 'Số điện thoại chưa đúng',
  email: 'Email chưa đúng định dạng',
}

/** Lỗi 400 VALIDATION_ERROR của PUT /me/profile → lỗi theo ô nhập (câu tiếng Việt, không hiện chuỗi của backend). */
export function profileFieldErrors(error: unknown): ProfileFieldErrors {
  const items = error instanceof ApiError && error.code === 'VALIDATION_ERROR' ? (error.problem?.errors ?? []) : []
  const found: ProfileFieldErrors = {}
  for (const item of items) {
    const field = item.field ? FIELD_ALIASES[item.field] : undefined
    if (field) found[field] = FIELD_MESSAGES[field]
  }
  return found
}
