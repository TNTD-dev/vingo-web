/**
 * Chế độ demo OTP: backend chạy `SMS_PROVIDER=demo` không gửi SMS mà trả mã trong header `X-Demo-Otp`.
 * Chỉ khi build/chạy với `VITE_DEMO_OTP=true` web mới đọc header này để hiện mã lên màn hình.
 * Không dùng cho môi trường có dữ liệu thật: ai gọi API xin mã cũng đọc được mã.
 */
const HEADER = 'X-Demo-Otp'

let latest: string | undefined

export function isDemoOtpEnabled(): boolean {
  return import.meta.env.VITE_DEMO_OTP === 'true'
}

/** Gọi với header của mọi phản hồi API; chỉ ghi nhớ khi bật demo và header đúng dạng mã số. */
export function captureDemoOtp(headers: Headers): void {
  if (!isDemoOtpEnabled()) return
  const code = headers.get(HEADER)
  if (code && /^\d{4,8}$/.test(code)) latest = code
}

/** Lấy mã demo của lần xin mã vừa rồi (và xoá); rỗng nếu không bật demo hoặc backend không trả mã. */
export function takeDemoOtp(): string | undefined {
  const code = latest
  latest = undefined
  return code
}
