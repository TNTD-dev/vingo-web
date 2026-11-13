import { API_BASE } from '@/api/config'
import type { Problem, RefreshResult } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import { tokenStore } from '@/auth/token-store'

/**
 * Mutator cho client Orval: mọi request API đi qua đây.
 * - Gắn base path và Bearer token.
 * - Gặp 401 thì làm mới phiên một lần rồi gọi lại.
 * - Lỗi HTTP ném ApiError (ProblemDetail + code).
 */
export async function http<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res = await send(url, init)
  if (res.status === 401 && !isAuthPath(url) && (await refreshSession())) {
    res = await send(url, init)
  }
  return parse<T>(res)
}

function send(url: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = tokenStore.get()?.accessToken
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(`${API_BASE}${url}`, { ...init, headers })
}

async function parse<T>(res: Response): Promise<T> {
  // Ảnh (vd. mã QR vé) trả về Blob, không parse JSON.
  if (res.ok && res.headers.get('Content-Type')?.startsWith('image/')) return (await res.blob()) as T
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok) throw new ApiError(res.status, (body as Problem | undefined) ?? null)
  return body as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function isAuthPath(url: string) {
  return url.startsWith('/auth/')
}

let inflight: Promise<boolean> | null = null

/**
 * Làm mới access token. Có refresh token trong bộ nhớ (đăng nhập mật khẩu) thì gửi JSON,
 * không thì dựa vào cookie HttpOnly (đăng nhập Google). Gộp các lần gọi đồng thời.
 */
export function refreshSession(): Promise<boolean> {
  inflight ??= doRefresh().finally(() => {
    inflight = null
  })
  return inflight
}

async function doRefresh(): Promise<boolean> {
  const current = tokenStore.get()
  const refreshToken = current?.refreshToken
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: refreshToken ? { 'Content-Type': 'application/json' } : undefined,
      body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
    })
    if (!res.ok) {
      tokenStore.set(null)
      return false
    }
    const result = (await res.json()) as RefreshResult
    tokenStore.set({
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? undefined,
      user: result.user,
    })
    return true
  } catch {
    tokenStore.set(null)
    return false
  }
}

/** Orval dùng type này cho TError của mọi hook: lỗi luôn là ApiError (body Problem nằm trong `.problem`). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ErrorType<_Body> = ApiError
export type BodyType<Body> = Body
