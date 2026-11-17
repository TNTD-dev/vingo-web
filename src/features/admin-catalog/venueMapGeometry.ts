import { fitView, panView, type Box } from '@/seatmap/geometry'

/** Giới hạn zoom nhưng giữ điểm dưới con trỏ đứng yên. */
export function zoomVenueView(view: Box, factor: number, anchor: { x: number; y: number }, overview: Box): Box {
  const width = Math.max(overview.w / 24, Math.min(overview.w, view.w / factor))
  const ratio = width / view.w
  return panView(
    {
      x: anchor.x - (anchor.x - view.x) * ratio,
      y: anchor.y - (anchor.y - view.y) * ratio,
      w: width,
      h: view.h * ratio,
    },
    0,
    0,
    overview,
  )
}

export function wheelZoomFactor(delta: number, mode: number, height: number): number {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? height : 1)
  return Math.exp(-Math.max(-160, Math.min(160, pixels)) * 0.003)
}

/** Hai ngưỡng theo kích thước ghế trên màn hình để tránh nhấp nháy khi zoom. */
export function showVenueSeats(previous: boolean, seatPixels: number): boolean {
  return previous ? seatPixels >= 3 : seatPixels >= 4.5
}

export function visibleBox(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
}

export function fitVenueZone(box: Box, overview: Box, aspect: number): Box {
  const fit = fitView(box, aspect, 0.15)
  const width = Math.max(overview.w / 24, Math.min(overview.w, fit.w))
  return { x: box.x + box.w / 2 - width / 2, y: box.y + box.h / 2 - width / aspect / 2, w: width, h: width / aspect }
}
