import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { putPriceTiers, putZonePrices } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import EventPricing from './EventPricing'
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', async (original) => ({
  ...(await original<typeof import('@/api/generated/endpoints/admin-catalog/admin-catalog')>()),
  putPriceTiers: vi.fn().mockResolvedValue(undefined),
  putZonePrices: vi.fn().mockResolvedValue(undefined),
  getAdminEvent: vi.fn(),
  getSeatLayout: vi.fn(async (id: string) => ({
    id,
    name: id,
    version: 1,
    zones: [{ id: `zone-${id}`, code: id.toUpperCase(), label: id, capacity: 100 }],
  })),
}))
vi.mock('@/api/generated/endpoints/search/search', () => ({
  getSeatmap: vi.fn(async (id: string) => ({
    zones: [{ zone_id: id === 's1' ? 'zone-l1' : 'zone-l2', tier: { id: 't1' } }],
  })),
}))
vi.mock('./catalog', async (original) => ({
  ...(await original<typeof import('./catalog')>()),
  useLayoutSvg: (id: string) => {
    const code = id.toUpperCase()
    return {
      data: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect id="ZONE__${code}__SEATED" x="20" y="20" width="50" height="50"/><g id="CONTENT__${code}"><circle id="SEAT__${code}__A__01" cx="30" cy="30" r="2"/></g></svg>`,
      isError: false,
    }
  },
}))
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe() {
        this.callback(
          [{ contentRect: { width: 600, height: 400 } }] as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        )
      }
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const event = {
  id: 'event',
  title: 'Sự kiện',
  status: 'PUBLISHED' as const,
  price_tiers: [
    { id: 't1', name: 'Thường', price: 100 },
    { id: 't2', name: 'VIP', price: 200 },
  ],
  showtimes: [
    { id: 's1', seat_layout_id: 'l1', status: 'SCHEDULED' as const },
    { id: 's2', seat_layout_id: 'l2', status: 'SCHEDULED' as const },
  ],
}
function setup() {
  const goStep = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <EventPricing event={event} goStep={goStep} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { goStep, client }
}
it('chọn khu trên sơ đồ giá có minimap và giữ hạng của các sơ đồ khác khi lưu', async () => {
  const { goStep, client } = setup()
  await screen.findByRole('button', { name: /^Bản đồ nhỏ/ })
  const map = screen.getByRole('application')
  const zone = map.querySelector('#ZONE__L1__SEATED')!
  expect(map.querySelector('[id^="SEAT__"]')).toBeNull()
  expect(zone.querySelector('title')?.textContent).toContain('l1')
  fireEvent.click(zone)
  expect(zone).toHaveAttribute('data-map-picked')
  fireEvent.change(screen.getByLabelText('Hạng giá khu l1'), { target: { value: 't2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp: Xem lại' }))
  await waitFor(() =>
    expect(putZonePrices).toHaveBeenCalledWith('event', [
      { zone_id: 'zone-l1', price_tier_id: 't2' },
      { zone_id: 'zone-l2', price_tier_id: 't1' },
    ]),
  )
  expect(putPriceTiers).toHaveBeenCalled()
  await waitFor(() => expect(goStep).toHaveBeenCalledWith(4))
  client.clear()
})
it('báo rõ khu chưa có giá và số khu đã gán', async () => {
  const { client } = setup()
  fireEvent.change(await screen.findByLabelText('Hạng giá khu l2'), { target: { value: '' } })
  expect(await screen.findByText(/1 khu chưa có giá: L2/)).toBeInTheDocument()
  expect(screen.getByText('1/2 khu có giá')).toBeInTheDocument()
  client.clear()
})
it('không cho lưu khi hai hạng trùng tên', async () => {
  const { client } = setup()
  fireEvent.change(await screen.findByLabelText('Tên hạng 2'), { target: { value: 'thường' } })
  expect(screen.getByRole('button', { name: 'Tiếp: Xem lại' })).toBeDisabled()
  client.clear()
})
