export type Box = { x: number; y: number; w: number; h: number }

/** Khung nhìn vừa `box` (có lề `pad` theo tỉ lệ) và đúng tỉ lệ khung chứa `aspect` = rộng / cao. */
export function fitView(box: Box, aspect: number, pad = 0.12): Box {
  let w = box.w * (1 + pad * 2)
  let h = box.h * (1 + pad * 2)
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h }
}

/** Phóng/thu quanh một điểm: factor > 1 là phóng to. Điểm (px,py) đứng yên trên màn hình. */
export function zoomAround(view: Box, factor: number, px: number, py: number, min: Box, maxScaleOut = 1): Box {
  const w = Math.min(view.w / factor, min.w * maxScaleOut)
  const h = Math.min(view.h / factor, min.h * maxScaleOut)
  const k = w / view.w
  return { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w, h }
}

/** Kéo khung nhìn đi (dx, dy) theo đơn vị bản vẽ, giữ nó không rời hẳn `bounds`. */
export function panView(view: Box, dx: number, dy: number, bounds: Box): Box {
  const x = Math.min(Math.max(view.x + dx, bounds.x - view.w * 0.5), bounds.x + bounds.w - view.w * 0.5)
  const y = Math.min(Math.max(view.y + dy, bounds.y - view.h * 0.5), bounds.y + bounds.h - view.h * 0.5)
  return { ...view, x, y }
}

export function lerpBox(a: Box, b: Box, t: number): Box {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t }
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export function parseViewBox(value: string | null | undefined): Box | null {
  const n = (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  return n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0
    ? { x: n[0], y: n[1], w: n[2], h: n[3] }
    : null
}

export const boxToViewBox = (b: Box) => `${b.x} ${b.y} ${b.w} ${b.h}`
