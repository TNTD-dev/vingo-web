import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getListMyOrdersQueryKey, listMyOrders } from '@/api/generated/endpoints/booking/booking'
import type { User } from '@/api/generated/model'
import { NotificationsMenu } from '@/app/NotificationsMenu'
import { AuthContext } from '@/auth/auth-context'

vi.mock('@/api/generated/endpoints/booking/booking', () => ({
  getListMyOrdersQueryKey: () => ['my-orders'],
  listMyOrders: vi.fn(),
}))
vi.mock('@/realtime/useMeStream', () => ({ useMeStream: vi.fn() }))

const clients: QueryClient[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

function setup(user: User) {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
  const data = { data: [{ id: 'paid', status: 'PAID' as const, paid_at: '2026-11-21T10:01:00Z' }] }
  vi.mocked(listMyOrders).mockResolvedValue(data)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  clients.push(client)
  client.setQueryData([...getListMyOrdersQueryKey({ limit: 20 }), 'notifications'], data)
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ ready: true, user, login: async () => user, logout: async () => {} }}>
        <QueryClientProvider client={client}>
          <NotificationsMenu />
        </QueryClientProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
  // Mở menu bằng bàn phím để không phụ thuộc PointerEvent của môi trường jsdom.
  fireEvent.keyDown(screen.getByRole('button', { name: /^Thông báo/ }), { key: 'Enter' })
}

describe('NotificationsMenu dùng trạng thái user để nhắc xác minh', () => {
  it('ghim liên kết xác minh ở đầu menu của BUYER chưa xác minh', async () => {
    setup({ id: 'buyer', role: 'BUYER', phone_verified: false })
    const menu = await screen.findByRole('menu')
    const phone = within(menu).getByRole('menuitem', { name: /Xác minh số điện thoại để đặt vé/ })
    expect(phone).toHaveAttribute('href', '/me/security?verify=phone')
    expect(phone).toHaveTextContent('Quý khách vui lòng xác minh số điện thoại để đặt vé. Nhấn vào đây để xác minh.')
    const order = within(menu).getByRole('menuitem', { name: /vé sự kiện đã phát hành/ })
    expect(phone.compareDocumentPosition(order) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    { label: 'BUYER đã xác minh', user: { role: 'BUYER', phone_verified: true } },
    { label: 'BUYER thiếu cờ', user: { role: 'BUYER' } },
    { label: 'ADMIN', user: { role: 'ADMIN', phone_verified: false } },
  ] satisfies { label: string; user: User }[])('$label không có mục nhắc xác minh', async ({ user }) => {
    setup(user)
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: /Xác minh số điện thoại để đặt vé/ })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /vé sự kiện đã phát hành/ })).toBeInTheDocument()
  })
})
