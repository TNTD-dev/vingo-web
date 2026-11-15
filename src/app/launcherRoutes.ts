// Các bước đang thao tác (chọn ghế, thanh toán, vé QR toàn màn): ẩn để không đè nút chính.
const HIDDEN = [
  /^\/events\/[^/]+\/showtimes\//,
  /^\/orders\/[^/]+\/(checkout|success)$/,
  /^\/payment\//,
  /^\/tickets\/[^/]+$/,
]

export function isLauncherHidden(pathname: string): boolean {
  return HIDDEN.some((r) => r.test(pathname))
}
