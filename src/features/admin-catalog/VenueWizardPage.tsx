import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Check, FileCode2, FileText, LoaderCircle, Lock, Upload } from 'lucide-react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createVenueImport,
  getVenueImport,
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
  VenueImportIssue,
  VenueInput,
} from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { AdminPage, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { ApiError } from '@/api/problem'
import { VenueSetupFields } from './VenueSetupFields'
import { LayoutPreview } from './LayoutPreview'
import { VenueWorkspace } from './VenueWorkspace'
import './venue-console.css'
import { useVenueDrafts, venueDraftsKey } from './catalog'
import { useVenueOverviews } from './useVenueOverviews'

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

function hasVenueDetails(venue?: VenueInput) {
  return !!(venue?.name?.trim() && venue.address?.trim() && venue.city?.trim())
}

function importIssueText(issue: VenueImportIssue) {
  const ids = [...new Set([issue.layer_id, issue.zone_id, issue.gate_id].filter(Boolean))]
  const measurement =
    issue.intersection_area !== undefined && issue.tolerance !== undefined
      ? ` · Diện tích: ${issue.intersection_area.toPrecision(4)}; ngưỡng: ${issue.tolerance.toPrecision(4)} SVG²`
      : ''
  return `${issue.reason}: ${issue.message}${ids.length ? ` · ${ids.join(' · ')}` : ''}${measurement}`
}

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
    <VenueWorkspace key={venueId} venueId={venueId} />
  ) : (
    <ImportWizard key={params.get('session') ?? 'new'} venueId={venueId} />
  )
}

