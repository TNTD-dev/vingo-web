import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { QrImage } from './QrImage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('tải ảnh QR qua client cùng origin và hiển thị dữ liệu ảnh', async () => {
  const res = new Response(null, { headers: { 'Content-Type': 'image/png' } })
  // FileReader của jsdom cần Blob cùng môi trường DOM thay vì Blob của Node fetch.
  vi.spyOn(res, 'blob').mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
  const request = vi.fn<typeof fetch>().mockResolvedValue(res)
  vi.stubGlobal('fetch', request)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QrImage ticket={{ id: 'ticket', code: 'demo', status: 'ISSUED' }} />
    </QueryClientProvider>,
  )
  expect(await screen.findByRole('img', { name: 'Mã QR vé demo' })).toHaveAttribute('src', 'data:image/png;base64,AQID')
  expect(request).toHaveBeenCalledExactlyOnceWith(
    '/api/v1/tickets/ticket/qr.png',
    expect.objectContaining({ credentials: 'same-origin' }),
  )
  expect([...new Headers(request.mock.calls[0][1]?.headers)]).toEqual([])
})
