import { createContext, useContext } from 'react'

import type { LoginBody, User } from '@/api/generated/model'

export type AuthState = {
  status: 'loading' | 'ready' | 'error'
  retry: () => void
  user: User | null
  login: (body: LoginBody) => Promise<User>
  logout: (allDevices?: boolean) => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}
