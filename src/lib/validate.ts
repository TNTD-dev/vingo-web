/** Kiểm tra đầu vào dùng chung cho các form (đăng ký, đặt lại mật khẩu). Backend vẫn là nơi kiểm tra cuối cùng. */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

/** Số di động Việt Nam: 10 số bắt đầu bằng 0, hoặc +84/84 kèm 9 số. Cho phép khoảng trắng, dấu chấm, gạch ngang. */
export const isVnPhone = (v: string) => /^(0|\+?84)\d{9}$/.test(v.replace(/[\s.-]/g, ''))

export const MIN_PASSWORD = 8

/** Độ mạnh mật khẩu 0–4: đủ dài, có chữ thường và hoa, có số, có ký tự đặc biệt. */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < MIN_PASSWORD) return pw.length === 0 ? 0 : 1
  let score = 1
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw)) score += 1
  return score as 1 | 2 | 3 | 4
}

export const STRENGTH_HINT = [
  '',
  `Tối thiểu ${MIN_PASSWORD} ký tự, gồm chữ hoa, chữ thường và số`,
  'Mật khẩu yếu · thêm chữ hoa, số hoặc ký tự đặc biệt',
  'Mật khẩu khá mạnh · thêm ký tự đặc biệt để mạnh hơn',
  'Mật khẩu mạnh',
] as const
