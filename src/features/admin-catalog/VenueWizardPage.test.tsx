import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VenueImportSession, VenueImportPatch } from '@/api/generated/model'
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
  it('phục hồi khi complete đã ghi nhưng phản hồi bị mất, không tạo sân lần hai', async () => {
    session.step = 'REVIEW'
    api.complete.mockImplementation(async () => {
      session.status = 'COMPLETED'
      session.result = { venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' }
      throw new Error('Response lost')
    })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu sân & layout' }))
    expect(await screen.findByText('Đã lưu sân và layout nháp')).toBeInTheDocument()
    expect(api.complete).toHaveBeenCalledTimes(1)
    expect(api.create).not.toHaveBeenCalled()
  })
  it('retry lỗi lưu tiếp tục cùng phiên nháp', async () => {
    session.step = 'REVIEW'
    api.complete
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ venue_id: 'v1', overview_id: 'o1', layout_id: 'l1' })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Lưu sân & layout' }))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu sân & layout' }))
    expect(await screen.findByText('Đã lưu sân và layout nháp')).toBeInTheDocument()
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
