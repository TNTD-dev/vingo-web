export type LatLng = { lat: number; lng: number }

const inRange = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180
const round = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Đọc vĩ độ / kinh độ từ link Google Maps đầy đủ (`@lat,lng`, `!3dlat!4dlng`, `?q=lat,lng`).
 * Link rút gọn (maps.app.goo.gl) cần mở mạng để giải, nên không đọc được ở frontend.
 */
export function parseMapsLink(link: string): LatLng | null {
  const text = link.trim()
  if (!text) return null
  const number = '(-?\\d{1,3}(?:\\.\\d+)?)'
  const patterns = [
    new RegExp(`!3d${number}!4d${number}`),
    new RegExp(`@${number},${number}`),
    new RegExp(`[?&](?:q|ll|query|center)=${number}(?:,|%2C)${number}`),
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) {
      const lat = Number(m[1]),
        lng = Number(m[2])
      if (inRange(lat, lng)) return { lat: round(lat), lng: round(lng) }
    }
  }
  return null
}
