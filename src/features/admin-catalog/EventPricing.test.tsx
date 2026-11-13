import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { putZonePrices } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import EventPricing from './EventPricing'
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', () => ({
  putPriceTiers: vi.fn(),
  putZonePrices: vi.fn().mockResolvedValue(undefined),
  getSeatLayout: vi.fn(async (id: string) => ({
    id,
    name: id,
    zones: [{ id: `zone-${id}`, label: id, capacity: 100 }],
  })),
}))
vi.mock('@/api/generated/endpoints/search/search', () => ({
  getSeatmap: vi.fn(async (id: string) => ({
    zones: [{ zone_id: id === 's1' ? 'zone-l1' : 'zone-l2', tier: { id: 't1' } }],
  })),
}))
afterEach(cleanup)
it('thay bảng giá vẫn giữ khu của các sơ đồ khác trong cùng sự kiện', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EventPricing
        event={{
          id: 'event',
          status: 'PUBLISHED',
          price_tiers: [
            { id: 't1', name: 'Thường', price: 100 },
            { id: 't2', name: 'VIP', price: 200 },
          ],
          showtimes: [
            { id: 's1', seat_layout_id: 'l1', status: 'SCHEDULED' },
            { id: 's2', seat_layout_id: 'l2', status: 'SCHEDULED' },
          ],
        }}
      />
    </QueryClientProvider>,
  )
  fireEvent.change(await screen.findByLabelText('Hạng giá khu l1'), { target: { value: 't2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu giá theo khu' }))
  await waitFor(() =>
    expect(putZonePrices).toHaveBeenCalledWith('event', [
      { zone_id: 'zone-l1', price_tier_id: 't2' },
      { zone_id: 'zone-l2', price_tier_id: 't1' },
    ]),
  )
  client.clear()
})
