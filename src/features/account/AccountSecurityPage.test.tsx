import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext } from '@/auth/auth-context'
import type { OtpDialogProps } from '@/design/OtpDialog'
import AccountSecurityPage from '@/features/account/AccountSecurityPage'

vi.mock('@/api/generated/endpoints/me/me', () => ({ deleteMe: vi.fn(), updateMe: vi.fn() }))
vi.mock('@/api/generated/endpoints/tickets/tickets', () => ({
  useListMyTickets: () => ({ data: { data: [] }, isPending: false }),
}))
vi.mock('@/design/OtpDialog', () => ({
  OtpDialog: ({ open, onOpenChange, initialPhone, mode = 'verify' }: OtpDialogProps) =>
    open ? (
      <div role="dialog" aria-label="Xác minh số điện thoại" data-mode={mode} data-phone={initialPhone}>
        <button type="button" onClick={() => onOpenChange(false)}>
          Đóng xác minh
        </button>
      </div>
    ) : null,
}))

const buyer: User = {
  id: 'buyer',
  role: 'BUYER',
  email: 'buyer@example.test',
  phone: '+84912345678',
  phone_verified: false,
}
const clients: QueryClient[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.clearAllMocks()
})

function setup(user: User = buyer, path = '/me/security') {
  const router = createMemoryRouter([{ path: '/me/security', element: <AccountSecurityPage /> }], {
    initialEntries: [path],
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  render(
    <AuthContext.Provider value={{ ready: true, user, login: async () => user, logout: async () => {} }}>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  )
  return router
}

describe('AccountSecurityPage xác minh số điện thoại', () => {
  it('chưa xác minh hiển thị số định dạng, nhãn và nút Xác minh', () => {
    setup()
    expect(screen.getByText('SỐ ĐIỆN THOẠI')).toBeInTheDocument()
    expect(screen.getByText('+84 912 345 678')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác minh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Xác minh$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi số' })).not.toBeInTheDocument()
  })

  it('đã xác minh hiển thị trạng thái thành công và nút Đổi số', () => {
    setup({ ...buyer, phone_verified: true })
    expect(screen.getByText('+84 912 345 678')).toBeInTheDocument()
    expect(screen.getByText('Đã xác minh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đổi số' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Xác minh$/ })).not.toBeInTheDocument()
  })

  it('chưa có số hiển thị dấu gạch và nút Xác minh', () => {
    setup({ ...buyer, phone: undefined })
    expect(screen.getByText('SỐ ĐIỆN THOẠI')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác minh')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Xác minh$/ })).toBeInTheDocument()
  })

  it('khối số điện thoại nằm giữa Đăng nhập và Phiên đăng nhập', () => {
    setup()
    const login = screen.getByRole('heading', { name: 'Đăng nhập' })
    const phone = screen.getByText('SỐ ĐIỆN THOẠI')
    const sessions = screen.getByRole('heading', { name: 'Phiên đăng nhập' })
    expect(login.compareDocumentPosition(phone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(phone.compareDocumentPosition(sessions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('bấm Xác minh mở popup với số hiện tại và mode verify', () => {
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Xác minh$/ }))
    const dialog = screen.getByRole('dialog', { name: 'Xác minh số điện thoại' })
    expect(dialog).toHaveAttribute('data-phone', buyer.phone)
    expect(dialog).toHaveAttribute('data-mode', 'verify')
  })

  it('bấm Đổi số mở popup với số hiện tại và mode change', () => {
    setup({ ...buyer, phone_verified: true })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi số' }))
    const dialog = screen.getByRole('dialog', { name: 'Xác minh số điện thoại' })
    expect(dialog).toHaveAttribute('data-phone', buyer.phone)
    expect(dialog).toHaveAttribute('data-mode', 'change')
  })

  it('verify=phone tự mở khi chưa xác minh rồi xoá riêng tham số bằng replace', async () => {
    const router = setup(buyer, '/me/security?verify=phone&tab=devices#sessions')
    expect(await screen.findByRole('dialog', { name: 'Xác minh số điện thoại' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe('?tab=devices'))
    expect(router.state.location.pathname).toBe('/me/security')
    expect(router.state.location.hash).toBe('#sessions')
    expect(router.state.historyAction).toBe('REPLACE')
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xác minh' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    { label: 'BUYER đã xác minh', user: { ...buyer, phone_verified: true } },
    { label: 'BUYER thiếu cờ', user: { ...buyer, phone_verified: undefined } },
    { label: 'ADMIN', user: { ...buyer, role: 'ADMIN' as const } },
  ])('verify=phone không tự mở với $label', ({ user }) => {
    setup(user, '/me/security?verify=phone')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tham số verify khác phone không tự mở popup', () => {
    const router = setup(buyer, '/me/security?verify=email')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(router.state.location.search).toBe('?verify=email')
  })
})
