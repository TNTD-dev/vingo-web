import { http } from 'msw'

import { API_BASE } from '@/api/config'

/**
 * Mock GET /me/stream: một bus trong bộ nhớ. `emit` (từ mocks/agent.ts) đẩy sự kiện tới mọi kết nối đang mở;
 * kết nối giữ bằng ping. Dữ liệu chỉ để dựng UI, không phải seed thật.
 */
const encoder = new TextEncoder()
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()

export function emit(event: string, data: Record<string, unknown>) {
  const frame = encoder.encode(`id: ${crypto.randomUUID()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  for (const c of clients) {
    try {
      c.enqueue(frame)
    } catch {
      clients.delete(c)
    }
  }
}

export const meStreamHandler = http.get(`*${API_BASE}/me/stream`, () => {
  let self: ReadableStreamDefaultController<Uint8Array> | undefined
  let ping: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      self = controller
      clients.add(controller)
      controller.enqueue(encoder.encode(': connected\n\n'))
      ping = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 20_000)
    },
    cancel() {
      if (self) clients.delete(self)
      if (ping) clearInterval(ping)
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
})
