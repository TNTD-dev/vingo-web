import { useState } from 'react'
import { Building2, ChevronRight, Layers3, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  exportSeatLayoutSeats,
  exportSeatLayoutZones,
  publishSeatLayout,
  renameSeatLayout,
  updateVenue,
  useGetSeatLayout,
  getAdminVenue,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getAdminLayoutTree } from '@/api/generated/endpoints/admin-workspace/admin-workspace'
import type { Venue, VenueInput, LayoutType, SeatLayout } from '@/api/generated/model'
import { AdminPage, ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { dateText, download } from '@/design/admin/data'
import { venueTypes, venueInfoText } from './catalog'
import { VenueLayoutWorkspace } from './VenueLayoutWorkspace'
import { VenueActions } from './VenueActions'
import { VenueLocationPicker } from './VenueLocationPicker'
import { venueLayout } from './venueLayoutModel'
import { useVenueOverviews } from './useVenueOverviews'
import { VenueOverviewWorkspace } from './VenueOverviewWorkspace'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/design/ui/dialog'
import './venue-admin-alignment.css'

type VenueTab = 'general' | 'location' | 'layout'
const tabs: { value: VenueTab; label: string }[] = [
  { value: 'general', label: 'Thông tin chung' },
  { value: 'location', label: 'Địa chỉ & Tiện ích' },
  { value: 'layout', label: 'Sơ đồ sân' },
]

export function VenueWorkspace({ venueId }: { venueId: string }) {
  const [params, setParams] = useSearchParams()
  const tab: VenueTab =
    params.get('tab') === 'general'
      ? 'general'
      : params.get('tab') === 'location'
        ? 'location'
        : params.get('tab') === 'layout' || params.has('layout')
          ? 'layout'
          : 'general'
  const venues = useQuery({
    queryKey: ['admin-venue', venueId],
    queryFn: ({ signal }) => getAdminVenue(venueId, { signal }),
  })
  const type: LayoutType =
    params.get('type') === 'CONCERT'
      ? 'CONCERT'
      : params.get('type') === 'FOOTBALL'
        ? 'FOOTBALL'
        : venues.data?.type === 'THEATER'
          ? 'CONCERT'
          : 'FOOTBALL'
  const layouts = useQuery({
    queryKey: ['admin-layout-tree', venueId, type],
    enabled: tab === 'layout',
    queryFn: async ({ signal }) => {
      const result: SeatLayout[] = []
      const seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await getAdminLayoutTree(venueId, { layout_type: type, cursor, limit: 100 }, { signal })
        result.push(...page.data.map((layout) => ({ ...layout, layout_type: type, venue_id: venueId, legacy: false })))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result
    },
  })
  const view = params.get('view') === 'overview' ? 'overview' : 'layout'
  const overviews = useVenueOverviews(venueId, tab === 'layout')
  const selectedOverview = params.has('overview')
    ? overviews.data?.find((item) => item.id === params.get('overview'))
    : overviews.data?.[0]
  const selected = venueLayout(layouts.data, params.get('layout'))
  const linkedOverview = overviews.data?.find((item) => item.id === selected?.overview_id)
  const newLayoutParams = new URLSearchParams({ import: 'new', type })
  if (linkedOverview?.status === 'PUBLISHED' && linkedOverview.id) newLayoutParams.set('overview', linkedOverview.id)
  const newLayoutLink = `?${newLayoutParams}`
  const detail = useGetSeatLayout(selected?.id ?? '', { query: { enabled: tab === 'layout' && !!selected?.id } })
  const venue = venues.data
  const [mode, setMode] = useState<'rename' | 'publish' | null>(null)
  const [name, setName] = useState('')
  const client = useQueryClient()
  const action = useMutation({
    mutationFn: async () => {
      if (mode === 'publish') await publishSeatLayout(selected!.id!)
      else await renameSeatLayout(selected!.id!, { name: name.trim() })
    },
    onSuccess: async () => {
      setMode(null)
      await client.invalidateQueries()
    },
  })
  const csv = useMutation({
    mutationFn: async (kind: 'zones' | 'seats') => {
      const content = await (kind === 'zones' ? exportSeatLayoutZones : exportSeatLayoutSeats)(selected!.id!)
      download(content, `${kind}-${selected!.id}.csv`, 'text/csv')
    },
  })
  function selectTab(next: VenueTab) {
    setParams((previous) => {
      const nextParams = new URLSearchParams(previous)
      nextParams.set('tab', next)
      return nextParams
    })
  }
  function selectView(next: 'overview' | 'layout', overviewId?: string) {
    setParams((previous) => {
      const nextParams = new URLSearchParams(previous)
      nextParams.set('tab', 'layout')
      nextParams.set('type', type)
      if (selected?.id) nextParams.set('layout', selected.id)
      if (next === 'overview') nextParams.set('view', 'overview')
      else nextParams.delete('view')
      if (overviewId) nextParams.set('overview', overviewId)
      return nextParams
    })
  }
  const layoutTypeControl = (
    <Field label="Loại sơ đồ">
      <select value={type} onChange={(event) => setParams({ tab: 'layout', type: event.target.value })}>
        <option value="FOOTBALL">Bóng đá</option>
        <option value="CONCERT">Ca nhạc</option>
      </select>
    </Field>
  )
  const layoutControls = (
    <section className="venue-layout-controls" aria-label="Chọn sơ đồ sân">
      <div className="venue-layout-view-switch" role="group" aria-label="Chế độ xem sơ đồ">
        <button
          type="button"
          aria-pressed={view === 'overview'}
          onClick={() => selectView('overview', params.get('overview') ?? selected?.overview_id ?? undefined)}
        >
          Overview sân
        </button>
        <button type="button" aria-pressed={view === 'layout'} onClick={() => selectView('layout')}>
          Layout ghế
        </button>
      </div>
      <div className="venue-layout-pickers">
        {view === 'layout' ? (
          <>
            {layoutTypeControl}
            <Field label="Phiên bản layout">
              <select
                value={selected?.id ?? ''}
                disabled={layouts.isPending || !layouts.data?.length}
                onChange={(event) => setParams({ tab: 'layout', type, layout: event.target.value })}
              >
                <option value="" disabled>
                  {layouts.isPending ? 'Đang tải phiên bản…' : 'Chọn phiên bản'}
                </option>
                {layouts.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version} · {item.status === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Phiên bản overview">
            <select
              value={selectedOverview?.id ?? ''}
              disabled={overviews.isPending || !overviews.data?.length}
              onChange={(event) => selectView('overview', event.target.value)}
            >
              <option value="" disabled>
                {overviews.isPending ? 'Đang tải overview…' : 'Chọn overview'}
              </option>
              {overviews.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · v{item.version} · {item.status === 'PUBLISHED' ? 'Đã công bố' : 'Bản nháp'}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Link className="venue-primary-link" to={view === 'overview' ? '?import=new' : newLayoutLink}>
          <Plus size={16} aria-hidden />
          {view === 'overview' ? 'Nhập overview mới' : 'Tạo phiên bản mới'}
        </Link>
      </div>
    </section>
  )

  return (
    <AdminPage
      title="Quản lý sân & sơ đồ ghế"
      caption={
        <span className="venue-breadcrumb">
          <Link to="/admin/venues">Sân & địa điểm</Link>
          <ChevronRight size={13} aria-hidden />
          {venue?.name || 'Chi tiết sân'}
        </span>
      }
      actions={
        <div className="venue-detail-header-actions">
          <Button variant="outline" onClick={() => selectTab('layout')}>
            Xem sơ đồ
          </Button>
          {venue && <VenueActions venue={venue} />}
        </div>
      }
    >
      <QueryState query={venues} empty={!venue} emptyText="Không tìm thấy sân.">
        {venue && (
          <>
            <Panel className="venue-detail-summary">
              <span className="venue-summary-icon">
                <Building2 size={28} aria-hidden />
              </span>
              <div className="venue-summary-name">
                <h2>{venue.name}</h2>
                <p>
                  {venue.city_name || venue.city || 'Chưa xác định địa phương'} ·{' '}
                  {venue.type ? venueTypes[venue.type] : 'Địa điểm'}
                </p>
              </div>
              <dl className="venue-summary-counts">
                <div>
                  <dt>Cấu hình sơ đồ</dt>
                  <dd>{venue.layout_count ?? 0}</dd>
                </div>
                <div>
                  <dt>Đã công bố</dt>
                  <dd className="venue-published-number">{venue.published_layout_count ?? 0}</dd>
                </div>
                <div>
                  <dt>Bản nháp</dt>
                  <dd>{venue.draft_layout_count ?? 0}</dd>
                </div>
              </dl>
            </Panel>
            <nav className="venue-detail-tabs" aria-label="Nội dung quản lý sân">
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-current={tab === item.value ? 'page' : undefined}
                  onClick={() => selectTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <VenueMetadata key={`${venue.id}:${venue.updated_at}`} venue={venue} tab={tab} />
            {tab === 'layout' && (
              <div className="venue-layout-tab">
                {layoutControls}
                {view === 'layout' && layouts.isError && <ErrorNotice error={layouts.error} />}
                {view === 'layout' && layouts.isPending && <p role="status">Đang tải danh sách layout…</p>}
                {view === 'overview' ? (
                  <QueryState
                    query={overviews}
                    empty={!overviews.data?.length}
                    emptyText="Sân chưa có overview. Nhập SVG để tạo nền sân và layout đầu tiên."
                  >
                    {selectedOverview?.id ? (
                      <VenueOverviewWorkspace key={selectedOverview.id} overviewId={selectedOverview.id} />
                    ) : overviews.data?.length ? (
                      <p role="alert">Overview không thuộc sân này hoặc không còn tồn tại. Chọn phiên bản khác.</p>
                    ) : null}
                  </QueryState>
                ) : (
                  <>
                    {params.has('layout') && layouts.data && !selected && (
                      <p role="alert">
                        Sơ đồ không thuộc sân này hoặc không còn tồn tại. Chọn một phiên bản trong danh sách.
                      </p>
                    )}
                    {selected ? (
                      <QueryState query={detail}>
                        {detail.data && (
                          <VenueLayoutWorkspace
                            key={selected.id}
                            catalogOnly
                            onViewOverview={
                              selected.overview_id ? () => selectView('overview', selected.overview_id!) : undefined
                            }
                            overviewName={
                              linkedOverview ? `${linkedOverview.name} · v${linkedOverview.version}` : undefined
                            }
                            layout={detail.data}
                            onRename={() => {
                              action.reset()
                              setName(selected.name)
                              setMode('rename')
                            }}
                            onPublish={() => {
                              action.reset()
                              setMode('publish')
                            }}
                            onExport={(kind) => csv.mutate(kind)}
                            exportPending={csv.isPending}
                            exportError={csv.error}
                          />
                        )}
                      </QueryState>
                    ) : (
                      !layouts.isPending &&
                      !layouts.isError && (
                        <Panel className="venue-layout-empty">
                          <Layers3 size={36} aria-hidden />
                          <h2>Thiết lập sơ đồ sân</h2>
                          <p>Chưa có layout phù hợp. Chọn loại sơ đồ khác hoặc nhập SVG để tạo phiên bản mới.</p>
                          <Link className="venue-primary-link" to={newLayoutLink}>
                            <Plus size={16} aria-hidden />
                            Thêm sơ đồ
                          </Link>
                        </Panel>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </QueryState>
      {mode === 'publish' && (
        <ConfirmDialog
          open
          title="Công bố sơ đồ?"
          description="Nền và sơ đồ sẽ được khóa hình học. Sau khi công bố, sơ đồ có thể được dùng cho suất diễn mới."
          requireReason={false}
          label="Công bố"
          pending={action.isPending}
          error={action.error}
          onClose={() => setMode(null)}
          onConfirm={() => action.mutate()}
        />
      )}
      <Dialog
        open={mode === 'rename'}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setMode(null)
        }}
      >
        <DialogContent showCloseButton={!action.isPending}>
          <DialogHeader>
            <DialogTitle>Đổi tên layout nháp</DialogTitle>
            <DialogDescription>Đặt tên dễ nhận biết cho phiên bản đang chọn.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim() && !action.isPending) action.mutate()
            }}
          >
            <Field label="Tên sơ đồ nháp">
              <input
                required
                maxLength={200}
                value={name}
                disabled={action.isPending}
                onChange={(event) => setName(event.target.value)}
                className="venue-rename-input"
              />
            </Field>
            <ErrorNotice error={action.error} />
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" disabled={action.isPending} onClick={() => setMode(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={!name.trim() || action.isPending}>
                {action.isPending ? 'Đang lưu…' : 'Lưu tên'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}

function VenueMetadata({ venue, tab }: { venue: Venue; tab: VenueTab }) {
  const initial: VenueInput = { name: venue.name, type: venue.type, info: venue.info, location: venue.location }
  const [body, setBody] = useState<VenueInput>(initial)
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () => updateVenue(venue.id!, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin-venue-directory'] })
      await client.invalidateQueries({ queryKey: ['admin-venue', venue.id] })
      toast.success('Đã lưu thông tin sân')
    },
  })
  if (tab === 'layout') return null
  return (
    <form
      className="venue-metadata-grid"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <Panel className="venue-metadata-main">
        <h2>{tab === 'general' ? 'Thông tin chung' : 'Địa chỉ & Tiện ích'}</h2>
        <p className="venue-form-description">
          {tab === 'general'
            ? 'Thông tin hiển thị cho khách hàng và quản trị viên.'
            : 'Chọn vị trí trên bản đồ để đồng bộ địa chỉ và tọa độ sân.'}
        </p>
        {tab === 'general' ? (
          <div className="venue-metadata-fields">
            <Field label="Tên sân / địa điểm">
              <input
                required
                maxLength={200}
                value={body.name ?? ''}
                disabled={save.isPending}
                onChange={(event) => setBody({ ...body, name: event.target.value })}
              />
            </Field>
            <Field label="Loại hình">
              <select
                value={body.type}
                disabled={save.isPending}
                onChange={(event) => setBody({ ...body, type: event.target.value as VenueInput['type'] })}
              >
                {Object.entries(venueTypes).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mã định danh">
              <input readOnly value={venue.id ?? ''} />
            </Field>
            <Field label="Địa chỉ">
              <input readOnly value={body.location?.display_address || venue.address || 'Chưa chọn vị trí'} />
            </Field>
            <p className="venue-form-hint">
              Sức chứa được quản lý theo từng phiên bản sơ đồ. Đổi vị trí tại mục Địa chỉ & Tiện ích.
            </p>
          </div>
        ) : (
          <div className="venue-location-editor">
            <VenueLocationPicker
              label="Tìm vị trí sân"
              value={body.location}
              disabled={save.isPending}
              onChange={(location) => setBody({ ...body, location })}
            />
            <dl className="venue-location-values">
              <div>
                <dt>Địa chỉ đã chọn</dt>
                <dd>{body.location?.display_address || 'Chưa chọn vị trí'}</dd>
              </div>
              <div>
                <dt>Vĩ độ</dt>
                <dd>{body.location?.latitude ?? '—'}</dd>
              </div>
              <div>
                <dt>Kinh độ</dt>
                <dd>{body.location?.longitude ?? '—'}</dd>
              </div>
            </dl>
          </div>
        )}
        <ErrorNotice error={save.error} />
        {save.isSuccess && <p role="status">Đã lưu thông tin sân.</p>}
        <footer className="venue-form-actions">
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setBody(initial)
              save.reset()
            }}
          >
            Hủy thay đổi
          </Button>
          <Button
            type="submit"
            className="venue-save-button"
            disabled={!body.name?.trim() || !body.location || save.isPending}
          >
            {save.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
          </Button>
        </footer>
      </Panel>
      <aside className="venue-metadata-aside">
        {tab === 'location' && (
          <Panel>
            <h2>Tiện ích & Nội quy</h2>
            <div className="venue-aside-fields">
              <Field label="Giờ hoạt động">
                <input
                  value={venueInfoText(body.info, 'opening_hours') ?? ''}
                  disabled={save.isPending}
                  placeholder="Ví dụ: 08:00–22:00 hằng ngày"
                  onChange={(event) => setBody({ ...body, info: { ...body.info, opening_hours: event.target.value } })}
                />
              </Field>
              <Field label="Nội quy">
                <textarea
                  rows={7}
                  value={venueInfoText(body.info, 'rules') ?? ''}
                  disabled={save.isPending}
                  onChange={(event) => setBody({ ...body, info: { ...body.info, rules: event.target.value } })}
                />
              </Field>
            </div>
          </Panel>
        )}
        <Panel>
          <h2>Thông tin hệ thống</h2>
          <dl className="venue-system-values">
            <div>
              <dt>Ngày tạo</dt>
              <dd>{dateText(venue.created_at)}</dd>
            </div>
            <div>
              <dt>Cập nhật lần cuối</dt>
              <dd>{dateText(venue.updated_at)}</dd>
            </div>
            <div>
              <dt>Người cập nhật</dt>
              <dd>{venue.updated_by_name || 'Chưa ghi nhận'}</dd>
            </div>
            <div>
              <dt>Sơ đồ đã công bố</dt>
              <dd className="venue-published-number">
                {venue.published_layout_count ?? 0} / {venue.layout_count ?? 0}
              </dd>
            </div>
          </dl>
        </Panel>
      </aside>
    </form>
  )
}
