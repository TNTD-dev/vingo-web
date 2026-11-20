import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getGetSeatLayoutQueryKey } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { SeatLayoutOverview } from '@/api/generated/model'
import { VenueWorkspace } from './VenueWorkspace'

const api = vi.hoisted(() => ({ rename: vi.fn(), overview: vi.fn() }))
vi.mock('@/api/generated/endpoints/admin-catalog/admin-catalog', async (load) => ({
  ...(await load<typeof import('@/api/generated/endpoints/admin-catalog/admin-catalog')>()),
  renameSeatLayout: api.rename,
}))
vi.mock('@/api/generated/endpoints/venue-imports/venue-imports', async (load) => ({
  ...(await load<typeof import('@/api/generated/endpoints/venue-imports/venue-imports')>()),
  getVenueOverview: api.overview,
}))
vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
vi.mock('./VenueLocationPicker', () => ({ VenueLocationPicker: () => null }))
vi.mock('./VenueMapView', () => ({
  VenueMapView: ({ svg, minimap }: { svg: string; minimap?: boolean }) => (
    <div data-testid="map" data-minimap={minimap} dangerouslySetInnerHTML={{ __html: svg }} />
  ),
}))

const background =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="PITCH" width="50" height="50"/></svg>'
const seats =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="ZONE__A__SEATED" width="10" height="10"/><circle id="SEAT__A__R1__01" r="1"/></svg>'
const layout: SeatLayoutOverview = {
  id: 'l1',
  name: 'Layout bóng đá',
  status: 'DRAFT',
  overview_id: 'o1',
  version: 2,
  zones: [],
}
function setup(status: 'DRAFT' | 'PUBLISHED' = 'DRAFT', search = '?tab=layout') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(['admin-venue', 'v1'], { id: 'v1', name: 'Sân thử', type: 'STADIUM' })
  const previous = { ...layout, id: 'l0', version: 1, status: 'PUBLISHED' }
  client.setQueryData(['admin-layout-tree', 'v1', 'FOOTBALL'], [{ ...layout, status }, previous])
  client.setQueryData(['admin-layout-tree', 'v1', 'CONCERT'], [])
  client.setQueryData(getGetSeatLayoutQueryKey('l1'), { ...layout, status })
  client.setQueryData(getGetSeatLayoutQueryKey('l0'), previous)
  client.setQueryData(['admin-layout-svg', 'l0'], seats)
  client.setQueryData(['admin-layout-svg', 'l1'], seats)
  client.setQueryData(['venue-overviews', 'v1'], [{ id: 'o1', name: 'Nền chính', status: 'PUBLISHED', version: 1 }])
  const router = createMemoryRouter([{ path: '/admin/venues/v1', element: <VenueWorkspace venueId="v1" /> }], {
    initialEntries: [`/admin/venues/v1${search}`],
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
beforeEach(() => {
  vi.resetAllMocks()
  api.overview.mockResolvedValue({
    id: 'o1',
    name: 'Nền chính',
    version: 1,
    status: 'PUBLISHED',
    svg_content: background,
    areas: [],
    gates: [],
  })
  api.rename.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('quản lý overview và layout đã tạo', () => {
  it('giữ phiên bản cũ đang chọn khi chuyển qua overview rồi quay lại layout', async () => {
    setup('DRAFT', '?tab=layout&layout=l0')
    await userEvent.click(await screen.findByRole('button', { name: 'Xem overview →' }))
    await screen.findByRole('complementary', { name: 'Thông tin overview' })
    await userEvent.click(screen.getByRole('button', { name: /^Layout ghế$/ }))
    expect(await screen.findByLabelText('Phiên bản layout')).toHaveValue('l0')
  })
  it('chuyển sang overview chỉ hiện nền và giữ đúng liên kết tạo layout trên nền đó', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('map').querySelector('[id^="SEAT__"]')).not.toBeNull())
    expect(screen.getByTestId('map')).toHaveAttribute('data-minimap', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Xem overview →' }))
    expect(await screen.findByRole('complementary', { name: 'Thông tin overview' })).toBeInTheDocument()
    expect(screen.getByTestId('map').querySelector('#PITCH')).not.toBeNull()
    expect(screen.getByTestId('map').querySelector('[id^="SEAT__"]')).toBeNull()
    expect(screen.getByTestId('map')).toHaveAttribute('data-minimap', 'true')
    expect(screen.getByRole('link', { name: 'Thêm layout trên nền này' })).toHaveAttribute(
      'href',
      '/admin/venues/v1?import=new&overview=o1',
    )
  })
  it('đổi tên trong dialog và gửi tên đã bỏ khoảng trắng', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Đổi tên' }))
    const dialog = screen.getByRole('dialog', { name: 'Đổi tên layout nháp' })
    const input = within(dialog).getByLabelText('Tên sơ đồ nháp')
    await userEvent.clear(input)
    await userEvent.type(input, '  Bóng đá mới  ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu tên' }))
    await waitFor(() => expect(api.rename).toHaveBeenCalledWith('l1', { name: 'Bóng đá mới' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('layout công bố chỉ cho tạo phiên bản mới và đổi loại vẫn giữ bộ chọn', async () => {
    setup('PUBLISHED')
    await screen.findByRole('group', { name: 'Lớp hiển thị sơ đồ' })
    expect(screen.queryByRole('button', { name: 'Đổi tên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Công bố layout' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tạo phiên bản mới' })).toHaveAttribute(
      'href',
      '/admin/venues/v1?import=new&type=FOOTBALL&overview=o1',
    )
    await userEvent.selectOptions(screen.getByLabelText('Loại sơ đồ'), 'CONCERT')
    expect(
      await screen.findByText('Chưa có layout phù hợp. Chọn loại sơ đồ khác hoặc nhập SVG để tạo phiên bản mới.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Loại sơ đồ')).toHaveValue('CONCERT')
    expect(screen.getByRole('link', { name: 'Tạo phiên bản mới' })).toHaveAttribute(
      'href',
      '/admin/venues/v1?import=new&type=CONCERT',
    )
  })
})
