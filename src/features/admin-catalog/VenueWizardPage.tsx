import { useEffect, useRef, useState } from 'react'
import { FileCode2, Upload } from 'lucide-react'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createVenueImport,
  getVenueImport,
  listVenueImports,
  updateVenueImport,
  uploadVenueImportFiles,
  deleteVenueImportFile,
  previewVenueImport,
  completeVenueImport,
  cancelVenueImport,
} from '@/api/generated/endpoints/venue-imports/venue-imports'
import type {
  VenueImportDraft,
  VenueImportSession,
  VenueImportPreview,
  VenueImportResult,
  VenueImportSessionStep,
  VenueInput,
} from '@/api/generated/model'
import { AdminPage, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { ApiError } from '@/api/problem'
import { VenueSetupFields } from './VenueSetupFields'
import { LayoutPreview } from './LayoutPreview'
import { VenueWorkspace } from './VenueWorkspace'
import './venue-console.css'

const steps = ['OVERVIEW', 'LAYOUT', 'PREVIEW', 'DETAILS', 'REVIEW'] as const
const labels = ['SVG tổng quát', 'Layout & chi tiết', 'Mapping & preview', 'Thông tin sân', 'Kiểm tra & lưu']
const blank: VenueImportDraft = {
  overview_name: 'Nền sân',
  layout_name: '',
  layout_type: 'FOOTBALL',
  zone_areas: {},
  venue: { name: '', address: '', city: 'HN' },
}

const layoutNames = { FOOTBALL: 'Bóng đá', CONCERT: 'Concert' } as const

function inferLayoutType(filename = ''): keyof typeof layoutNames | undefined {
  const name = filename.replace(/\.svg$/i, '').toLowerCase()
  const football = /football|bong[ _-]?da|bóng[ _-]?đá/.test(name)
  const concert = /concert/.test(name)
  if (football === concert) return undefined
  return football ? 'FOOTBALL' : 'CONCERT'
}

export default function VenueWizardPage() {
  const { venueId } = useParams()
  const [params] = useSearchParams()
  return venueId && !params.has('import') && !params.has('session') ? (
    <VenueWorkspace venueId={venueId} />
  ) : (
    <ImportWizard key={params.get('session') ?? 'new'} venueId={venueId} />
  )
}

function ImportWizard({ venueId }: { venueId?: string }) {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [session, setSession] = useState<VenueImportSession>()
  const [draft, setDraft] = useState<VenueImportDraft>(blank)
  const [step, setStep] = useState<VenueImportSessionStep>('DETAILS')
  const [preview, setPreview] = useState<VenueImportPreview>()
  const [result, setResult] = useState<VenueImportResult>()
  const [baseline, setBaseline] = useState(JSON.stringify(blank))
  const [uploading, setUploading] = useState<{ overview: boolean; names: string[] }>()
  const [fileError, setFileError] = useState('')
  const lock = useRef(false)
  const dirty = JSON.stringify(draft) !== baseline
  const blocker = useBlocker(dirty)
  const sessionId = params.get('session')
  const load = useQuery({
    queryKey: ['venue-import', sessionId],
    queryFn: () => getVenueImport(sessionId!),
    enabled: !!sessionId,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const drafts = useQuery({ queryKey: ['venue-import-drafts'], queryFn: () => listVenueImports({ limit: 100 }) })
  function accept(s: VenueImportSession) {
    setSession(s)
    setDraft(s.draft_data ?? blank)
    setBaseline(JSON.stringify(s.draft_data ?? blank))
    setStep(s.step ?? 'OVERVIEW')
    setPreview(undefined)
    setResult(s.result)
  }
  useEffect(() => {
    if (load.data) accept(load.data)
  }, [load.data])
  useEffect(() => {
    if (!dirty) return
    const stop = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', stop)
    return () => window.removeEventListener('beforeunload', stop)
  }, [dirty])
  const action = useMutation({
    mutationFn: async (work: () => Promise<void>) => {
      try {
        await work()
      } finally {
        lock.current = false
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['venue-import-drafts'] })
    },
  })
  const run = (work: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true
    action.mutate(work)
  }
  async function save(next = step, nextDraft = draft) {
    if (!session?.id || session.revision === undefined) throw new Error('Hãy tạo hoặc mở phiên nháp trước.')
    const s = await updateVenueImport(session.id, {
      revision: session.revision,
      step: next,
      draft_data: withFileTypes(nextDraft),
    })
    accept(s)
    return s
  }
  function change(next: VenueImportDraft) {
    setDraft(next)
    setPreview(undefined)
  }
  function venueField<K extends keyof VenueInput>(key: K, value: VenueInput[K]) {
    change({ ...draft, venue: { ...draft.venue, [key]: value } })
  }
  const files = session?.files ?? []
  const overview = files.find((f) => f.role === 'OVERVIEW')?.sanitized_svg
  const index = step === 'DETAILS' ? 0 : 1
  const venueReady = !!venueId || !!(draft.venue?.name?.trim() && draft.venue?.address?.trim())
  const overviewReady = !!overview || !!session?.draft_data?.overview_id
  const detailFiles = files.filter((file) => file.role === 'SEAT_LAYOUT')
  const typeFor = (fileId?: string) =>
    draft.file_layout_types?.[fileId ?? ''] ??
    inferLayoutType(detailFiles.find((file) => file.id === fileId)?.original_filename)
  const layoutTypes = Object.keys(layoutNames).filter((type) =>
    detailFiles.some((file) => typeFor(file.id) === type),
  ) as (keyof typeof layoutNames)[]
  const activeLayout = layoutTypes.find((type) => type === draft.layout_type) ?? layoutTypes[0]
  const readyToCheck =
    !!overviewReady &&
    detailFiles.length > 0 &&
    files.every((file) => file.validation_status === 'VALIDATED') &&
    detailFiles.every((file) => !!typeFor(file.id))

  function withFileTypes(nextDraft: VenueImportDraft): VenueImportDraft {
    const fileTypes: NonNullable<VenueImportDraft['file_layout_types']> = {}
    for (const file of detailFiles) {
      const type = typeFor(file.id)
      if (file.id && type) fileTypes[file.id] = type
    }
    return {
      ...nextDraft,
      file_layout_types: fileTypes,
      layout_type: layoutTypes.find((type) => type === nextDraft.layout_type) ?? activeLayout ?? nextDraft.layout_type,
    }
  }
  const canNext = readyToCheck && preview?.valid !== false
  function assignType(fileId: string, type: NonNullable<VenueImportDraft['layout_type']>) {
    change({
      ...draft,
      layout_type: type,
      zone_areas: {},
      file_layout_types: { ...draft.file_layout_types, [fileId]: type },
    })
  }
  function uploadFiles(chosen: File[], isOverview: boolean) {
    if (lock.current || !chosen.length) return
    setFileError('')
    if (isOverview ? overviewReady : !overviewReady) return
    if (
      (isOverview && chosen.length !== 1) ||
      chosen.length > 32 ||
      chosen.some((f) => !f.name.toLowerCase().endsWith('.svg') || f.size > 10 * 1024 * 1024) ||
      chosen.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024
    ) {
      setFileError(isOverview ? 'Chọn một tệp SVG nền, tối đa 10 MiB.' : 'Chọn tối đa 32 tệp SVG, tổng tối đa 10 MiB.')
      return
    }
    setUploading({ overview: isOverview, names: chosen.map((file) => file.name) })
    run(async () => {
      try {
        const nextDraft = isOverview ? { ...draft, overview_name: chosen[0].name.slice(0, 200) } : draft
        const s = await updateVenueImport(session!.id!, {
          revision: session!.revision!,
          step,
          draft_data: withFileTypes(nextDraft),
        })
        accept(s)
        accept(
          await uploadVenueImportFiles(s.id!, {
            revision: s.revision!,
            files: chosen.map((f) => new File([f], f.name, { type: 'image/svg+xml' })),
          }),
        )
      } finally {
        setUploading(undefined)
      }
    })
  }
  async function validate(type: keyof typeof layoutNames) {
    const nextDraft = draft.layout_type === type ? draft : { ...draft, layout_type: type, zone_areas: {} }
    const s = await save(step, nextDraft)
    setPreview(await previewVenueImport(s.id!, { revision: s.revision! }))
  }
  async function finish() {
    const current = await getVenueImport(session!.id!)
    if (current.result) {
      accept(current)
      return
    }
    const s = await save()
    const p = await previewVenueImport(s.id!, { revision: s.revision! })
    setPreview(p)
    if (!p.valid) {
      setStep('PREVIEW')
      return
    }
    try {
      setResult(await completeVenueImport(s.id!, { revision: s.revision! }))
    } catch (error) {
      const recovered = await getVenueImport(s.id!).catch(() => undefined)
      if (recovered?.result) accept(recovered)
      else throw error
    }
    await client.invalidateQueries({ queryKey: ['admin-venue-directory'] })
    await client.invalidateQueries({ queryKey: ['admin-layout-directory'] })
  }
  return (
    <AdminPage
      title={venueId ? 'Thêm layout cho sân' : 'Tạo sân từ SVG'}
      caption="THÔNG TIN SÂN → SƠ ĐỒ, LAYOUT & LƯU"
      actions={<Link to={venueId ? `/admin/venues/${venueId}/setup` : '/admin/venues'}>Quay về danh sách</Link>}
    >
      <div className="venue-import-shell">
        {!sessionId && !session && (
          <Panel className="venue-card space-y-4">
            <h2>Bắt đầu từ thông tin sân</h2>
            <p>Nháp lưu trên server trong 30 ngày. Tệp nền và chi tiết dùng cùng viewBox; mỗi lần tải tối đa 10 MiB.</p>
            <Button
              disabled={action.isPending}
              onClick={() =>
                run(async () => {
                  const s = await createVenueImport(venueId ? { target_venue_id: venueId } : {})
                  const initial = await updateVenueImport(s.id!, { revision: s.revision!, step: 'DETAILS' })
                  accept(initial)
                  client.setQueryData(['venue-import', initial.id], initial)
                  setParams({ session: s.id! }, { replace: true })
                })
              }
            >
              Tạo phiên nháp
            </Button>
            <QueryState query={drafts} empty={!drafts.data?.data?.length} emptyText="Chưa có phiên nháp.">
              <ul>
                {drafts.data?.data
                  ?.filter((s) => (s.target_venue_id ?? undefined) === venueId)
                  .map((s) => (
                    <li key={s.id}>
                      <Link to={`?session=${s.id}`}>
                        Mở lại: {s.draft_data?.layout_name || s.draft_data?.venue?.name || 'Nháp chưa đặt tên'} ·{' '}
                        {labels[steps.indexOf(s.step ?? 'OVERVIEW')]}
                      </Link>
                    </li>
                  ))}
              </ul>
            </QueryState>
          </Panel>
        )}
        {sessionId && !session && <QueryState query={load}>{null}</QueryState>}
        {session && (
          <>
            <p role="status">
              {action.isPending ? 'Đang xử lý…' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu nháp trên server'} · revision{' '}
              {session.revision}
            </p>
            {result ? (
              <Panel className="venue-card space-y-4">
                <h2>Đã lưu sân và layout nháp</h2>
                <p>Dữ liệu đã lưu đầy đủ. Kiểm tra và phát hành trong màn quản lý sân.</p>
                <Link to={`/admin/venues/${result.venue_id}/setup?layout=${result.layout_id}`}>
                  Mở layout vừa tạo →
                </Link>
              </Panel>
            ) : session.status !== 'DRAFT' ? (
              <p>Phiên đã hủy. Hãy tạo phiên mới.</p>
            ) : (
              <>
                <nav className="venue-import-steps" aria-label="Các bước nhập sân">
                  {['Thông tin sân', 'Sơ đồ, layout & lưu'].map((label, i) => (
                    <Button
                      key={label}
                      variant={i === index ? 'default' : 'outline'}
                      aria-current={i === index ? 'step' : undefined}
                      disabled={action.isPending || (i === 1 && !venueReady)}
                      onClick={() =>
                        run(async () => {
                          await save(i === 0 ? 'DETAILS' : 'OVERVIEW')
                        })
                      }
                    >
                      {i + 1}. {label}
                    </Button>
                  ))}
                </nav>
                <fieldset disabled={action.isPending} className="venue-import-fieldset">
                  <Panel className="venue-card space-y-4">
                    <h2>
                      {index + 1}. {index === 0 ? 'Thông tin sân' : 'Sơ đồ, layout & lưu'}
                    </h2>
                    {index === 1 && (
                      <>
                        <div className="venue-svg-stack">
                          {[true, false].map((isOverview) => {
                            const sectionFiles = files.filter((file) => (file.role === 'OVERVIEW') === isOverview)
                            const canUpload = isOverview ? !overviewReady : !!overviewReady
                            return (
                              <section
                                key={String(isOverview)}
                                className={`venue-svg-section ${isOverview ? '' : 'venue-svg-section-detail'}`}
                                onDragOver={(e) => {
                                  e.preventDefault()
                                  e.dataTransfer.dropEffect = canUpload ? 'copy' : 'none'
                                }}
                                onDrop={(e) => {
                                  e.preventDefault()
                                  if (canUpload) uploadFiles(Array.from(e.dataTransfer.files), isOverview)
                                }}
                              >
                                <header className="venue-svg-heading">
                                  <div>
                                    <h3>{isOverview ? 'SVG tổng quan' : 'Layout zone/ghế'}</h3>
                                    <p>
                                      {isOverview
                                        ? 'Nền dùng chung cho các layout bên dưới.'
                                        : 'Mỗi loại layout dùng một hoặc nhiều tệp SVG.'}
                                    </p>
                                  </div>
                                  {!isOverview && detailFiles.length > 0 && (
                                    <span className="venue-svg-tag">
                                      {detailFiles.length} tệp · {layoutTypes.length} loại
                                    </span>
                                  )}
                                </header>
                                {canUpload && (
                                  <label className="venue-svg-chooser">
                                    <Upload size={17} aria-hidden="true" />
                                    <span>
                                      {sectionFiles.length
                                        ? 'Thêm SVG zone/ghế'
                                        : isOverview
                                          ? 'Chọn SVG tổng quan'
                                          : 'Chọn SVG zone/ghế'}
                                    </span>
                                    <small>hoặc kéo thả vào đây</small>
                                    <input
                                      className="sr-only"
                                      type="file"
                                      accept=".svg,image/svg+xml"
                                      multiple={!isOverview}
                                      aria-label={isOverview ? 'Tệp SVG nền' : 'Tệp SVG zone/ghế'}
                                      onChange={(e) => {
                                        uploadFiles(Array.from(e.target.files ?? []), isOverview)
                                        e.target.value = ''
                                      }}
                                    />
                                  </label>
                                )}
                                {!isOverview && !canUpload && (
                                  <p className="venue-svg-hint">Tải SVG tổng quan để mở phần này.</p>
                                )}
                                {(sectionFiles.length > 0 || uploading?.overview === isOverview) && (
                                  <ul
                                    className="venue-svg-files"
                                    aria-label={isOverview ? 'Tệp nền đã chọn' : 'Tệp zone/ghế đã chọn'}
                                  >
                                    {uploading?.overview === isOverview &&
                                      uploading.names.map((name, fileIndex) => (
                                        <li key={fileIndex} className="venue-svg-row" role="status">
                                          {name} · Đang tải…
                                        </li>
                                      ))}
                                    {sectionFiles.map((file) => (
                                      <li key={file.id} className="venue-svg-file">
                                        <div className="venue-svg-row">
                                          <FileCode2 size={18} aria-hidden="true" />
                                          <div className="venue-svg-filename">
                                            <strong>{file.original_filename}</strong>
                                            <small>
                                              {file.validation_status === 'VALIDATED' ? 'Hợp lệ' : 'Cần kiểm tra tệp'}
                                            </small>
                                          </div>
                                          {!isOverview && file.role === 'SEAT_LAYOUT' && (
                                            <select
                                              aria-label={`Loại layout — ${file.original_filename}`}
                                              value={typeFor(file.id) ?? ''}
                                              onChange={(e) => {
                                                const type = e.target.value
                                                if (type === 'FOOTBALL' || type === 'CONCERT')
                                                  assignType(file.id!, type)
                                              }}
                                            >
                                              <option value="" disabled>
                                                Chọn loại
                                              </option>
                                              <option value="FOOTBALL">Bóng đá</option>
                                              <option value="CONCERT">Concert</option>
                                            </select>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Bỏ tệp ${file.original_filename}`}
                                            onClick={() =>
                                              run(async () => {
                                                const saved = await save()
                                                accept(
                                                  await deleteVenueImportFile(saved.id!, file.id!, {
                                                    revision: saved.revision!,
                                                  }),
                                                )
                                              })
                                            }
                                          >
                                            Bỏ tệp
                                          </Button>
                                        </div>
                                        {file.issues?.map((issue, i) => (
                                          <p className="venue-svg-file-error" role="alert" key={i}>
                                            {issue.message || issue.reason}
                                          </p>
                                        ))}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </section>
                            )
                          })}
                        </div>
                        {fileError && <p role="alert">{fileError}</p>}
                      </>
                    )}
                    {index === 1 && (
                      <>
                        {overview && layoutTypes.length === 0 && (
                          <section className="venue-svg-section">
                            <h3 className="font-semibold">Xem trước SVG tổng quan</h3>
                            <LayoutPreview overview={overview} details={[]} label="Tổng quan" />
                            <OverviewSummary svg={overview} />
                          </section>
                        )}
                        {overview &&
                          layoutTypes.map((type) => {
                            const sources = detailFiles.filter((file) => typeFor(file.id) === type)
                            const checked = activeLayout === type ? preview : undefined
                            return (
                              <section className="venue-svg-section" key={type}>
                                <header className="venue-svg-heading">
                                  <div>
                                    <h3>{layoutNames[type]}</h3>
                                    <p>{sources.length} tệp zone/ghế · Cùng SVG tổng quan</p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!readyToCheck}
                                    onClick={() => run(() => validate(type))}
                                  >
                                    Kiểm tra sơ đồ
                                  </Button>
                                </header>
                                <LayoutPreview
                                  overview={checked?.overview_svg ?? overview}
                                  details={
                                    checked?.detail_svg
                                      ? [checked.detail_svg]
                                      : sources.flatMap((file) => (file.sanitized_svg ? [file.sanitized_svg] : []))
                                  }
                                  label={layoutNames[type]}
                                />
                                {checked && (
                                  <div className="venue-svg-check space-y-2">
                                    <p>
                                      {checked.gates?.length ?? 0} cổng · {checked.areas?.length ?? 0} vùng nền ·{' '}
                                      {checked.zones?.length ?? 0} zone ·{' '}
                                      {checked.zones?.reduce((total, zone) => total + zone.seat_count, 0) ?? 0} ghế ·{' '}
                                      {checked.zones?.reduce(
                                        (total, zone) => total + (zone.kind === 'STANDING' ? zone.capacity : 0),
                                        0,
                                      ) ?? 0}{' '}
                                      chỗ đứng
                                    </p>
                                    {(checked.zones?.length ?? 0) > 0 && (
                                      <details className="venue-svg-details">
                                        <summary>Chỉnh vùng nền theo zone</summary>
                                        <div className="venue-setup-fields">
                                          {checked.zones?.map((z) => (
                                            <Field
                                              key={z.code}
                                              label={`${z.code} · ${z.kind === 'SEATED' ? `${z.seat_count} ghế` : `${z.capacity} chỗ đứng`}`}
                                            >
                                              <select
                                                value={draft.zone_areas?.[z.code] ?? checked.zone_areas?.[z.code] ?? ''}
                                                onChange={(e) => {
                                                  const mapping = { ...checked.zone_areas, ...draft.zone_areas }
                                                  if (e.target.value) mapping[z.code] = e.target.value
                                                  else delete mapping[z.code]
                                                  setDraft({ ...draft, zone_areas: mapping })
                                                  setPreview({ ...checked, valid: false })
                                                }}
                                              >
                                                <option value="">Tự nhận diện vùng chứa</option>
                                                {checked.areas?.map((a) => (
                                                  <option value={a.code} key={a.code}>
                                                    {a.name || a.code}
                                                  </option>
                                                ))}
                                              </select>
                                            </Field>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                    {checked.issues?.map((issue, i) => (
                                      <p role="alert" key={i}>
                                        {issue.reason}: {issue.message} {issue.zone_id} {issue.gate_id}
                                      </p>
                                    ))}
                                    <p role="status">
                                      {checked.valid
                                        ? 'Hình học và mapping hợp lệ'
                                        : 'Cần sửa tệp hoặc mapping và kiểm tra lại'}
                                    </p>
                                  </div>
                                )}
                              </section>
                            )
                          })}
                      </>
                    )}
                    {index === 0 &&
                      (venueId ? (
                        <p>Layout thuộc sân hiện tại. Chỉnh thông tin sân tại màn quản lý sân.</p>
                      ) : (
                        <div className="venue-setup-fields">
                          <Field label="Tên sân *">
                            <input
                              required
                              maxLength={200}
                              value={draft.venue?.name ?? ''}
                              onChange={(e) => venueField('name', e.target.value)}
                            />
                          </Field>
                          <div className="venue-setup-full-width">
                            <VenueSetupFields draft={draft} onChange={change} pending={action.isPending} />
                          </div>
                        </div>
                      ))}
                    {index === 1 && (
                      <p className="venue-svg-hint">
                        Layout được lưu dưới dạng nháp. Bạn có thể phát hành tại màn quản lý sân.
                      </p>
                    )}
                  </Panel>
                  <div className="venue-inline-actions">
                    {index > 0 && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          run(async () => {
                            await save('DETAILS')
                          })
                        }
                      >
                        Quay lại
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          await save()
                        })
                      }
                    >
                      Lưu nháp
                    </Button>
                    {index === 0 ? (
                      <Button
                        disabled={!venueReady}
                        onClick={() =>
                          run(async () => {
                            await save('OVERVIEW')
                          })
                        }
                      >
                        Tiếp tục
                      </Button>
                    ) : (
                      <Button disabled={!canNext} onClick={() => run(finish)}>
                        Lưu sân & layout
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(async () => {
                          accept(await cancelVenueImport(session.id!, { revision: session.revision! }))
                        })
                      }
                    >
                      Hủy phiên nháp
                    </Button>
                  </div>
                </fieldset>
              </>
            )}
          </>
        )}
        <ErrorNotice error={action.error} />
        {action.error instanceof ApiError && action.error.status === 409 && session?.id && (
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() =>
              run(async () => {
                accept(await getVenueImport(session.id!))
              })
            }
          >
            Tải bản mới nhất từ server (bỏ thay đổi cục bộ)
          </Button>
        )}
        {blocker.state === 'blocked' && (
          <div className="venue-leave-backdrop">
            <dialog open className="venue-leave-dialog" aria-labelledby="leave-import-title">
              <h2 id="leave-import-title">Có thay đổi chưa lưu</h2>
              <p>File đã tải vẫn được giữ trong nháp. Lưu thông tin trước khi rời trang để mở lại đầy đủ.</p>
              <Button onClick={() => blocker.reset?.()}>Tiếp tục chỉnh sửa</Button>
              <Button variant="outline" onClick={() => blocker.proceed?.()}>
                Rời trang
              </Button>
            </dialog>
          </div>
        )}
      </div>
    </AdminPage>
  )
}

function OverviewSummary({ svg }: { svg: string }) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const areas = Array.from(doc.querySelectorAll('[id^="AREA__"]'))
  const gates = Array.from(doc.querySelectorAll('[id^="GATE__"]'))
  return (
    <details className="venue-svg-details">
      <summary>
        {areas.length} vùng nền · {gates.length} cổng
      </summary>
      <ul className="venue-svg-inventory" aria-label="Vùng và cổng đã nhận diện">
        {[...areas, ...gates].map((element) => (
          <li key={element.id}>{element.id}</li>
        ))}
      </ul>
    </details>
  )
}
