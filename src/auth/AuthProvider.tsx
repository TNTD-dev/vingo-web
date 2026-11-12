import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { login as loginApi, logout as logoutApi } from '@/api/generated/endpoints'
import type { LoginBody } from '@/api/generated/model'
import { refreshSession } from '@/api/http'
import { tokenStore } from '@/auth/token-store'

import { AuthContext } from './auth-context'

/**
 * Khi tải trang thử làm mới phiên bằng cookie refresh (Google login).
 * `ready` = đã biết chắc người dùng đăng nhập hay chưa; guard chờ `ready` trước khi chuyển hướng.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(tokenStore.subscribe, tokenStore.get)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void refreshSession().finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (body: LoginBody) => {
    const pair = await loginApi(body)
    tokenStore.set({ accessToken: pair.access_token, refreshToken: pair.refresh_token, user: pair.user })
  }

  const logout = async () => {
    try {
      await logoutApi({}, { credentials: 'include' })
    } finally {
      tokenStore.set(null)
    }
  }

  return (
    <AuthContext.Provider value={{ ready, user: session?.user ?? null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
