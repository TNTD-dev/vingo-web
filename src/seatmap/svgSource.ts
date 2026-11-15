import { getSeatmapSvg } from '@/api/generated/endpoints/search/search'

import { sanitizeSvg } from './svg'

/**
 * Lấy SVG sơ đồ sân của một suất (getSeatmapSvg, public) và làm sạch trước khi vẽ.
 * Chế độ `npm run dev:mock` dùng sơ đồ mẫu vì mock sinh từ contract không trả SVG thật.
 */
export async function loadSeatLayoutSvg(showtimeId: string): Promise<string> {
  const raw =
    import.meta.env.VITE_USE_MOCK === 'true'
      ? (await import('@/mocks/seatmaps/thien-truong.svg?raw')).default
      : await (await getSeatmapSvg(showtimeId)).text()
  const clean = sanitizeSvg(raw)
  if (!clean) throw new Error('SEAT_LAYOUT_SVG_INVALID')
  return clean
}
