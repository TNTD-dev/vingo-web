import type { User } from '@/api/generated/model'

export const SESSION_SIGNAL = 'vingo.session-changed'

/** Chỉ báo có thay đổi. Tab nhận tự đọc lại /me bằng cookie. */
export function signalSessionChange() {
  try {
    localStorage.setItem(SESSION_SIGNAL, crypto.randomUUID())
  } catch {
    // Trình duyệt có thể chặn storage.
  }
}

let user: User | null = null
let revision = 0
const listeners = new Set<() => void>()

export const sessionStore = {
  get: () => user,
  get revision() {
    return revision
  },
  invalidatePending() {
    revision++
  },
  set(next: User | null, notifyTabs = false) {
    revision++
    user = next
    listeners.forEach((listener) => listener())
    if (notifyTabs) signalSessionChange()
  },
  expire(expected: number, notifyTabs = false) {
    if (user && revision === expected) this.set(null, notifyTabs)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
