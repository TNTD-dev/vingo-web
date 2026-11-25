import { API_BASE } from '@/api/config'
import type { Problem } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { sessionStore } from '@/auth/token-store'

/** Mutator dùng chung cho client Orval. */
export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  const revision = sessionStore.revision
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${url}`, { ...init, headers, mode: 'same-origin', credentials: 'same-origin' })
  // Các flow /auth tự xử lý lỗi của chúng, kể cả đăng xuất. Danh mục và VNPay return/IPN là public.
  const path = url.split('?')[0]
  const isPublic =
    path.startsWith('/auth/') ||
    /^\/(events(?:\/|$)|payments\/vnpay\/)/.test(path) ||
    /^\/showtimes\/[^/]+\/(seatmap(?:\.svg)?|availability)$/.test(path)
  if (!isPublic && res.status === 401 && !init.signal?.aborted) sessionStore.expire(revision)
  const body = await parse<T>(res)
  const establishesSession = path === '/auth/login' || path === '/auth/otp/verify'
  if ((!isPublic || establishesSession) && revision !== sessionStore.revision)
    throw new DOMException('Phiên đã thay đổi', 'AbortError')
  return body
}

async function parse<T>(res: Response): Promise<T> {
  // Ảnh (vd. mã QR vé) trả về Blob, không parse JSON.
  if (
    res.ok &&
    (res.headers.get('Content-Type')?.startsWith('image/') ||
      res.headers.get('Content-Type')?.startsWith('application/pdf'))
  )
    return (await res.blob()) as T
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok)
    throw new ApiError(
      res.status,
      (body as Problem | undefined) ?? null,
      parseRetryAfter(res.headers.get('Retry-After')),
    )
  return body as T
}

/** Retry-After dạng số giây (backend không dùng dạng ngày HTTP). */
function parseRetryAfter(value: string | null): number | undefined {
  const seconds = value ? Number(value) : NaN
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Orval dùng type này cho TError của mọi hook: lỗi luôn là ApiError (body Problem nằm trong `.problem`). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Body> = ApiError
export type BodyType<Body> = Body
