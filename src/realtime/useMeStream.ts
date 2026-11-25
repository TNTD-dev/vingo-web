import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { API_BASE } from '@/api/config'
import type { StreamEventEvent } from '@/api/generated/model'
import { useAuth } from '@/auth/auth-context'
import { sessionStore } from '@/auth/token-store'

import { createDeduper } from './dedupe'

export type MeStreamEvent = { id?: string; type: StreamEventEvent; data: unknown }
export type MeStreamHandler = (event: MeStreamEvent) => void

class RetriableError extends Error {}

/**
 * Mở GET /me/stream bằng cookie.
 * - Gửi Last-Event-ID khi nối lại; khử trùng theo id.
 * - Server đóng sau tối đa 15 phút, nối lại với cùng cookie.
 * - `onOpen` báo khi stream đã mở (Agent mode đợi tín hiệu này rồi mới gửi tin đầu để không lỡ câu trả lời).
 * - Sự kiện đơn/vé → invalidate query tương ứng; mọi sự kiện chuyển cho `onEvent`.
 */
export function useMeStream(onEvent?: MeStreamHandler, onOpen?: () => void) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const handlerRef = useRef(onEvent)
  const openRef = useRef(onOpen)
  useEffect(() => {
    handlerRef.current = onEvent
    openRef.current = onOpen
  })

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    const revision = sessionStore.revision
    const isStale = () => controller.signal.aborted || sessionStore.revision !== revision
    const accept = createDeduper()
    let lastEventId: string | undefined
    let opened = false
    let failures = 0

    void fetchEventSource(`${API_BASE}/me/stream`, {
      signal: controller.signal,
      openWhenHidden: true,
      fetch: (input, init) => {
        if (isStale()) throw new Error('Phiên đã thay đổi')
        const headers = new Headers(init?.headers)
        if (lastEventId) headers.set('Last-Event-ID', lastEventId)
        return fetch(input, { ...init, mode: 'same-origin', credentials: 'same-origin', headers })
      },
      async onopen(res) {
        if (isStale()) throw new Error('Phiên đã thay đổi')
        if (res.ok) {
          // Nối lại sau khi mất kết nối: có thể đã lỡ sự kiện, nên làm mới đơn/vé.
          if (opened) invalidateFor('order.paid', queryClient)
          opened = true
          failures = 0
          openRef.current?.()
          return
        }
        if (res.status === 401 && !controller.signal.aborted) sessionStore.expire(revision)
        // 4xx khác (trừ 429) là lỗi cố định: không nối lại mãi. 5xx/429: thử lại có giãn cách.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}`)
        throw new RetriableError()
      },
      onmessage(msg) {
        if (isStale() || !msg.event || !accept(msg.id)) return
        if (msg.id) lastEventId = msg.id
        const event: MeStreamEvent = {
          id: msg.id || undefined,
          type: msg.event as StreamEventEvent,
          data: msg.data ? JSON.parse(msg.data) : null,
        }
        invalidateFor(event.type, queryClient)
        handlerRef.current?.(event)
      },
      onclose() {
        // Server đóng (hết thời lượng / quá 5 kết nối) → để thư viện nối lại.
        throw new RetriableError()
      },
      onerror(err) {
        // Mất mạng (TypeError của fetch) hay server đóng: nối lại, giãn dần tới 30 giây.
        if (isStale()) throw err
        if (err instanceof RetriableError || err instanceof TypeError) {
          failures += 1
          return Math.min(1000 * 2 ** Math.min(failures - 1, 5), 30_000)
        }
        throw err
      },
    }).catch(() => {
      /* đã abort hoặc lỗi không nối lại được */
    })

    return () => controller.abort()
  }, [user, queryClient])
}

/** Khoá query của Orval có dạng ['/orders/{id}'], ['/orders', params], ['/tickets'…]: so khớp theo tiền tố của phần tử đầu. */
export function invalidateFor(type: StreamEventEvent, queryClient: ReturnType<typeof useQueryClient>) {
  const startsWith = (prefix: string) => ({
    predicate: (q: { queryKey: readonly unknown[] }) =>
      typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith(prefix),
  })
  if (type.startsWith('order.') || type === 'payment.failed') {
    void queryClient.invalidateQueries(startsWith('/orders'))
  }
  // Vé phát hành bất đồng bộ sau thanh toán: order.paid cũng làm mới vé để không lỡ nếu ticket.issued đến trễ.
  if (type === 'ticket.issued' || type === 'order.paid') {
    void queryClient.invalidateQueries(startsWith('/tickets'))
  }
}
