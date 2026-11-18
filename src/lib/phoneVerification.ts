import type { User } from '@/api/generated/model'

/** Chỉ chặn BUYER có cờ xác minh bằng false; cờ thiếu vẫn tương thích backend cũ. */
export function needsPhoneVerification(user: User | null): boolean {
  return user?.role === 'BUYER' && user.phone_verified === false
}

// Số di động Việt Nam: đầu số 3, 5, 7, 8, 9 theo sau là 8 chữ số; tiền tố 0, 84 hoặc +84 có thể bỏ trống.
const VN_MOBILE = /^(?:\+84|84|0)?([35789]\d{8})$/

/** Bỏ khoảng trắng, dấu chấm, gạch ngang rồi chuẩn hoá về dạng +84912345678; không hợp lệ thì null. */
export function normalizeVnMobile(input: string): string | null {
  const match = VN_MOBILE.exec(input.replace(/[\s.-]/g, ''))
  return match ? `+84${match[1]}` : null
}

/** "+84912345678" → "+84 912 345 678"; chuỗi khác giữ nguyên, thiếu thì rỗng. */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return ''
  const match = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(phone)
  return match ? `+84 ${match[1]} ${match[2]} ${match[3]}` : phone
}

/** "+84912345678" → "0912 345 678" để điền sẵn vào ô nhập; không phải số di động Việt Nam thì rỗng. */
export function formatNationalPhone(phone: string | undefined | null): string {
  const e164 = phone ? normalizeVnMobile(phone) : null
  const match = e164 ? /^\+84(\d{3})(\d{3})(\d{3})$/.exec(e164) : null
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : ''
}
