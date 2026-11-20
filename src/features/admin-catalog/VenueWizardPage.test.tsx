import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VenueImportSession, VenueImportPatch, VenueImportResult } from '@/api/generated/model'
import { ApiError } from '@/api/problem'
import VenueWizardPage from './VenueWizardPage'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  preview: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
  overviews: vi.fn(),
}))
vi.mock('@/api/generated/endpoints/venue-imports/venue-imports', () => ({
  createVenueImport: (...a: unknown[]) => api.create(...a),
  getVenueImport: (...a: unknown[]) => api.get(...a),
  listVenueImports: (...a: unknown[]) => api.list(...a),
  updateVenueImport: (...a: unknown[]) => api.update(...a),
  uploadVenueImportFiles: (...a: unknown[]) => api.upload(...a),
  deleteVenueImportFile: (...a: unknown[]) => api.remove(...a),
  previewVenueImport: (...a: unknown[]) => api.preview(...a),
  completeVenueImport: (...a: unknown[]) => api.complete(...a),
  cancelVenueImport: (...a: unknown[]) => api.cancel(...a),
  listVenueOverviews: (...a: unknown[]) => api.overviews(...a),
}))
vi.mock('./LayoutPreview', () => ({ LayoutPreview: () => null }))
vi.mock('./VenueSetupFields', () => ({ VenueSetupFields: () => null }))
vi.mock('./VenueWorkspace', () => ({ VenueWorkspace: () => <p>Quản lý sân</p> }))
vi.mock('@/design/admin/AdminSearch', () => ({ AdminSearch: () => null }))
let session: VenueImportSession
const overview =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="AREA__A" width="80" height="80"/><rect id="GATE__G1__IN" x="90" width="10" height="10"/></svg>'
const detail =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect id="ZONE__A1__SEATED" width="60" height="60"/><circle id="SEAT__A1__A__01" cx="20" cy="20" r="2"/></svg>'
function setup(path = '/admin/venues/new?session=s1') {
  const router = createMemoryRouter(
    [
      { path: '/admin/venues/new', element: <VenueWizardPage /> },
      { path: '/admin/venues/:venueId/setup', element: <VenueWizardPage /> },
      { path: '/admin/venues', element: <p>Danh sách sân</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
beforeEach(() => {
  vi.resetAllMocks()
  api.overviews.mockResolvedValue({
    data: [
      { id: 'o1', name: 'Nền sân', version: 1, status: 'PUBLISHED' },
      { id: 'o2', name: 'Nền nháp', version: 2, status: 'DRAFT' },
    ],
  })
  session = {
    id: 's1',
    revision: 7,
    status: 'DRAFT',
    step: 'OVERVIEW',
    draft_data: {
      overview_name: 'Nền sân',
      layout_name: 'Bóng đá',
      layout_type: 'FOOTBALL',
      venue: {
        name: 'Sân thử',
        address: 'Hà Nội',
        city: 'HN',
        location: { display_address: 'Hà Nội', latitude: 21, longitude: 105, source: 'GEOAPIFY' },
      },
    },
    files: [
      {
        id: 'f1',
        role: 'OVERVIEW',
        original_filename: 'base.svg',
        validation_status: 'VALIDATED',
        sanitized_svg: overview,
      },
      {
        id: 'f2',
        role: 'SEAT_LAYOUT',
        original_filename: 'football.svg',
        validation_status: 'VALIDATED',
        sanitized_svg: detail,
      },
    ],
  }
  api.get.mockImplementation(async () => structuredClone(session))
  api.list.mockImplementation(async () => ({ data: [structuredClone(session)] }))
  api.create.mockImplementation(async () => structuredClone(session))
  api.update.mockImplementation(async (_id: string, patch: VenueImportPatch) => {
    if (session.target_venue_id && patch.draft_data?.venue !== undefined) {
      throw new ApiError(400, {
        title: 'Dữ liệu không hợp lệ',
        status: 400,
        code: 'VALIDATION_ERROR',
        detail: 'Phiên thêm layout không sửa thông tin sân.',
      })
    }
    session = { ...session, ...patch, revision: session.revision! + 3 }
    return structuredClone(session)
  })
  api.upload.mockImplementation(async () => {
    session.revision! += 5
    return structuredClone(session)
  })
  api.preview.mockResolvedValue({
    valid: true,
    overview_svg: overview,
    detail_svg: detail,
    zones: [{ code: 'A1', seat_count: 1, capacity: 1, kind: 'SEATED' }],
    areas: [{ code: 'A' }, { code: 'B' }],
    gates: [{ code: 'G1', direction: 'IN' }],
    zone_areas: { A1: 'A' },
    issues: [],
  })
  api.complete.mockResolvedValue({ venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' })
})
afterEach(cleanup)

describe('wizard sân v2', () => {
  it('chuyển thẳng sang đúng layout khi lưu xong, dù form vừa thay đổi', async () => {
    let resolveComplete!: (result: VenueImportResult) => void
    api.complete.mockReturnValue(
      new Promise<VenueImportResult>((resolve) => {
        resolveComplete = resolve
      }),
    )
    const router = setup()
    await userEvent.selectOptions(await screen.findByLabelText('Loại layout — football.svg'), 'CONCERT')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sân & layout' }))
    await waitFor(() => expect(api.complete).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled()
    expect(screen.getByText(/Đang lưu sân & layout…/)).toBeInTheDocument()
    resolveComplete({ venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' })
    expect(await screen.findByText('Quản lý sân')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/venues/v1/setup')
    expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
      tab: 'layout',
      type: 'CONCERT',
      layout: 'l1',
    })
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.queryByText('Có thay đổi chưa lưu')).not.toBeInTheDocument()
  })
  it('mở layout đã hoàn tất khi bấm lưu lại, không gửi complete lần nữa', async () => {
    const router = setup()
    await userEvent.selectOptions(await screen.findByLabelText('Loại layout — football.svg'), 'CONCERT')
    session.status = 'COMPLETED'
    session.result = { venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' }
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sân & layout' }))
    expect(await screen.findByText('Quản lý sân')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/venues/v1/setup')
    expect(api.complete).not.toHaveBeenCalled()
    expect(api.update).not.toHaveBeenCalled()
    expect(screen.queryByText('Có thay đổi chưa lưu')).not.toBeInTheDocument()
  })
  it('tạo layout mới dùng overview đã công bố và giữ loại layout đã chọn', async () => {
    session.target_venue_id = 'v1'
    session.draft_data = { overview_id: 'o1' }
    setup('/admin/venues/v1/setup?import=new&overview=o1&type=CONCERT')
    const choice = await screen.findByLabelText('Nền cho phiên bản mới')
    await waitFor(() => expect(choice).toBeEnabled())
    expect(choice).toHaveValue('o1')
    expect(screen.queryByRole('option', { name: /Nền nháp/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tạo phiên nháp' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ target_venue_id: 'v1', overview_id: 'o1' }))
    expect(api.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        step: 'OVERVIEW',
        draft_data: expect.objectContaining({ overview_id: 'o1', layout_type: 'CONCERT' }),
      }),
    )
    expect(api.update.mock.calls[0][1].draft_data).not.toHaveProperty('venue')
    await waitFor(() => {
      expect(
        screen.getByText('Đang dùng overview đã công bố. Nền và cổng được giữ nguyên cho phiên bản mới.'),
      ).toBeInTheDocument()
      expect(screen.queryByLabelText('Tệp SVG nền')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Tệp SVG zone/ghế')).toBeInTheDocument()
    })
  })
  it('thêm layout với nền mới cũng không gửi dữ liệu sân, kể cả khi mở lại và lưu nháp', async () => {
    session.target_venue_id = 'v1'
    session.draft_data = {}
    setup('/admin/venues/v1/setup?import=new')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo phiên nháp' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Tạo phiên nháp' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Lưu nháp$/ })).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
    expect(api.create).toHaveBeenCalledWith({ target_venue_id: 'v1' })
    expect(api.update.mock.calls[0][1].draft_data).not.toHaveProperty('venue')
    await userEvent.click(screen.getByRole('button', { name: /^Lưu nháp$/ }))
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
    expect(api.update.mock.calls[1][1].draft_data).not.toHaveProperty('venue')
  })
  it('chặn dùng overview không còn thuộc danh sách khả dụng', async () => {
    setup('/admin/venues/v1/setup?import=new&overview=missing')
    expect(await screen.findByRole('alert')).toHaveTextContent('Overview đã chọn không còn khả dụng')
    expect(screen.getByRole('button', { name: 'Tạo phiên nháp' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Nền cho phiên bản mới'), '')
    expect(screen.getByRole('button', { name: 'Tạo phiên nháp' })).toBeEnabled()
    expect(api.create).not.toHaveBeenCalled()
  })
  it('tạo phiên nháp, hiện SVG tổng quát trước thông tin sân', async () => {
    setup('/admin/venues/new')
    await userEvent.click(screen.getByRole('button', { name: 'Tạo phiên nháp' }))
    expect(api.create).toHaveBeenCalledWith({})
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('s1')
      expect(screen.getByLabelText('Tên sân *')).toBeInTheDocument()
    })
    expect(screen.queryByLabelText('Tệp SVG nền')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Hall/)).not.toBeInTheDocument()
  })
  it('upload nhiều tệp dùng revision trả về từ server, quay lại giữ thông tin', async () => {
    session.step = 'LAYOUT'
    setup()
    const layoutType = await screen.findByLabelText('Loại layout — football.svg')
    const user = userEvent.setup()
    await user.selectOptions(layoutType, 'CONCERT')
    await user.upload(screen.getByLabelText(/Tệp SVG zone/), [
      new File([detail], 'one.svg', { type: 'image/svg+xml' }),
      new File([detail], 'two.svg', { type: 'image/svg+xml' }),
    ])
    await waitFor(() =>
      expect(api.upload).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ revision: 10, files: expect.any(Array) }),
      ),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeEnabled())
    expect(screen.getByLabelText('Loại layout — football.svg')).toHaveValue('CONCERT')
    await user.click(screen.getByRole('button', { name: 'Quay lại' }))
    await screen.findByLabelText('Tên sân *')
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByLabelText('Loại layout — football.svg')).toHaveValue('CONCERT')
  })
  it('mở lại nháp theo URL và chặn bước tiếp khi mapping chưa hợp lệ', async () => {
    session.step = 'PREVIEW'
    api.preview.mockResolvedValueOnce({
      valid: false,
      overview_svg: overview,
      detail_svg: detail,
      zones: [],
      issues: [{ reason: 'ZONE_OVERLAPS_GATE', message: 'Zone giao cổng G1' }],
    })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Kiểm tra sơ đồ' }))
    expect(await screen.findByText(/ZONE_OVERLAPS_GATE/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu sân & layout' })).toBeDisabled()
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('đổi mapping buộc kiểm tra lại trước khi tiếp tục', async () => {
    session.step = 'PREVIEW'
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Kiểm tra sơ đồ' }))
    const mapping = await screen.findByLabelText(/A1 · 1 ghế/)
    expect(screen.getByRole('button', { name: 'Lưu sân & layout' })).toBeEnabled()
    fireEvent.change(mapping, { target: { value: 'B' } })
    expect(screen.getByRole('button', { name: 'Lưu sân & layout' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Kiểm tra sơ đồ' }))
    await waitFor(() =>
      expect(api.update).toHaveBeenLastCalledWith(
        's1',
        expect.objectContaining({ draft_data: expect.objectContaining({ zone_areas: { A1: 'B' } }) }),
      ),
    )
  })
  it('hiện ID ghế lỗi và lý do chặn lưu khi file chưa hợp lệ', async () => {
    session.files![1] = {
      ...session.files![1],
      validation_status: 'INVALID',
      issues: [
        {
          reason: 'SEAT_OUTSIDE_ZONE',
          message: 'Tâm ghế nằm ngoài khung bao của khu.',
          layer_id: 'SEAT__A-T2-Z04__R10__01',
        },
      ],
    }
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('SEAT__A-T2-Z04__R10__01')
    expect(screen.getByRole('region', { name: 'Lý do chưa thể lưu' })).toHaveTextContent('football.svg')
    expect(screen.getByRole('button', { name: 'Lưu sân & layout' })).toBeDisabled()
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('phục hồi khi complete đã ghi nhưng phản hồi bị mất, không tạo sân lần hai', async () => {
    session.step = 'REVIEW'
    api.complete.mockImplementation(async () => {
      session.status = 'COMPLETED'
      session.result = { venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' }
      throw new Error('Response lost')
    })
    const router = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu sân & layout' }))
    expect(await screen.findByText('Quản lý sân')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/venues/v1/setup')
    expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
      tab: 'layout',
      type: 'FOOTBALL',
      layout: 'l1',
    })
    expect(api.complete).toHaveBeenCalledTimes(1)
    expect(api.create).not.toHaveBeenCalled()
  })
  it('retry lỗi lưu tiếp tục cùng phiên nháp', async () => {
    session.step = 'REVIEW'
    api.complete
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' })
    const router = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu sân & layout' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sân & layout' }))
    expect(await screen.findByText('Quản lý sân')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/venues/v1/setup')
    expect(new URLSearchParams(router.state.location.search).get('layout')).toBe('l1')
    expect(api.complete.mock.calls.map((c) => c[0])).toEqual(['s1', 's1'])
    expect(api.create).not.toHaveBeenCalled()
  })
  it('xử lý revision xung đột bằng tải phiên mới nhất', async () => {
    api.update.mockRejectedValueOnce(
      new ApiError(409, { title: 'Xung đột revision', status: 409, code: 'ACTION_STATE_INVALID' }),
    )
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu nháp' }))
    const recover = await screen.findByRole('button', { name: /Tải bản mới nhất/ })
    session.revision = 40
    await userEvent.click(recover)
    expect(await screen.findByText(/revision 40/)).toBeInTheDocument()
  })
  it('kéo thả SVG nền lấy tên file và hiển thị hai tab', async () => {
    session.files = []
    setup()
    const input = await screen.findByLabelText('Tệp SVG nền')
    expect(screen.queryByLabelText('Tên nền')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1. Thông tin sân' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2. Sơ đồ, layout & lưu' })).toBeInTheDocument()
    fireEvent.drop(input.closest('.venue-svg-section')!, {
      dataTransfer: { files: [new File([overview], 'my-dinh.svg', { type: 'image/svg+xml' })] },
    })
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          draft_data: expect.objectContaining({ overview_name: 'my-dinh.svg' }),
        }),
      ),
    )
    await waitFor(() => expect(api.upload).toHaveBeenCalled())
  })
  it('chặn tệp vượt giới hạn trước khi gọi upload', async () => {
    session.files = []
    setup()
    const input = await screen.findByLabelText('Tệp SVG nền')
    const file = new File(['x'], 'too-large.svg', { type: 'image/svg+xml' })
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })
    await userEvent.upload(input, file)
    expect(await screen.findByRole('alert')).toHaveTextContent('10 MiB')
    expect(api.upload).not.toHaveBeenCalled()
  })
})
