import type { AttendeeRequest } from '@/api/generated/model'
import type { ProfileFieldErrors } from '@/lib/profileErrors'
import { isEmail, isVnPhone } from '@/lib/validate'

export function normalizeAttendeeDetails(input: AttendeeRequest): AttendeeRequest {
  const phone = input.phone?.trim()
  return {
    full_name: input.full_name.trim(),
    email: input.email?.trim() || undefined,
    phone: phone && isVnPhone(phone) ? '+84' + phone.replace(/[\s.-]/g, '').slice(-9) : phone || undefined,
  }
}

export function validateAttendee(input: AttendeeRequest): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}
  if (!input.full_name || [...input.full_name].length > 120 || input.full_name.includes('\0')) {
    errors.full_name = 'Họ và tên cần có từ 1 đến 120 ký tự'
  }
  if (input.email && (!isEmail(input.email) || [...input.email].length > 254)) errors.email = 'Email chưa hợp lệ'
  if (input.phone && !/^\+[1-9]\d{8,14}$/.test(input.phone)) errors.phone = 'Số điện thoại chưa đúng'
  return errors
}
