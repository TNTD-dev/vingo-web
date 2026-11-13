import { useEffect, useState } from 'react'

/** Thời điểm hiện tại (ms), cập nhật mỗi `intervalMs`; dùng cho đồng hồ đếm ngược. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
