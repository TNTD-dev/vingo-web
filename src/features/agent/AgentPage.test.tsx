import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/api/generated/model'
import { AuthContext, type AuthState } from '@/auth/auth-context'
import type { MeStreamHandler } from '@/realtime/useMeStream'

const api = vi.hoisted(() => ({
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
  confirmAction: vi.fn(),
  rejectAction: vi.fn(),
  listMessages: vi.fn(),
}))
vi.mock('@/api/generated/endpoints/chat/chat', () => api)

// Stream giả: lưu handler để test đẩy sự kiện vào, và báo "đã mở" ngay.
const stream = vi.hoisted(() => ({ handler: undefined as undefined | ((e: unknown) => void) }))
vi.mock('@/realtime/useMeStream', async () => {
  const { useEffect } = await import('react')
  return {
    useMeStream: (handler: MeStreamHandler, onOpen?: () => void) => {
      stream.handler = handler as (e: unknown) => void
      useEffect(() => {
        onOpen?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
    },
  }
})

import AgentPage from './AgentPage'

const user: User = { id: 'u1', email: 'a@b.c', full_name: 'Minh Anh', role: 'BUYER', status: 'ACTIVE' }
const auth = (u: User | null): AuthState => ({ ready: true, user: u, login: vi.fn(), logout: vi.fn() })

function renderAt(url: string, u: User | null = user) {
  return render(
    <AuthContext.Provider value={auth(u)}>
      <MemoryRouter initialEntries={[url]}>
        <AgentPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const emit = (type: string, data: Record<string, unknown>) => act(() => stream.handler?.({ type, data }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  api.createConversation.mockResolvedValue({ id: 'conv-1', agent: 'BUYER_AGENT' })
  api.sendMessage.mockResolvedValue({ message_id: 'm-user' })
  api.confirmAction.mockResolvedValue(undefined)
  api.rejectAction.mockResolvedValue(undefined)
})

const confirmBlock = {
  id: 'b1',
  type: 'ConfirmAction',
  payload: { action_id: 'act-1', kind: 'CREATE_HOLD', title: 'Giữ J-21, J-22', confirm_label: 'Đồng ý giữ ghế' },
}

describe('AgentPage', () => {
  it('nhận ?q= từ Landing và gửi làm tin nhắn đầu, đúng một lần', async () => {
    renderAt('/vingo?q=2%20v%C3%A9%20HAGL%20cu%E1%BB%91i%20tu%E1%BA%A7n')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1))
    expect(api.createConversation).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenCalledWith('conv-1', { text: '2 vé HAGL cuối tuần' })
    expect(await screen.findAllByText('2 vé HAGL cuối tuần')).not.toHaveLength(0)
  })

  it('chưa đăng nhập: xem được màn chào nhưng không gửi tin, có lối đăng nhập', async () => {
    renderAt('/vingo?q=hello', null)
    expect(screen.getByText(/mình là Vingo/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 30))
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('hiện câu trả lời stream và không gọi confirm cho tới khi người dùng bấm Đồng ý', async () => {
    renderAt('/vingo?q=giữ%20ghế')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalled())
    emit('chat.delta', { message_id: 'm1', text: 'Mình đề xuất J-21, J-22.' })
    emit('chat.block', { message_id: 'm1', block: confirmBlock })
    emit('chat.done', { message_id: 'm1' })

    expect(await screen.findByText('Mình đề xuất J-21, J-22.')).toBeInTheDocument()
    expect(api.confirmAction).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Đồng ý giữ ghế' }))
    await waitFor(() => expect(api.confirmAction).toHaveBeenCalledWith('act-1'))
    expect(api.rejectAction).not.toHaveBeenCalled()
    expect(await screen.findByText('Đã đồng ý')).toBeInTheDocument()
  })

  it('bấm Từ chối thì gọi reject, không confirm', async () => {
    renderAt('/vingo?q=giữ%20ghế')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalled())
    emit('chat.block', { message_id: 'm1', block: confirmBlock })
    await userEvent.click(await screen.findByRole('button', { name: 'Từ chối' }))
    await waitFor(() => expect(api.rejectAction).toHaveBeenCalledWith('act-1'))
    expect(api.confirmAction).not.toHaveBeenCalled()
    expect(await screen.findByText('Đã từ chối')).toBeInTheDocument()
  })

  it('confirm trả 409 ACTION_STATE_INVALID thì báo đề xuất hết hạn', async () => {
    const { ApiError } = await import('@/api/problem')
    api.confirmAction.mockRejectedValue(new ApiError(409, { title: 'x', status: 409, code: 'ACTION_STATE_INVALID' }))
    renderAt('/vingo?q=giữ%20ghế')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalled())
    emit('chat.block', { message_id: 'm1', block: confirmBlock })
    await userEvent.click(await screen.findByRole('button', { name: 'Đồng ý giữ ghế' }))
    expect(await screen.findByText(/đã hết hạn hoặc đã được xử lý/i)).toBeInTheDocument()
  })

  it('gõ tin trong ô chat thì gửi qua sendMessage', async () => {
    renderAt('/vingo?q=xin%20chào')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1))
    emit('chat.done', { message_id: 'm1' })
    await userEvent.type(await screen.findByLabelText('Nhắn Vingo'), 'cảm ơn{Enter}')
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2))
    expect(api.sendMessage).toHaveBeenLastCalledWith('conv-1', { text: 'cảm ơn' })
  })

  it('vào từ trang chọn ghế: gửi ngữ cảnh cho agent, hiện chip, không hiện câu đó như tin của người dùng', async () => {
    render(
      <AuthContext.Provider value={auth(user)}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/vingo',
              state: { context: { eventTitle: 'HAGL vs Hà Nội', zone: 'B', seats: ['D-14', 'D-15'] } },
            },
          ]}
        >
          <AgentPage />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1))
    expect(api.sendMessage.mock.calls[0]?.[1]).toEqual({ text: expect.stringContaining('D-14, D-15') })
    expect(screen.getByText('Từ trang Chọn ghế · HAGL vs Hà Nội · khu B · 2 ghế đã chọn')).toBeInTheDocument()
    expect(screen.queryByText(/Giúp mình nhé/)).toBeNull()
  })
})
