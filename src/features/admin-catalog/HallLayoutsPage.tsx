import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  importSeatLayoutSvg,
  publishSeatLayout,
  renameSeatLayout,
  useGetSeatLayout,
  exportSeatLayoutZones,
  exportSeatLayoutSeats,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import {
  AdminPage,
  Panel,
  Field,
  QueryState,
  ErrorNotice,
  Table,
  StateBadge,
  ConfirmDialog,
} from '@/design/admin/AdminUi'
import { download } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { SeatMapView } from '@/seatmap/SeatMapView'
import { sanitizeSvg, indexSvg } from '@/seatmap/svg'
import { FormDialog } from './CatalogForms'
import { useLayoutDirectory, useLayoutSvg, useVenueDirectory } from './catalog'
import { toast } from 'sonner'
import { AdminAction } from '@/design/admin/AdminAction'
import VenueHalls from './VenueHalls'

export default function HallLayoutsPage({ venueId }: { venueId?: string } = {}) {
  const route = useParams(),
    [params, setParams] = useSearchParams(),
    client = useQueryClient(),
    venues = useVenueDirectory()
  const venue = venues.data?.find(
    (v) => v.id === (venueId ?? params.get('venueId')) || v.halls?.some((h) => h.id === route.hallId),
  )
  const hallId = route.hallId ?? venue?.halls?.[0]?.id ?? ''
  const layouts = useLayoutDirectory(hallId)
  const hall = venues.data?.flatMap((v) => v.halls ?? []).find((h) => h.id === hallId)
  const selected = layouts.data?.find((l) => l.id === params.get('layoutId')) ?? layouts.data?.[0]
  const id = selected?.id ?? '',
    detail = useGetSeatLayout(id, { query: { enabled: !!id } }),
    svg = useLayoutSvg(id)
  const [upload, setUpload] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [fileError, setFileError] = useState(''),
    [name, setName] = useState(''),
    [focus, setFocus] = useState<string>(),
    [action, setAction] = useState<'publish' | 'rename' | null>(null),
    [newName, setNewName] = useState('')
  const importLayout = useMutation({
    mutationFn: () => importSeatLayoutSvg(hallId, { file: file!, name: name.trim() }),
    onSuccess: async (l) => {
      setUpload(false)
      await client.invalidateQueries()
      if (l.id)
        setParams((p) => {
          p.set('layoutId', l.id!)
          return p
        })
      toast.success('Đã nhập sơ đồ nháp')
    },
  })
  const change = useMutation({
    mutationFn: () => (action === 'publish' ? publishSeatLayout(id) : renameSeatLayout(id, { name: newName.trim() })),
    onSuccess: async () => {
      setAction(null)
      await client.invalidateQueries()
      toast.success('Đã cập nhật sơ đồ')
    },
  })
  const exportData = useMutation({
    mutationFn: async (kind: 'zones' | 'seats') => {
      const csv = await (kind === 'zones' ? exportSeatLayoutZones(id) : exportSeatLayoutSeats(id))
      download(csv, `vingo-${kind}-${id}.csv`)
    },
  })
  async function chooseFile(candidate?: File) {
    setFile(null)
    setPreview('')
    setFileError('')
    if (!candidate) return
    if (candidate.size > 10 * 1024 * 1024) {
      setFileError('File SVG tối đa 10 MiB.')
      return
    }
    const clean = sanitizeSvg(await candidate.text())
    if (!clean || !indexSvg(clean).zones.length) {
      setFileError('SVG phải có các khu ZONE__ theo quy ước sơ đồ Vingo.')
      return
    }
    setFile(candidate)
    setPreview(clean)
    if (!name) setName(candidate.name.replace(/\.svg$/i, ''))
  }
  return (
    <AdminPage
      title={venue?.name ?? 'Sân & sơ đồ ghế'}
      caption={`// VENUE · ${venue?.type ?? ''} · ${venue?.city ?? ''}`}
      actions={
        <>
          <AdminAction
            disabled={!hallId}
            onClick={() => {
              setFile(null)
              setPreview('')
              setFileError('')
              setName('')
              importLayout.reset()
              setUpload(true)
            }}
          >
            Nhập sơ đồ SVG
          </AdminAction>
        </>
      }
    >
      <div className="admin-venue-layout">
        <VenueHalls venue={venue} hallId={hallId} />
        <div>
          {!hallId ? (
            <Panel>
              <p className="admin-notice">Thêm hall để nhập phiên bản sơ đồ đầu tiên.</p>
              <ErrorNotice error={venues.error} />
            </Panel>
          ) : (
            <QueryState
              query={layouts}
              empty={!layouts.data?.length}
              emptyText="Chưa có sơ đồ. Nhập file SVG để tạo phiên bản đầu tiên."
            >
              <Panel>
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <select
                      className="admin-layout-select"
                      aria-label={`Phiên bản sơ đồ ${hall?.name ?? ''}`}
                      value={id}
                      onChange={(e) => {
                        setFocus(undefined)
                        setParams((p) => {
                          p.set('layoutId', e.target.value)
                          return p
                        })
                      }}
                    >
                      {layouts.data?.map((l) => (
                        <option key={l.id} value={l.id}>
                          Sơ đồ v{l.version} · {l.status === 'DRAFT' ? 'bản nháp' : 'đã phát hành'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <StateBadge value={selected?.status} />
                  <Button
                    variant="outline"
                    className="admin-small-button"
                    disabled={exportData.isPending}
                    onClick={() => exportData.mutate('zones')}
                  >
                    Tải zones.csv
                  </Button>
                  <Button
                    variant="outline"
                    className="admin-small-button"
                    disabled={exportData.isPending}
                    onClick={() => exportData.mutate('seats')}
                  >
                    Tải seats.csv
                  </Button>
                  {selected?.status === 'DRAFT' && (
                    <Button
                      className="admin-small-button"
                      onClick={() => {
                        change.reset()
                        setAction('publish')
                      }}
                    >
                      Publish sơ đồ
                    </Button>
                  )}
                </div>
                <QueryState query={detail}>
                  <div className="admin-layout-file">
                    <div>
                      <strong>{selected?.name}</strong>
                      <p>
                        Đã đọc {detail.data?.zones.length ?? 0} khu ·{' '}
                        {detail.data?.seat_count?.toLocaleString('vi-VN') ?? '—'} ghế
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setNewName(selected?.name ?? '')
                        change.reset()
                        setAction('rename')
                      }}
                    >
                      Đổi tên
                    </button>
                  </div>
                  <QueryState query={svg}>
                    <div className="h-[330px] overflow-hidden rounded-xl bg-canvas">
                      {svg.data && (
                        <SeatMapView
                          svg={svg.data}
                          zones={Object.fromEntries(
                            (detail.data?.zones ?? []).map((z) => [z.code, { tier: 1, soldOut: false }]),
                          )}
                          focus={focus}
                          selected={new Set()}
                          onZoneClick={(code) => setFocus(focus === code ? undefined : code)}
                          onSeatClick={() => {}}
                          className="h-full"
                        />
                      )}
                    </div>
                  </QueryState>
                  {focus && (
                    <Button className="mt-3" variant="outline" onClick={() => setFocus(undefined)}>
                      ← Toàn cảnh
                    </Button>
                  )}
                  <ErrorNotice error={exportData.error} />
                  <div className="admin-layout-zones">
                    <Table label="Khu trong sơ đồ" headings={['Khu', 'Loại', 'Sức chứa', 'Mã SVG']}>
                      {detail.data?.zones.map((z) => (
                        <tr key={z.id}>
                          <td>
                            <button className="underline" onClick={() => setFocus(z.code)}>
                              {z.label || z.code}
                            </button>
                          </td>
                          <td>{z.kind}</td>
                          <td>{z.capacity.toLocaleString('vi-VN')}</td>
                          <td className="max-w-40 truncate" title={z.svg_id}>
                            {z.svg_id}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </div>
                </QueryState>
              </Panel>
            </QueryState>
          )}
        </div>
      </div>
      {upload && (
        <FormDialog title="Nhập sơ đồ SVG" pending={importLayout.isPending} onClose={() => setUpload(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (file) importLayout.mutate()
            }}
          >
            <Field label="Tên sơ đồ *">
              <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="File SVG * · tối đa 10 MiB">
              <input
                type="file"
                accept=".svg,image/svg+xml"
                disabled={importLayout.isPending}
                onChange={(e) => void chooseFile(e.target.files?.[0])}
              />
            </Field>
            <p className="admin-notice">
              Giữ nguyên tọa độ và hình học của bản vẽ. Dùng ID ZONE__MÃ__SEATED cho khu ngồi,
              ZONE__MÃ__STANDING__SỨC_CHỨA cho khu đứng và SEAT__MÃ__HÀNG__SỐ cho ghế. Mỗi lần nhập tạo một phiên bản
              nháp mới.
            </p>
            {fileError && (
              <p role="alert" className="admin-error">
                {fileError}
              </p>
            )}
            {preview && (
              <div className="h-64">
                <SeatMapView
                  svg={preview}
                  zones={Object.fromEntries(indexSvg(preview).zones.map((z) => [z.code, { tier: 1, soldOut: false }]))}
                  selected={new Set()}
                  onZoneClick={() => {}}
                  onSeatClick={() => {}}
                  className="h-full"
                />
              </div>
            )}
            <ErrorNotice error={importLayout.error} />
            <Button disabled={!file || !name.trim() || importLayout.isPending}>
              {importLayout.isPending ? 'Đang nhập…' : 'Nhập sơ đồ nháp'}
            </Button>
          </form>
        </FormDialog>
      )}
      {action === 'rename' && (
        <FormDialog title="Đổi tên sơ đồ" pending={change.isPending} onClose={() => setAction(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              change.mutate()
            }}
            className="space-y-4"
          >
            <Field label="Tên sơ đồ *">
              <input required maxLength={200} value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Field>
            <ErrorNotice error={change.error} />
            <Button disabled={change.isPending || !newName.trim()}>Lưu tên</Button>
          </form>
        </FormDialog>
      )}
      {action === 'publish' && (
        <ConfirmDialog
          open
          title="Phát hành sơ đồ?"
          description="Sau khi phát hành, hình học sơ đồ được cố định và có thể sử dụng cho suất diễn. Muốn thay đổi ghế, hãy nhập một phiên bản mới."
          requireReason={false}
          pending={change.isPending}
          error={change.error}
          onClose={() => setAction(null)}
          onConfirm={() => change.mutate()}
        />
      )}
    </AdminPage>
  )
}
