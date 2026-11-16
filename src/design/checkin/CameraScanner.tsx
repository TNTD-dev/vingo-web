import { useEffect, useRef, useState } from 'react'

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorConstructor = new (options: { formats: string[] }) => Detector
export default function CameraScanner({ onScan }: { onScan: (token: string) => void }) {
  const video = useRef<HTMLVideoElement>(null),
    callback = useRef(onScan)
  const [error, setError] = useState('')
  useEffect(() => {
    callback.current = onScan
  }, [onScan])
  useEffect(() => {
    let active = true,
      stream: MediaStream | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      last = '',
      lastAt = 0
    const Detector = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
    async function start() {
      if (!Detector) {
        setError('Trình duyệt chưa hỗ trợ quét QR bằng camera. Dùng máy đọc QR hoặc dán nội dung QR bên dưới.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        const detector = new Detector({ formats: ['qr_code'] })
        const scan = async () => {
          if (!active || !video.current) return
          try {
            const codes = await detector.detect(video.current)
            if (!active) return
            const value = codes[0]?.rawValue
            // Quét liên tục: bỏ qua cùng một mã trong 3 giây để vé đang giơ trước camera không bị quét lặp.
            if (value && (value !== last || Date.now() - lastAt > 3000)) {
              last = value
              lastAt = Date.now()
              callback.current(value)
              if (active) timer = setTimeout(() => void scan(), 1200)
              return
            }
          } catch {
            if (!active) return
          }
          if (active) timer = setTimeout(() => void scan(), 250)
        }
        void scan()
      } catch {
        if (active) setError('Không mở được camera. Kiểm tra quyền truy cập camera hoặc dùng máy đọc QR.')
      }
    }
    void start()
    return () => {
      active = false
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  return error ? (
    <p role="alert" className="admin-error">
      {error}
    </p>
  ) : (
    <div className="admin-camera-live">
      <video ref={video} muted playsInline aria-label="Camera quét QR" />
      <span className="admin-camera-target" aria-hidden />
      <p>Đưa mã QR vào giữa khung — camera quét liên tục</p>
    </div>
  )
}
