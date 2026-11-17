import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Venue } from '@/api/generated/model'
import HallLayoutsPage from './HallLayoutsPage'

const mock = vi.hoisted(() => ({ venue: null as Venue | null }))
vi.mock('./catalog', () => ({
  useVenueDirectory: () => ({ data: mock.venue ? [mock.venue] : [], isPending: false, error: null, refetch: vi.fn() }),
}))

describe('legacy hall layout route', () => {
  beforeEach(() => {
    mock.venue = { id: 'venue-1' }
  })

  it('đưa đường dẫn Hall cũ về danh sách sân', async () => {
    const router = createMemoryRouter(
      [
        { path: '/admin/halls/:hallId/layouts', element: <HallLayoutsPage /> },
        { path: '/admin/venues', element: <p>Trang cấu hình sân</p> },
      ],
      { initialEntries: ['/admin/halls/hall-1/layouts'] },
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Trang cấu hình sân')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/venues'))
  })
})
