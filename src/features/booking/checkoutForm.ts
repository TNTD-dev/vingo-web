import type { BuyerProfile } from '@/api/generated/model'

export type ProfileDraft = { full_name: string; phone: string; email: string }
export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>

export const EMPTY_PROFILE: ProfileDraft = { full_name: '', phone: '', email: '' }

/** Số điện thoại Việt Nam: bỏ khoảng trắng, dấu chấm, gạch; "+84" đổi thành "0". */
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s.\-()]/g, '')
  return digits.startsWith('+84') ? `0${digits.slice(3)}` : digits
}

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {}
  if (draft.full_name.trim().length < 2) errors.full_name = 'Nhập họ và tên người nhận vé'
  if (!/^0\d{9}$/.test(normalizePhone(draft.phone))) errors.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Email chưa đúng định dạng'
  return errors
}

export const hasErrors = (e: ProfileErrors) => Object.keys(e).length > 0

/** Dạng gửi lên API (đã chuẩn hoá). */
export function toProfile(draft: ProfileDraft): BuyerProfile {
  return { full_name: draft.full_name.trim(), phone: normalizePhone(draft.phone), email: draft.email.trim() }
}

/** Có khác hồ sơ đã lưu không (hoặc chưa có hồ sơ) → cần lưu trước khi thanh toán. */
export function needsSave(draft: ProfileDraft, saved: BuyerProfile | undefined): boolean {
  if (!saved) return true
  const next = toProfile(draft)
  return next.full_name !== saved.full_name || next.phone !== normalizePhone(saved.phone) || next.email !== saved.email
}

/** Che số điện thoại để hiển thị/ghi log: "0901234821" → "090 *** 4821". */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone)
  return p.length >= 7 ? `${p.slice(0, 3)} *** ${p.slice(-4)}` : '***'
}

/** Chỉ mở địa chỉ thanh toán https do API trả; chặn mọi scheme khác (javascript:, data:…). */
export function isSafePaymentUrl(url: string | undefined): url is string {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}
