/** Mã QR minh hoạ 11×11 (lấy theo ô Bento "Vé QR qua email" trong Figma). Chỉ là hình trang trí, không phải mã thật. */
export const QR_ROWS = [
  '11101111111',
  '11100010111',
  '11101110111',
  '11000011101',
  '11101111111',
  '11000110000',
  '11011011000',
  '00011110111',
  '11100001101',
  '11101010101',
  '11101001000',
] as const

export const QR_CELLS: { x: number; y: number }[] = QR_ROWS.flatMap((row, y) =>
  [...row].flatMap((c, x) => (c === '1' ? [{ x, y }] : [])),
)
