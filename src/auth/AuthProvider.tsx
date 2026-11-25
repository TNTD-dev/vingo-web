import * as Sentry from '@sentry/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { toast } from 'sonner'

import { login as loginApi, logout as logoutApi } from '@/api/generated/endpoints/auth/auth'
import { getMe } from '@/api/generated/endpoints/me/me'
import type { LoginBody } from '@/api/generated/model'
import { isApiError } from '@/api/problem'

import { AuthContext, type AuthState } from './auth-context'
import { toSentryUser } from './sentry-user'
import { SESSION_SIGNAL, sessionStore } from './token-store'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const user = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const known = useRef(false)
  const [attempt, setAttempt] = useState(0)
  useLayoutEffect(() => {
    let previousId = sessionStore.get()?.id
    return sessionStore.subscribe(() => {
      const nextId = sessionStore.get()?.id
      if (nextId !== previousId) client.clear()
      previousId = nextId
      known.current = true
      setStatus('ready')
    })
  }, [client])

  useEffect(() => {
    Sentry.setUser(toSentryUser(user?.id ? { id: user.id, role: user.role } : null))
  }, [user?.id, user?.role])

  useEffect(() => {
    let controller: AbortController
    async function checkSession() {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      const revision = sessionStore.revision
      if (!known.current) setStatus('loading')
      try {
        const account = await getMe({ signal })
        if (signal.aborted) return
        if (sessionStore.revision === revision) sessionStore.set(account)
      } catch (error) {
        if (signal.aborted) return
        if (sessionStore.revision === revision) {
          if (!(isApiError(error) && error.status === 401)) {
            if (known.current) {
              // Giữ phiên đã biết; cho SSE nối lại sau khi vô hiệu request cũ.
              const current = sessionStore.get()
              sessionStore.set(current ? { ...current } : null)
            } else setStatus('error')
            return
          }
          sessionStore.set(null)
        }
      }
    }
    function onStorage(event: StorageEvent) {
      if (event.key !== SESSION_SIGNAL) return
      // Vô hiệu các request của phiên cũ trước khi đối chiếu cookie mới.
      sessionStore.invalidatePending()
      void checkSession()
    }
    window.addEventListener('storage', onStorage)
    void checkSession()
    return () => {
      window.removeEventListener('storage', onStorage)
      controller.abort()
    }
  }, [attempt])

  async function login(body: LoginBody) {
    const { user: account } = await loginApi(body)
    sessionStore.set(account, true)
    return account
  }

  async function logout(allDevices = false) {
    const revision = sessionStore.revision
    try {
      await logoutApi(allDevices ? { all_devices: true } : {})
    } catch (error) {
      if (!(isApiError(error) && error.status === 401))
        toast.error('Chưa xác nhận được việc đăng xuất trên máy chủ. Vui lòng kiểm tra lại kết nối.')
    } finally {
      // Một request khác có thể đã xoá user bằng 401 trong lúc logout đang chờ.
      if (sessionStore.revision === revision || !sessionStore.get()) sessionStore.set(null, true)
    }
  }

  return (
    <AuthContext.Provider value={{ status, retry: () => setAttempt((value) => value + 1), user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
