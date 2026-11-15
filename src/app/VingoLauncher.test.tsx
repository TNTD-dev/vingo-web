import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isLauncherHidden } from './launcherRoutes'
import { VingoLauncher } from './VingoLauncher'

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <VingoLauncher /> }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const bubble = () => screen.getByText(/Để Vingo đặt cho nè!|Mở Vingo →/).closest('[data-open]')

describe('VingoLauncher', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('bấm mascot thì sang Agent mode', () => {
    const router = renderAt('/events')
    fireEvent.click(screen.getByRole('link', { name: /Mở Vingo/ }))
    expect(router.state.location.pathname).toBe('/vingo')
  })

  it('lần đầu trong phiên hiện bong bóng mời 4s rồi thu về', () => {
    renderAt('/events')
    expect(bubble()).toHaveAttribute('data-open', 'true')
    act(() => vi.advanceTimersByTime(4000))
    expect(bubble()).toHaveAttribute('data-open', 'false')
  })

  it('đã mời trong phiên thì không mời lại, rê chuột mới hiện', () => {
    sessionStorage.setItem('vingo-launcher-invited', '1')
    renderAt('/events')
    expect(bubble()).toHaveAttribute('data-open', 'false')
    fireEvent.mouseEnter(screen.getByRole('link', { name: /Mở Vingo/ }))
    expect(bubble()).toHaveAttribute('data-open', 'true')
    expect(screen.getByText('Mở Vingo →')).toBeInTheDocument()
  })

  it('ẩn ở bước chọn ghế, thanh toán và vé QR', () => {
    renderAt('/orders/o1/checkout')
    expect(screen.queryByRole('link', { name: /Mở Vingo/ })).not.toBeInTheDocument()
  })
})

describe('isLauncherHidden', () => {
  it.each([
    ['/events', false],
    ['/events/e1', false],
    ['/orders', false],
    ['/orders/o1', false],
    ['/tickets', false],
    ['/events/e1/showtimes/s1/seats', true],
    ['/orders/o1/checkout', true],
    ['/orders/o1/success', true],
    ['/payment/vnpay-return', true],
    ['/tickets/t1', true],
  ])('%s → %s', (path, hidden) => {
    expect(isLauncherHidden(path)).toBe(hidden)
  })
})
