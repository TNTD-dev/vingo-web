import { createContext, useContext } from 'react'

import type { LoginBody, User } from '@/api/generated/model'

export type AuthState = {
  ready: boolean
  user: User | null
  login: (body: LoginBody) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return ctx
}
