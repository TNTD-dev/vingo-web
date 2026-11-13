import { sanitizeSvg } from './svg'

/**
 * Lấy SVG sơ đồ ghế của một suất.
 *
 * LƯU Ý CONTRACT: API cho người mua chưa có endpoint trả SVG (chỉ có /admin/seat-layouts/{id}/svg và
 * getSeatmap chỉ trả toạ độ ghế). Cần backend thêm endpoint công khai; xong thì thay thân hàm này bằng
 * hàm sinh từ contract. Tới lúc đó SVG chỉ có khi chạy `npm run dev:mock`.
 */
export async function loadSeatLayoutSvg(_showtimeId: string): Promise<string> {
  if (import.meta.env.VITE_USE_MOCK !== 'true') throw new Error('SEAT_LAYOUT_SVG_UNAVAILABLE')
  const raw = (await import('@/mocks/seatmaps/thien-truong.svg?raw')).default
  const clean = sanitizeSvg(raw)
  if (!clean) throw new Error('SEAT_LAYOUT_SVG_INVALID')
  return clean
}
