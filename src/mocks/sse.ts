import { http } from 'msw'

import { API_BASE } from '@/api/config'

/**
 * Mock GET /me/stream: phát một lượt chat giả (chat.delta → chat.block → chat.done)
 * rồi giữ kết nối bằng ping. Dữ liệu chỉ để dựng UI, không phải seed thật.
 */
export const meStreamHandler = http.get(`*${API_BASE}/me/stream`, () => {
  const encoder = new TextEncoder()
  const frames = [
    { event: 'chat.delta', data: { message_id: 'mock-1', text: 'Mình tìm được ' } },
    { event: 'chat.delta', data: { message_id: 'mock-1', text: '2 sự kiện phù hợp.' } },
    {
      event: 'chat.block',
      data: { message_id: 'mock-1', block: { id: 'b1', type: 'EventList', payload: { event_ids: [] } } },
    },
    { event: 'chat.done', data: { message_id: 'mock-1' } },
  ]

  const stream = new ReadableStream({
    async start(controller) {
      for (const f of frames) {
        await new Promise((r) => setTimeout(r, 400))
        controller.enqueue(
          encoder.encode(`id: ${crypto.randomUUID()}\nevent: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`),
        )
      }
      const ping = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 20_000)
      return () => clearInterval(ping)
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
})
