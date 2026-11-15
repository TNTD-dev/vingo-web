import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, FileText } from 'lucide-react'
import {
  createHall,
  createVenue,
  importSeatLayoutSvg,
  publishSeatLayout,
  updateVenue,
  useGetSeatLayout,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Hall, SeatLayout, Venue, VenueCreateInput } from '@/api/generated/model'
import { AdminAction, AdminLinkAction } from '@/design/admin/AdminAction'
import { ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { ChecklistRow, ChoiceCard, ChoiceGroup, LightButton, LightLink, Segmented } from '@/design/admin/wizard'
import { Button } from '@/design/ui/button'
import { SeatMapView } from '@/seatmap/SeatMapView'
import { indexSvg, sanitizeSvg } from '@/seatmap/svg'
import { toast } from 'sonner'
import { cities, useLayoutDirectory, useLayoutSvg, useVenueDirectory, venueTypes } from './catalog'
import { parseMapsLink } from './mapsLink'
import { stepItems, WizardShell } from './WizardShell'

const STEPS = [
  { label: 'Thông tin sân', hint: 'Tên, loại, vị trí', doneHint: 'Đã lưu' },
  { label: 'Hall & sơ đồ ghế', hint: 'Nhập SVG, phát hành' },
]
const typeHints: Record<keyof typeof venueTypes, string> = {
  STADIUM: 'Khán đài nhiều khu, có thể có khu đứng',
  THEATER: 'Ghế ngồi theo hàng, tầng, ban công',
  OUTDOOR: 'Chủ yếu khu đứng, sức chứa linh hoạt',
}
const cityOptions = (Object.keys(cities) as (keyof typeof cities)[]).map((value) => ({
  value,
  label: value === 'HCM' ? 'TP.HCM' : cities[value],
}))

export default function VenueWizardPage() {
  const { venueId } = useParams(),
    [params] = useSearchParams(),
    directory = useVenueDirectory()
  const venue = directory.data?.find((v) => v.id === venueId)
  const step = !venueId || params.get('step') === '1' ? 1 : 2
  if (venueId && !venue)
    return (
      <QueryState query={directory} empty emptyText="Không tìm thấy sân này.">
        {null}
      </QueryState>
    )
  return step === 1 ? <VenueInfoStep key={venue?.id ?? 'new'} venue={venue} /> : <VenueLayoutStep venue={venue!} />
}

function VenueInfoStep({ venue }: { venue?: Venue }) {
  const navigate = useNavigate(),
    client = useQueryClient()
  const [data, setData] = useState<VenueCreateInput>({
    name: venue?.name ?? '',
    type: venue?.type ?? 'STADIUM',
    address: venue?.address ?? '',
    city: venue?.city ?? 'HCM',
    district: venue?.district ?? '',
    info: venue?.info ?? {},
    lat: venue?.lat,
    lng: venue?.lng,
  })
  const [mapsLink, setMapsLink] = useState(''),
    [mapsNote, setMapsNote] = useState(''),
    [convention, setConvention] = useState(false)
  const valid = !!data.name?.trim() && !!data.address?.trim()
  const buyerInfo = (['opening_hours', 'parking', 'rules'] as const).filter((k) => String(data.info?.[k] ?? '').trim())
  const save = useMutation({
    mutationFn: async (then: 'next' | 'list') => {
      const body: VenueCreateInput = {
        ...data,
        name: data.name.trim(),
        address: data.address.trim(),
        district: data.district?.trim() || undefined,
      }
      const saved = venue?.id ? await updateVenue(venue.id, body) : await createVenue(body)
      return { saved, then }
    },
    onSuccess: async ({ saved, then }) => {
      await client.invalidateQueries()
      toast.success(venue ? 'Đã lưu thông tin sân' : 'Đã tạo sân')
      navigate(then === 'list' ? '/admin/venues' : `/admin/venues/${saved.id}/setup`)
    },
  })
  const type = data.type as keyof typeof venueTypes
  return (
    <WizardShell
      title={venue ? venue.name! : 'Tạo sân mới'}
      caption={`// CATALOG · ${venue ? 'SỬA SÂN' : 'SÂN MỚI'} · BƯỚC 1/2`}
      steps={stepItems(STEPS, 0)}
      actions={
        <>
          <LightButton disabled={!valid || save.isPending} onClick={() => save.mutate('list')}>
            Lưu nháp
          </LightButton>
          <AdminAction disabled={!valid || save.isPending} onClick={() => save.mutate('next')}>
            {save.isPending ? 'Đang lưu…' : 'Tiếp: Hall & sơ đồ'}
          </AdminAction>
        </>
      }
    >
      <div className="wz-grid">
        <Panel className="wz-panel">
          <fieldset disabled={save.isPending} className="min-w-0">
            <section className="wz-section">
              <h2>Loại địa điểm</h2>
              <p className="wz-panel-hint">Ảnh hưởng tới gợi ý quy ước sơ đồ ghế (khán đài, khu đứng…)</p>
              <ChoiceGroup label="Loại địa điểm">
                {(Object.keys(venueTypes) as (keyof typeof venueTypes)[]).map((t) => (
                  <ChoiceCard
                    key={t}
                    title={venueTypes[t]}
                    hint={typeHints[t]}
                    selected={data.type === t}
                    onSelect={() => setData({ ...data, type: t })}
                  />
                ))}
              </ChoiceGroup>
            </section>
            <section className="wz-section">
              <h2>Tên & vị trí</h2>
              <div className="wz-fields">
                <div className="wz-span">
                  <Field label="Tên sân *">
                    <input
                      required
                      maxLength={200}
                      value={data.name}
                      placeholder="VD: Sân vận động Thiên Trường"
                      onChange={(e) => setData({ ...data, name: e.target.value })}
                    />
                  </Field>
                </div>
                <div>
                  <p className="admin-caption mb-2">Thành phố *</p>
                  <Segmented
                    label="Thành phố"
                    options={cityOptions}
                    value={data.city}
                    onChange={(city) => setData({ ...data, city })}
                  />
                </div>
                <Field label="Quận / huyện">
                  <input value={data.district} onChange={(e) => setData({ ...data, district: e.target.value })} />
                </Field>
                <div className="wz-span">
                  <Field label="Địa chỉ *">
                    <input
                      required
                      value={data.address}
                      placeholder="Số nhà, đường, phường"
                      onChange={(e) => setData({ ...data, address: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            </section>
            <section className="wz-section">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <strong className="font-medium">Thông tin cho người mua · tùy chọn</strong>
                    <small className="wz-panel-hint block">
                      Giờ mở cửa, hướng dẫn gửi xe, nội quy — hiển thị trên trang sự kiện
                    </small>
                  </span>
                  <span className="wz-chip">{buyerInfo.length}/3</span>
                </summary>
                <div className="wz-fields">
                  <Field label="Giờ mở cửa">
                    <input
                      value={String(data.info?.opening_hours ?? '')}
                      onChange={(e) => setData({ ...data, info: { ...data.info, opening_hours: e.target.value } })}
                    />
                  </Field>
                  <Field label="Hướng dẫn gửi xe">
                    <input
                      value={String(data.info?.parking ?? '')}
                      onChange={(e) => setData({ ...data, info: { ...data.info, parking: e.target.value } })}
                    />
                  </Field>
                  <div className="wz-span">
                    <Field label="Nội quy">
                      <textarea
                        value={String(data.info?.rules ?? '')}
                        onChange={(e) => setData({ ...data, info: { ...data.info, rules: e.target.value } })}
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </section>
            <section className="wz-section">
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <strong className="font-medium">Tọa độ bản đồ · tùy chọn</strong>
                    <small className="wz-panel-hint block">Dán link Google Maps để tự điền vĩ độ / kinh độ</small>
                  </span>
                  <span className="wz-chip">{data.lat !== undefined && data.lng !== undefined ? '1/1' : '0/1'}</span>
                </summary>
                <div className="wz-fields">
                  <div className="wz-span">
                    <Field label="Link Google Maps">
                      <input
                        value={mapsLink}
                        placeholder="https://www.google.com/maps/@21.02,105.85,17z"
                        onChange={(e) => {
                          const value = e.target.value
                          setMapsLink(value)
                          const point = parseMapsLink(value)
                          if (point) {
                            setData((d) => ({ ...d, ...point }))
                            setMapsNote(`Đã điền toạ độ ${point.lat}, ${point.lng}.`)
                          } else
                            setMapsNote(
                              value.trim()
                                ? 'Không đọc được toạ độ từ link. Link rút gọn (maps.app.goo.gl) không dùng được, hãy mở link rồi sao chép địa chỉ đầy đủ hoặc nhập tay.'
                                : '',
                            )
                        }}
                      />
                    </Field>
                    {mapsNote && <p className="wz-panel-hint">{mapsNote}</p>}
                  </div>
                  {(['lat', 'lng'] as const).map((k) => (
                    <Field key={k} label={k === 'lat' ? 'Vĩ độ' : 'Kinh độ'}>
                      <input
                        type="number"
                        step="any"
                        min={k === 'lat' ? -90 : -180}
                        max={k === 'lat' ? 90 : 180}
                        value={data[k] ?? ''}
                        onChange={(e) => setData({ ...data, [k]: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </Field>
                  ))}
                </div>
              </details>
            </section>
          </fieldset>
          <ErrorNotice error={save.error} />
        </Panel>
        <div className="wz-stack wz-sticky">
          <Panel className="wz-panel">
            <p className="admin-caption mb-3">Xem trước thẻ sân</p>
            <div className="wz-preview">
              <div className="wz-preview-cover">
                <span className="wz-chip" data-tone="dark" style={{ position: 'absolute', top: 12, left: 12 }}>
                  {data.type}
                </span>
                Ảnh sân lấy từ poster sự kiện đầu tiên
              </div>
              <h2>{data.name?.trim() || 'Tên sân'}</h2>
              <p className="wz-venue-meta">
                {cities[data.city]}
                {data.district ? ` · ${data.district}` : ''}
              </p>
              <p className="admin-caption">
                {venue?.halls?.length ?? 0} hall · {type ? venueTypes[type] : ''}
              </p>
            </div>
          </Panel>
          <Panel className="wz-panel">
            <h2>Để sân dùng được cho suất diễn</h2>
            <p className="wz-panel-hint mb-4">3 việc, khoảng 5 phút</p>
            <ChecklistRow
              status={valid ? 'ok' : 'todo'}
              title="Thông tin sân"
              hint="Tên, loại, thành phố, địa chỉ đã hợp lệ"
            />
            <ChecklistRow
              status={venue?.halls?.length ? 'ok' : 'todo'}
              title="Ít nhất 1 hall"
              hint="Ví dụ: Sân chính, Khán đài B"
            />
            <ChecklistRow
              status="todo"
              title="Sơ đồ ghế đã phát hành"
              hint="SVG theo quy ước ZONE__<mã>__<loại>"
              action={
                <button type="button" onClick={() => setConvention((v) => !v)}>
                  Xem quy ước
                </button>
              }
            />
            {convention && <Convention />}
          </Panel>
        </div>
      </div>
    </WizardShell>
  )
}

function Convention() {
  return (
    <p className="admin-notice mt-3">
      Giữ nguyên toạ độ và hình học bản vẽ. Dùng ID <code>ZONE__MÃ__SEATED</code> cho khu ngồi,{' '}
      <code>ZONE__MÃ__STANDING__SỨC_CHỨA</code> cho khu đứng và <code>SEAT__MÃ__HÀNG__SỐ</code> cho ghế. Mỗi lần nhập
      tạo một phiên bản nháp mới.
    </p>
  )
}

/** Chọn bản sơ đồ đang làm việc: bản nháp mới nhất, nếu không có thì bản phát hành mới nhất. */
function currentLayout(layouts: SeatLayout[] | undefined): SeatLayout | undefined {
  if (!layouts?.length) return undefined
  const byVersion = [...layouts].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
  return byVersion.find((l) => l.status === 'DRAFT') ?? byVersion[0]
}

function VenueLayoutStep({ venue }: { venue: Venue }) {
  const navigate = useNavigate(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams()
  const [hallId, setHallId] = useState(venue.halls?.[0]?.id ?? ''),
    [hallName, setHallName] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [fileError, setFileError] = useState(''),
    [confirm, setConfirm] = useState(false)
  const layouts = useLayoutDirectory(hallId)
  const layout = currentLayout(layouts.data)
  const id = layout?.id ?? ''
  const detail = useGetSeatLayout(id, { query: { enabled: !!id } }),
    svg = useLayoutSvg(id)
  const hall = venue.halls?.find((h) => h.id === hallId)
  const done = params.get('done') === '1'
  const zones = detail.data?.zones ?? []
  const emptyZones = zones.filter((z) => z.capacity === 0)

  const addHall = useMutation({
    mutationFn: () => createHall(venue.id!, { name: hallName.trim() }),
    onSuccess: async (h) => {
      setHallName('')
      await client.invalidateQueries()
      if (h.id) setHallId(h.id)
      toast.success('Đã thêm hall')
    },
  })
  const importLayout = useMutation({
    mutationFn: () => importSeatLayoutSvg(hallId, { file: file!, name: file!.name.replace(/\.svg$/i, '') }),
    onSuccess: async () => {
      setFile(null)
      setPreview('')
      await client.invalidateQueries()
      toast.success('Đã nhập sơ đồ nháp')
    },
  })
  const publish = useMutation({
    mutationFn: () => publishSeatLayout(id),
    onSuccess: async () => {
      setConfirm(false)
      await client.invalidateQueries()
      toast.success('Đã phát hành sơ đồ')
      setParams({ step: '2', done: '1' })
    },
  })

  async function chooseFile(candidate?: File) {
    setFile(null)
    setPreview('')
    setFileError('')
    importLayout.reset()
    if (!candidate) return
    if (candidate.size > 10 * 1024 * 1024) return setFileError('File SVG tối đa 10 MiB.')
    const clean = sanitizeSvg(await candidate.text())
    if (!clean || !indexSvg(clean).zones.length)
      return setFileError('SVG phải có các khu ZONE__ theo quy ước sơ đồ Vingo.')
    setFile(candidate)
    setPreview(clean)
  }

  if (done)
    return (
      <VenueDone
        venue={venue}
        layout={layout}
        zoneCount={zones.length}
        seatCount={detail.data?.seat_count}
        emptyZones={emptyZones.map((z) => z.code)}
        onImport={() => setParams({ step: '2' })}
      />
    )

  const published = layout?.status === 'PUBLISHED'
  const primary = !hall ? (
    <AdminAction disabled>Thêm hall trước</AdminAction>
  ) : file ? (
    <AdminAction disabled={importLayout.isPending} onClick={() => importLayout.mutate()}>
      {importLayout.isPending ? 'Đang nhập…' : 'Nhập sơ đồ'}
    </AdminAction>
  ) : layout && !published ? (
    <AdminAction
      onClick={() => {
        publish.reset()
        setConfirm(true)
      }}
    >
      Phát hành sơ đồ v{layout.version}
    </AdminAction>
  ) : published ? (
    <AdminAction onClick={() => setParams({ step: '2', done: '1' })}>Hoàn tất</AdminAction>
  ) : (
    <AdminAction disabled>Chọn tệp SVG</AdminAction>
  )
  return (
    <WizardShell
      title="Hall & sơ đồ ghế"
      caption={`// ${venue.name?.toUpperCase()} · BƯỚC 2/2`}
      steps={stepItems(STEPS, 1)}
      onSelectStep={(i) => i === 0 && setParams({ step: '1' })}
      actions={
        <>
          <LightButton back onClick={() => navigate(`/admin/venues/${venue.id}/setup?step=1`)}>
            Quay lại
          </LightButton>
          <LightButton onClick={() => navigate('/admin/venues')}>Lưu nháp</LightButton>
          {primary}
        </>
      }
    >
      <div className="wz-grid wz-grid-side-left">
        <Panel className="wz-panel">
          <p className="admin-caption mb-3">Hall / khu vực</p>
          {venue.halls?.map((h) => (
            <HallItem key={h.id} hall={h} current={h.id === hallId} onSelect={() => setHallId(h.id!)} />
          ))}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (hallName.trim()) addHall.mutate()
            }}
          >
            <input
              aria-label="Tên hall mới"
              className="admin-input flex-1"
              maxLength={200}
              placeholder="Tên hall mới…"
              value={hallName}
              onChange={(e) => setHallName(e.target.value)}
            />
            <Button disabled={!hallName.trim() || addHall.isPending} className="admin-small-button">
              Thêm
            </Button>
          </form>
          <ErrorNotice error={addHall.error} />
          <p className="wz-soft mt-3">
            Mỗi hall có các phiên bản sơ đồ riêng. Suất diễn chọn hall + một sơ đồ đã phát hành.
          </p>
        </Panel>
        <Panel className="wz-panel">
          {!hall ? (
            <p className="admin-notice">Thêm hall để nhập phiên bản sơ đồ đầu tiên.</p>
          ) : (
            <QueryState query={layouts}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2>{layout ? `Sơ đồ v${layout.version} · ${hall.name}` : `Sơ đồ · ${hall.name}`}</h2>
                {layout && (
                  <span className="wz-chip" data-tone={published ? 'success' : 'warning'}>
                    {published ? 'Đã phát hành' : 'Bản nháp'}
                  </span>
                )}
              </div>
              <div className="wz-drop" data-active={!!file}>
                <FileText aria-hidden />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-medium">
                    {file?.name ?? (layout ? layout.name : 'Chưa có tệp SVG')}
                  </strong>
                  <small className="wz-panel-hint">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(1)} MB · chưa nhập`
                      : 'Chọn tệp SVG để nhập thành phiên bản nháp mới · tối đa 10 MiB'}
                  </small>
                </div>
                {preview && <span className="wz-chip">{indexSvg(preview).zones.length} khu</span>}
                {!preview && layout && <span className="wz-chip">{zones.length} khu</span>}
                {!preview && layout && (
                  <span className="wz-chip" data-tone="success">
                    {(detail.data?.seat_count ?? 0).toLocaleString('vi-VN')} ghế
                  </span>
                )}
                {!!emptyZones.length && !preview && (
                  <span className="wz-chip" data-tone="warning">
                    {emptyZones.length} cảnh báo
                  </span>
                )}
                <label className="admin-small-button inline-flex cursor-pointer items-center bg-surface">
                  {layout || file ? 'Chọn tệp khác' : 'Chọn tệp'}
                  <input
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="sr-only"
                    aria-label="Tệp SVG sơ đồ"
                    disabled={importLayout.isPending}
                    onChange={(e) => void chooseFile(e.target.files?.[0])}
                  />
                </label>
              </div>
              {fileError && (
                <p role="alert" className="admin-error mt-3">
                  {fileError}
                </p>
              )}
              <div className="mt-4 h-[360px] overflow-hidden rounded-xl bg-canvas">
                {preview ? (
                  <SeatMapView
                    svg={preview}
                    zones={Object.fromEntries(
                      indexSvg(preview).zones.map((z) => [z.code, { tier: 1, soldOut: false }]),
                    )}
                    selected={new Set()}
                    onZoneClick={() => {}}
                    onSeatClick={() => {}}
                    className="h-full"
                  />
                ) : layout && svg.data ? (
                  <SeatMapView
                    svg={svg.data}
                    zones={Object.fromEntries(
                      zones.map((z) => [z.code, z.capacity === 0 ? { soldOut: true } : { tier: 1, soldOut: false }]),
                    )}
                    selected={new Set()}
                    onZoneClick={() => {}}
                    onSeatClick={() => {}}
                    className="h-full"
                  />
                ) : (
                  <p className="grid h-full place-items-center px-6 text-center text-ink-tertiary">
                    {layout ? 'Đang tải sơ đồ…' : 'Chưa có sơ đồ. Chọn tệp SVG theo quy ước để xem trước tại đây.'}
                  </p>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                {preview && (
                  <div className="wz-callout">
                    <Check className="text-success" aria-hidden />
                    <div>
                      <strong>{indexSvg(preview).zones.length} khu đọc được từ tệp</strong>
                      <small>Bấm “Nhập sơ đồ” để tạo phiên bản nháp trên hệ thống.</small>
                    </div>
                  </div>
                )}
                {!preview && !!emptyZones.length && (
                  <div className="wz-callout" data-tone="warning">
                    <AlertTriangle className="wz-warn-text" aria-hidden />
                    <div>
                      <strong>
                        {emptyZones.length} khu chưa có sức chứa: {emptyZones.map((z) => z.code).join(', ')}
                      </strong>
                      <small>Khu không có ghế sẽ không bán được. Kiểm tra mã ghế trong SVG.</small>
                    </div>
                  </div>
                )}
                {!preview && !!zones.length && (
                  <div className="wz-callout">
                    <Check className="text-success" aria-hidden />
                    <div>
                      <strong>
                        {zones.length - emptyZones.length} khu, {(detail.data?.seat_count ?? 0).toLocaleString('vi-VN')}{' '}
                        ghế đọc được
                      </strong>
                      <small>Có thể phát hành; khu lỗi sẽ không được bán.</small>
                    </div>
                  </div>
                )}
                <p className="wz-note">
                  Sau khi phát hành, sơ đồ v{layout?.version ?? 1} bị khóa. Muốn chỉnh sửa → nhập SVG mới thành bản kế
                  tiếp; suất đã gắn bản cũ không bị ảnh hưởng.
                </p>
              </div>
              <ErrorNotice error={importLayout.error ?? layouts.error ?? detail.error} />
            </QueryState>
          )}
        </Panel>
      </div>
      {confirm && layout && (
        <ConfirmDialog
          open
          title={`Phát hành sơ đồ v${layout.version}?`}
          description="Sau khi phát hành, hình học sơ đồ được cố định và dùng được cho suất diễn. Muốn thay đổi ghế, hãy nhập một phiên bản mới."
          requireReason={false}
          label="Phát hành"
          pending={publish.isPending}
          error={publish.error}
          onClose={() => setConfirm(false)}
          onConfirm={() => publish.mutate()}
        />
      )}
    </WizardShell>
  )
}

function HallItem({ hall, current, onSelect }: { hall: Hall; current: boolean; onSelect: () => void }) {
  const layouts = useLayoutDirectory(hall.id!)
  const layout = currentLayout(layouts.data)
  return (
    <button type="button" className="wz-hall" aria-current={current} onClick={onSelect}>
      <span className="flex items-center justify-between gap-2">
        <strong className="font-medium">{hall.name}</strong>
        {!layouts.isPending && !layout && (
          <span className="wz-chip" data-tone="warning">
            Trống
          </span>
        )}
      </span>
      <small>
        {layouts.isPending
          ? 'Đang tải…'
          : !layout
            ? 'Chưa có sơ đồ'
            : layout.status === 'PUBLISHED'
              ? `Sơ đồ v${layout.version} đã phát hành`
              : `Đang nhập sơ đồ v${layout.version}`}
      </small>
    </button>
  )
}

function VenueDone({
  venue,
  layout,
  zoneCount,
  seatCount,
  emptyZones,
  onImport,
}: {
  venue: Venue
  layout?: SeatLayout
  zoneCount: number
  seatCount?: number
  emptyZones: string[]
  onImport: () => void
}) {
  return (
    <WizardShell
      title={venue.name ?? 'Sân'}
      caption="// CATALOG · SÂN MỚI · HOÀN TẤT"
      steps={stepItems(STEPS, 2, true)}
      actions={<LightButton onClick={onImport}>Nhập sơ đồ SVG</LightButton>}
    >
      <section className="wz-done">
        <span className="wz-done-mark">
          <Check size={32} strokeWidth={3} aria-hidden />
        </span>
        <h2>Sân đã sẵn sàng</h2>
        <p className="text-ink-secondary">{venue.name} có thể được chọn khi tạo suất diễn.</p>
        <div className="wz-done-stats">
          {[
            [venue.halls?.length ?? 0, 'Hall'],
            [layout ? `v${layout.version}` : '—', 'Sơ đồ'],
            [zoneCount - emptyZones.length, 'Khu bán được'],
            [(seatCount ?? 0).toLocaleString('vi-VN'), 'Ghế'],
          ].map(([value, label]) => (
            <div key={label} className="wz-stat">
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          ))}
        </div>
        {!!emptyZones.length && (
          <div className="wz-callout w-full text-left" data-tone="warning">
            <AlertTriangle className="wz-warn-text" aria-hidden />
            <div>
              <strong>
                {emptyZones.length} khu không bán được: {emptyZones.join(', ')}
              </strong>
              <small>Khu chưa có sức chứa. Nhập sơ đồ v{(layout?.version ?? 1) + 1} để mở bán các khu này.</small>
            </div>
          </div>
        )}
        <div className="wz-done-actions">
          <AdminLinkAction to={`/admin/events/new?venueId=${venue.id}`}>Tạo sự kiện ở sân này</AdminLinkAction>
          <LightLink to="/admin/venues">Về danh sách sân</LightLink>
        </div>
        <p className="wz-panel-hint">
          “Tạo sự kiện ở sân này” mở wizard sự kiện, bước Suất diễn chọn sẵn sân và sơ đồ v{layout?.version ?? 1}.
        </p>
      </section>
    </WizardShell>
  )
}