function ImportWizard({ venueId }: { venueId?: string }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [session, setSession] = useState<VenueImportSession>()
  const [draft, setDraft] = useState<VenueImportDraft>(blank)
  const [step, setStep] = useState<VenueImportSessionStep>('DETAILS')
  const [preview, setPreview] = useState<VenueImportPreview>()
  const [result, setResult] = useState<VenueImportResult>()
  const [baseline, setBaseline] = useState(JSON.stringify(blank))
  const [checkingLayout, setCheckingLayout] = useState(false)
  const [dragTarget, setDragTarget] = useState<boolean>()
  const [uploading, setUploading] = useState<{ overview: boolean; names: string[] }>()
  const [fileError, setFileError] = useState('')
  const lock = useRef(false)
  const completed = useRef(false)
  const [finishPhase, setFinishPhase] = useState<'checking' | 'saving'>()
  const dirty = JSON.stringify(draft) !== baseline
  const blocker = useBlocker(() => dirty && !completed.current)
  const sessionId = params.get('session')
  const overviews = useVenueOverviews(venueId, !sessionId)
  const [overviewChoice, setOverviewChoice] = useState(params.get('overview') ?? '')
  const reusableOverviews = overviews.data ?? []
  const selectedBase = reusableOverviews.find((item) => item.id === overviewChoice)
  const requestedType = params.get('type') === 'CONCERT' ? 'CONCERT' : 'FOOTBALL'
  const load = useQuery({
    queryKey: ['venue-import', sessionId],
    queryFn: () => getVenueImport(sessionId!),
    enabled: !!sessionId,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const drafts = useVenueDrafts()
  const started = useRef(false)
  function accept(s: VenueImportSession, keepPreview = false) {
    if (completed.current && !s.result) return
    completed.current = !!s.result
    setSession(s)
    setDraft(s.draft_data ?? blank)
    setBaseline(JSON.stringify(s.draft_data ?? blank))
    // Schema v2 chỉ lưu dữ liệu nháp. Chuyển bước trên web không phụ thuộc step trong response.
    if (!session) {
      setStep(!venueId && !hasVenueDetails(s.draft_data?.venue) ? 'DETAILS' : (s.step ?? 'OVERVIEW'))
    }
    if (!keepPreview) setPreview(undefined)
    setResult(s.result)
  }
  useEffect(() => {
    if (load.data) accept(load.data)
  }, [load.data])
  useEffect(() => {
    if (!result) return
    const search = new URLSearchParams({
      tab: 'layout',
      type: draft.layout_type ?? 'FOOTBALL',
      layout: result.layout_id,
    })
    void navigate(`/admin/venues/${result.venue_id}/setup?${search}`, { replace: true })
  }, [result, draft.layout_type, navigate])
  useEffect(() => {
    if (!dirty || result) return
    const stop = (e: BeforeUnloadEvent) => {
      if (completed.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', stop)
    return () => window.removeEventListener('beforeunload', stop)
  }, [dirty, result])
  const action = useMutation({
    mutationFn: async (work: () => Promise<void>) => {
      try {
        await work()
      } finally {
        lock.current = false
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: venueDraftsKey })
    },
  })
  const mutate = action.mutate
  const run = useCallback(
    (work: () => Promise<void>) => {
      if (lock.current) return
      lock.current = true
      mutate(work)
    },
    [mutate],
  )
  const startNewVenue = useCallback(() => {
    run(async () => {
      const created = await createVenueImport({})
      setParams({ session: created.id! }, { replace: true })
    })
  }, [run, setParams])
  useEffect(() => {
    if (venueId || sessionId || started.current) return
    started.current = true
    startNewVenue()
  }, [venueId, sessionId, startNewVenue])
  async function save(next = step, nextDraft = draft, keepPreview = false) {
    if (!session?.id || session.revision === undefined) throw new Error('Hãy tạo hoặc mở phiên nháp trước.')
    const s = await updateVenueImport(session.id, {
      revision: session.revision,
      step: next,
      draft_data: withFileTypes(nextDraft),
    })
    accept(s, keepPreview)
    setStep(next)
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
  const venueReady = !!venueId || hasVenueDetails(draft.venue)
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

  function withFileTypes(nextDraft: VenueImportDraft, sourceFiles = detailFiles): VenueImportDraft {
    const fileTypes: NonNullable<VenueImportDraft['file_layout_types']> = {}
    for (const file of sourceFiles) {
      const type = nextDraft.file_layout_types?.[file.id ?? ''] ?? inferLayoutType(file.original_filename)
      if (file.id && type) fileTypes[file.id] = type
    }
    const types = Object.values(fileTypes)
    return {
      ...prepareDraft(nextDraft),
      file_layout_types: fileTypes,
      layout_type: types.find((type) => type === nextDraft.layout_type) ?? types[0] ?? nextDraft.layout_type,
    }
  }
  function prepareDraft(nextDraft: VenueImportDraft): VenueImportDraft {
    const body = { ...nextDraft }
    // Phiên thêm layout chỉ gửi cấu hình sơ đồ, không cập nhật thông tin sân đích.
    if (venueId) delete body.venue
    return body
  }
  const saveBlockers = [
    ...(!venueReady ? ['Chưa đủ tên sân, địa chỉ và tỉnh/thành. Quay lại bước Thông tin sân để bổ sung.'] : []),
    ...(!overviewReady ? ['Chưa có SVG tổng quan hợp lệ.'] : []),
    ...(!detailFiles.length ? ['Chưa có tệp SVG zone/ghế.'] : []),
    ...files
      .filter((file) => file.validation_status !== 'VALIDATED')
      .map((file) => `${file.original_filename}: tệp chưa hợp lệ. Xem lỗi và ID layer ở thẻ tệp phía trên.`),
    ...detailFiles
      .filter((file) => !typeFor(file.id))
      .map((file) => `${file.original_filename}: chưa chọn loại layout.`),
    ...(preview?.valid === false
      ? ['Sơ đồ hoặc mapping chưa hợp lệ. Xem lỗi phía trên và kiểm tra lại sau khi sửa.']
      : []),
  ]
  const canNext = readyToCheck && saveBlockers.length === 0
  function assignType(fileId: string, type: NonNullable<VenueImportDraft['layout_type']>) {
    const updated = {
      ...draft,
      layout_type: type,
      zone_areas: {},
      file_layout_types: { ...draft.file_layout_types, [fileId]: type },
    }
    change(updated)
    if (session) run(() => checkUpdatedLayout(session, updated))
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
        let current = session!
        if (isOverview || dirty || current.step !== step) {
          current = await updateVenueImport(current.id!, {
            revision: current.revision!,
            step,
            draft_data: withFileTypes(nextDraft),
          })
          accept(current)
        }
        const uploaded = await uploadVenueImportFiles(current.id!, {
          revision: current.revision!,
          files: chosen.map((f) => new File([f], f.name, { type: 'image/svg+xml' })),
        })
        accept(uploaded)
        setUploading(undefined)
        if (!isOverview) await checkUpdatedLayout(uploaded, uploaded.draft_data ?? nextDraft)
      } finally {
        setUploading(undefined)
      }
    })
  }
  async function checkUpdatedLayout(current: VenueImportSession, nextDraft: VenueImportDraft) {
    const currentFiles = current.files ?? []
    const details = currentFiles.filter((file) => file.role === 'SEAT_LAYOUT')
    const prepared = withFileTypes(nextDraft, details)
    const type = prepared.layout_type
    const hasOverview =
      prepared.overview_id || currentFiles.some((file) => file.role === 'OVERVIEW' && file.sanitized_svg)
    if (
      !type ||
      !hasOverview ||
      !details.length ||
      currentFiles.some((file) => file.validation_status !== 'VALIDATED') ||
      details.some((file) => !file.id || !prepared.file_layout_types?.[file.id])
    )
      return

    setCheckingLayout(true)
    try {
      let saved = current
      if (current.step !== step || JSON.stringify(prepared) !== JSON.stringify(current.draft_data)) {
        saved = await updateVenueImport(current.id!, {
          revision: current.revision!,
          step,
          draft_data: prepared,
        })
        accept(saved, true)
      }
      setPreview(await previewVenueImport(saved.id!, { revision: saved.revision! }))
    } finally {
      setCheckingLayout(false)
    }
  }
  async function validate(type: keyof typeof layoutNames) {
    if (!session) return
    const nextDraft = draft.layout_type === type ? draft : { ...draft, layout_type: type, zone_areas: {} }
    await checkUpdatedLayout(session, nextDraft)
  }
  async function finish() {
    setFinishPhase('checking')
    try {
      const current = await getVenueImport(session!.id!)
      if (current.result) {
        openCompleted(current.result, current.draft_data?.layout_type)
        return
      }
      const s = await save(step, draft, true)
      const p = await previewVenueImport(s.id!, { revision: s.revision! })
      if (!p.valid) {
        setPreview(p)
        setStep('PREVIEW')
        return
      }
      setFinishPhase('saving')
      let saved: VenueImportResult
      try {
        saved = await completeVenueImport(s.id!, { revision: s.revision! })
      } catch (error) {
        const recovered = await getVenueImport(s.id!).catch(() => undefined)
        if (recovered?.result) saved = recovered.result
        else throw error
      }
      openCompleted(saved, s.draft_data?.layout_type)
    } finally {
      setFinishPhase(undefined)
    }
  }
  function openCompleted(saved: VenueImportResult, layoutType = draft.layout_type) {
    // Bỏ chặn ngay khi server đã lưu, không đợi effect đồng bộ trạng thái form.
    completed.current = true
    setResult(saved)
    const search = new URLSearchParams({ tab: 'layout', type: layoutType ?? 'FOOTBALL', layout: saved.layout_id })
    // Đánh dấu cache cũ; trang đích tự tải lại, không chờ refetch danh sách trước khi điều hướng.
    void client.invalidateQueries({ queryKey: venueDraftsKey })
    void client.invalidateQueries({ queryKey: ['admin-venue-directory'], refetchType: 'none' })
    void client.invalidateQueries({ queryKey: ['admin-layout-directory'], refetchType: 'none' })
    void client.invalidateQueries({ queryKey: ['admin-venue', saved.venue_id], refetchType: 'none' })
    void client.invalidateQueries({ queryKey: ['admin-layout-tree', saved.venue_id], refetchType: 'none' })
    void navigate(`/admin/venues/${saved.venue_id}/setup?${search}`, { replace: true, flushSync: true })
  }
  const matchingDrafts = drafts.data?.filter((item) => (item.target_venue_id ?? undefined) === venueId) ?? []

  function renderActions(currentSession: VenueImportSession) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 sm:gap-3 sm:p-4">
        {index === 1 && saveBlockers.length > 0 && (
          <section
            id="venue-save-blockers"
            className="mb-1 w-full space-y-1 rounded-lg bg-canvas px-3 py-2 text-sm"
            aria-label="Lý do chưa thể lưu"
          >
            <h3 className="font-semibold">Cần bổ sung trước khi lưu</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-ink-secondary">
              {saveBlockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        )}
        {index > 0 && (
          <Button
            className="h-11 rounded-pill"
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
          className="h-11 rounded-pill"
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
          <AdminAction
            disabled={!venueReady}
            onClick={() =>
              run(async () => {
                await save('OVERVIEW')
              })
            }
          >
            Tiếp tục
          </AdminAction>
        ) : (
          <AdminAction
            disabled={!canNext}
            aria-describedby={saveBlockers.length ? 'venue-save-blockers' : undefined}
            onClick={() => run(finish)}
          >
            {finishPhase === 'checking'
              ? 'Đang kiểm tra…'
              : finishPhase === 'saving'
                ? 'Đang lưu…'
                : 'Lưu sân & layout'}
          </AdminAction>
        )}
        <Button
          className="h-11 rounded-pill text-danger sm:ml-auto"
          variant="ghost"
          onClick={() =>
            run(async () => {
              accept(await cancelVenueImport(currentSession.id!, { revision: currentSession.revision! }))
            })
          }
        >
          Hủy phiên nháp
        </Button>
      </div>
    )
  }

  return (
    <AdminPage
      title={venueId ? 'Thêm layout cho sân' : 'Thêm sân'}
      caption={
        <Button
          asChild
          variant="ghost"
          className="h-10 rounded-pill px-2 font-sans text-sm tracking-normal normal-case"
        >
          <Link to={venueId ? `/admin/venues/${venueId}/setup?tab=layout` : '/admin/venues'}>
            <ArrowLeft aria-hidden />
            {venueId ? 'Quay về sơ đồ sân' : 'Quay về danh sách'}
          </Link>
        </Button>
      }
    >
      <div className="venue-import-shell">
        {!venueId && !sessionId && (
          <Panel>
            {action.error ? (
              <ErrorNotice error={action.error} retry={startNewVenue} />
            ) : (
              <output>Đang mở bước thông tin sân…</output>
            )}
          </Panel>
        )}
        {venueId && !sessionId && !session && (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel className="space-y-5">
              <div className="mb-4 grid size-12 place-items-center rounded-xl bg-agent text-ink">
                <FileCode2 aria-hidden />
              </div>
              <h2>Tạo phiên bản sơ đồ mới</h2>
              <Field label="Nền cho phiên bản mới">
                <select
                  value={overviewChoice}
                  disabled={action.isPending || overviews.isPending}
                  onChange={(event) => setOverviewChoice(event.target.value)}
                >
                  <option value="">Nhập overview mới từ SVG</option>
                  {reusableOverviews.map((item) => (
                    <option key={item.id} value={item.id}>
                      Nền v{item.version}
                    </option>
                  ))}
                </select>
              </Field>
              <ErrorNotice error={overviews.error} />
              {overviewChoice && !overviews.isPending && !selectedBase && (
                <p role="alert">Overview đã chọn không còn khả dụng. Chọn nền khác hoặc nhập overview mới.</p>
              )}
              <p className="venue-setup-hint">
                {selectedBase
                  ? 'Giữ nền và cổng đã lưu; chỉ cần nhập SVG layout ghế mới.'
                  : 'Nhập SVG nền mới và layout ghế tương ứng. Phiên bản đang dùng vẫn được giữ lại.'}
              </p>
              <div className="flex items-start gap-3 rounded-xl bg-canvas p-4 text-sm">
                <FileCode2 className="mt-0.5 size-5 shrink-0 text-ink-secondary" aria-hidden />
                <div>
                  <p className="font-medium">Tệp sơ đồ SVG</p>
                  <p className="mt-1 text-ink-secondary">
                    Tệp nền và tệp chi tiết cần dùng cùng viewBox. Mỗi lần tải tối đa 10 MiB.
                  </p>
                </div>
              </div>
              <AdminAction
                disabled={action.isPending || (!!overviewChoice && !selectedBase) || overviews.isPending}
                onClick={() =>
                  run(async () => {
                    const s = await createVenueImport({
                      target_venue_id: venueId,
                      ...(selectedBase?.id ? { overview_id: selectedBase.id } : {}),
                    })
                    const initial = await updateVenueImport(s.id!, {
                      revision: s.revision!,
                      step: 'OVERVIEW',
                      draft_data: prepareDraft({ ...blank, ...s.draft_data, layout_type: requestedType }),
                    })
                    accept(initial)
                    client.setQueryData(['venue-import', initial.id], initial)
                    setParams({ session: s.id! }, { replace: true })
                  })
                }
              >
                {action.isPending ? 'Đang tạo nháp…' : 'Tạo phiên nháp'}
              </AdminAction>
            </Panel>
            <Panel className="space-y-4">
              <div className="space-y-2">
                <h2>Phiên nháp đang dở</h2>
                <p className="text-sm text-ink-secondary">Phiên nháp được lưu trong 30 ngày.</p>
              </div>
              <QueryState query={drafts}>
                {matchingDrafts.length ? (
                  <ul className="divide-y divide-line">
                    {matchingDrafts.map((item) => (
                      <li key={item.id}>
                        <Link
                          className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-canvas"
                          to={`?session=${item.id}`}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas">
                            <FileText className="size-4 text-ink-secondary" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 wrap-anywhere">
                            <span className="block text-sm font-medium">
                              {item.draft_data?.layout_name || item.draft_data?.venue?.name || 'Nháp chưa đặt tên'}
                            </span>
                            <span className="block text-xs text-ink-secondary">
                              {labels[steps.indexOf(item.step ?? 'OVERVIEW')]}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-ink-secondary" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-secondary">Chưa có phiên nháp.</p>
                )}
              </QueryState>
            </Panel>
          </div>
        )}
        {sessionId && !session && <QueryState query={load}>{null}</QueryState>}
        {session && (
          <>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <nav className="venue-import-steps" aria-label="Các bước nhập sân">
                    {['Thông tin sân', 'Sơ đồ, layout & lưu'].map((label, i) => (
                      <Button
                        key={label}
                        variant={i === index ? 'default' : 'outline'}
                        className="h-11 rounded-pill"
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
                  <output className="text-sm text-ink-secondary">
                    {finishPhase === 'checking'
                      ? 'Đang kiểm tra sân và sơ đồ…'
                      : finishPhase === 'saving'
                        ? 'Đang lưu sân & layout…'
                        : action.isPending
                          ? 'Đang xử lý…'
                          : dirty
                            ? 'Có thay đổi chưa lưu'
                            : null}
                  </output>
                </div>
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
                            const dragging = canUpload && !action.isPending && dragTarget === isOverview
                            return (
                              <section
                                key={String(isOverview)}
                                className={`venue-svg-section ${isOverview ? '' : 'venue-svg-section-detail'}`}
                                data-dragging={dragging || undefined}
                                onDragOver={(event) => {
                                  if (!event.dataTransfer.types.includes('Files')) return
                                  event.preventDefault()
                                  const enabled = canUpload && !action.isPending
                                  event.dataTransfer.dropEffect = enabled ? 'copy' : 'none'
                                  if (enabled) setDragTarget(isOverview)
                                }}
                                onDragLeave={(event) => {
                                  if (
                                    event.relatedTarget instanceof Node &&
                                    event.currentTarget.contains(event.relatedTarget)
                                  )
                                    return
                                  setDragTarget(undefined)
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  setDragTarget(undefined)
                                  if (canUpload && !action.isPending)
                                    uploadFiles(Array.from(event.dataTransfer.files), isOverview)
                                }}
                              >
                                <header className="venue-svg-heading">
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`grid size-10 shrink-0 place-items-center rounded-lg font-medium ${(isOverview ? overviewReady : detailFiles.length > 0) ? 'bg-agent text-ink' : 'bg-canvas text-ink-secondary'}`}
                                    >
                                      {(isOverview ? overviewReady : detailFiles.length > 0) ? (
                                        <Check className="size-5" aria-hidden />
                                      ) : isOverview ? (
                                        '1'
                                      ) : (
                                        '2'
                                      )}
                                    </span>
                                    <div>
                                      <h3>{isOverview ? 'SVG tổng quan' : 'Layout zone/ghế'}</h3>
                                      <p>
                                        {isOverview
                                          ? 'Nền dùng chung cho các layout.'
                                          : 'Tải một hoặc nhiều tệp cho mỗi loại layout.'}
                                      </p>
                                    </div>
                                  </div>
                                  {!isOverview && detailFiles.length > 0 && (
                                    <span className="venue-svg-tag">
                                      {detailFiles.length} tệp · {layoutTypes.length} loại
                                    </span>
                                  )}
                                </header>
                                {isOverview && draft.overview_id && (
                                  <p className="venue-svg-hint">
                                    Đang dùng overview đã lưu. Nền và cổng được giữ nguyên cho phiên bản mới.
                                  </p>
                                )}
                                {canUpload && (
                                  <label className="venue-svg-chooser">
                                    <span className="venue-svg-upload-icon">
                                      {uploading?.overview === isOverview ? (
                                        <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
                                      ) : (
                                        <Upload className="size-5" aria-hidden />
                                      )}
                                    </span>
                                    <span>
                                      {sectionFiles.length
                                        ? 'Thêm SVG zone/ghế'
                                        : isOverview
                                          ? 'Chọn SVG tổng quan'
                                          : 'Chọn SVG zone/ghế'}
                                    </span>
                                    <small>
                                      {dragging
                                        ? 'Thả để tải tệp lên'
                                        : 'Kéo thả hoặc bấm để chọn · SVG tối đa 10 MiB mỗi lần tải'}
                                    </small>
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
                                  <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-3 text-sm text-ink-secondary">
                                    <Lock className="size-4 shrink-0" aria-hidden />
                                    <p>Tải SVG tổng quan để mở phần này.</p>
                                  </div>
                                )}
                                {!isOverview && checkingLayout && (
                                  <div
                                    role="status"
                                    className="flex items-center gap-3 rounded-lg bg-canvas p-3 text-sm"
                                  >
                                    <LoaderCircle className="size-5 shrink-0 motion-safe:animate-spin" aria-hidden />
                                    <div className="grid flex-1 gap-2">
                                      <p className="font-medium">Đang kiểm tra hình học và mapping…</p>
                                      <progress className="h-1.5 w-full accent-ink" aria-label="Kiểm tra sơ đồ ghế" />
                                    </div>
                                  </div>
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
                                              {file.validation_status === 'VALIDATED'
                                                ? 'Đã đọc được SVG'
                                                : 'Cần kiểm tra tệp'}
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
                                            {importIssueText(issue)}
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
                                {checkingLayout && !checked ? (
                                  <div className="venue-layout-preview grid place-items-center bg-canvas px-4 text-center text-sm text-ink-secondary">
                                    Bản xem trước sẽ hiện sau khi kiểm tra.
                                  </div>
                                ) : (
                                  <LayoutPreview
                                    overview={checked?.overview_svg ?? overview}
                                    detailNames={
                                      checked?.detail_svg
                                        ? ['Layout đã hợp nhất']
                                        : sources
                                            .filter((file) => file.sanitized_svg)
                                            .map((file) => file.original_filename || 'File chi tiết')
                                    }
                                    details={
                                      checked?.detail_svg
                                        ? [checked.detail_svg]
                                        : sources.flatMap((file) => (file.sanitized_svg ? [file.sanitized_svg] : []))
                                    }
                                    label={layoutNames[type]}
                                  />
                                )}
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
                                        {importIssueText(issue)}
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
                        <div className="grid gap-5">
                          <div className="grid gap-4 rounded-xl border border-line p-4 sm:p-5">
                            <div className="flex items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-ink">
                                <Building2 className="size-5" aria-hidden />
                              </span>
                              <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>
                            </div>
                            <div className="max-w-xl">
                              <Field label="Tên sân *">
                                <input
                                  required
                                  maxLength={200}
                                  placeholder="Ví dụ: Sân vận động Mỹ Đình"
                                  value={draft.venue?.name ?? ''}
                                  onChange={(e) => venueField('name', e.target.value)}
                                />
                              </Field>
                            </div>
                          </div>
                          <VenueSetupFields draft={draft} onChange={change} pending={action.isPending} />
                        </div>
                      ))}
                    {index === 1 && (
                      <p className="venue-svg-hint">
                        Khi lưu, hệ thống kiểm tra hình học của sơ đồ. Hình học được khóa sau khi lưu thành công.
                      </p>
                    )}
                  </Panel>
                  {renderActions(session)}
                </fieldset>
              </>
            )}
          </>
        )}
        {(venueId || sessionId) && <ErrorNotice error={action.error} />}
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
