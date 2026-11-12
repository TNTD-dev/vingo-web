/**
 * Idempotency-Key bắt buộc cho: giữ ghế, tạo thanh toán, resolve-review.
 * Tạo một key cho mỗi lần người dùng bấm, dùng lại khi retry cùng thao tác.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
