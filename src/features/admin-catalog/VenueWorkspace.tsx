import { useState } from 'react'
import { ArrowLeft, Layers3 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  exportSeatLayoutSeats,
  exportSeatLayoutZones,
  updateVenue,
  useGetSeatLayout,
  getAdminVenue,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getAdminLayoutTree } from '@/api/generated/endpoints/admin-workspace/admin-workspace'
import type { Venue, VenueInput, LayoutType, SeatLayout } from '@/api/generated/model'
import { AdminLinkAction } from '@/design/admin/AdminAction'
import { AdminPage, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { dateText, download } from '@/design/admin/data'
import { VenueLayoutWorkspace } from './VenueLayoutWorkspace'
import { VenueActions } from './VenueActions'
import { VenueLocationPicker } from './VenueLocationPicker'
import { venueLayout } from './venueLayoutModel'
import { useVenueOverviews } from './useVenueOverviews'
import { VenueOverviewWorkspace } from './VenueOverviewWorkspace'
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
  const view = params.get('view') === 'overview' ? 'overview' : 'layout'
  const [openedViews, setOpenedViews] = useState({ overview: false, layout: false })
  if (tab === 'layout' && !openedViews[view]) {
    setOpenedViews({ ...openedViews, [view]: true })
  }
  const layoutOpened = tab === 'layout' || openedViews.overview || openedViews.layout
  const venues = useQuery({
    queryKey: ['admin-venue', venueId],
    queryFn: ({ signal }) => getAdminVenue(venueId, { signal }),
  })
  const type: LayoutType = params.get('type') === 'CONCERT' ? 'CONCERT' : 'FOOTBALL'
  const layouts = useQuery({
    queryKey: ['admin-layout-tree', venueId, type],
    enabled: layoutOpened,
    queryFn: async ({ signal }) => {
      const result: SeatLayout[] = []
      const seen = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await getAdminLayoutTree(venueId, { layout_type: type, cursor, limit: 100 }, { signal })
        result.push(...page.data.map((layout) => ({ ...layout, layout_type: type, venue_id: venueId })))
        cursor = page.next_cursor ?? undefined
        if (cursor && seen.has(cursor)) throw new Error('CURSOR_LOOP')
        if (cursor) seen.add(cursor)
      } while (cursor)
      return result
    },
  })
  const overviews = useVenueOverviews(venueId, layoutOpened)
  const selectedOverview = params.has('overview')
    ? overviews.data?.find((item) => item.id === params.get('overview'))
    : overviews.data?.[0]
  const selected = venueLayout(layouts.data, params.get('layout'))
  const linkedOverview = overviews.data?.find((item) => item.id === selected?.overview_id)
  const newLayoutParams = new URLSearchParams({ import: 'new', type })
  if (linkedOverview?.id) newLayoutParams.set('overview', linkedOverview.id)
  const newLayoutLink = `?${newLayoutParams}`
  const detail = useGetSeatLayout(selected?.id ?? '', {
    query: { enabled: ((view === 'layout' && tab === 'layout') || openedViews.layout) && !!selected?.id },
  })
  const venue = venues.data
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
                    {item.name} · v{item.version}
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
                  Nền v{item.version}
                </option>
              ))}
            </select>
          </Field>
        )}
        <AdminLinkAction to={view === 'overview' ? '?import=new' : newLayoutLink}>
          {view === 'overview' ? 'Nhập overview mới' : 'Tạo phiên bản mới'}
        </AdminLinkAction>
      </div>
    </section>
  )

  return (
    <AdminPage
      title={venue?.name?.trim() || 'Chi tiết sân'}
      caption={
        <Link className="venue-breadcrumb" to="/admin/venues">
          <ArrowLeft size={14} aria-hidden />
          Sân & địa điểm
        </Link>
      }
      actions={venue && <VenueActions venue={venue} />}
    >
      <QueryState query={venues} empty={!venue} emptyText="Không tìm thấy sân.">
        {venue && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3 text-sm text-ink-secondary">
              <p>
                {[...new Set([venue.district, venue.city_name || venue.city].filter(Boolean))].join(' · ') ||
                  'Chưa xác định địa phương'}
              </p>
              <p>
                <strong className="font-semibold text-ink">{venue.layout_count ?? 0} sơ đồ</strong>
                {' · '}
                {venue.published_layout_count ?? 0} công bố
                {' · '}
                {venue.draft_layout_count ?? 0} nháp
              </p>
            </div>
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
            {layoutOpened && (
              <div hidden={tab !== 'layout'}>
                <div className="venue-layout-tab">
                  {layoutControls}
                  {view === 'layout' && layouts.isError && <ErrorNotice error={layouts.error} />}
                  {view === 'layout' && layouts.isPending && <p role="status">Đang tải danh sách layout…</p>}
                  {(view === 'overview' || openedViews.overview) && (
                    <div hidden={view !== 'overview'}>
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
                    </div>
                  )}
                  {(view === 'layout' || openedViews.layout) && (
                    <div hidden={view !== 'layout'}>
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
                              overviewName={linkedOverview ? `Nền v${linkedOverview.version}` : undefined}
                              layout={detail.data}
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
                            <AdminLinkAction to={newLayoutLink}>Thêm sơ đồ</AdminLinkAction>
                          </Panel>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </QueryState>
    </AdminPage>
  )
}

function VenueMetadata({ venue, tab }: { venue: Venue; tab: VenueTab }) {
  const initial: VenueInput = {
    name: venue.name,
    address: venue.address,
    city: venue.city,
    district: venue.district,
    lat: venue.lat,
    lng: venue.lng,
    rules: venue.rules,
  }
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
            <Field label="Mã định danh">
              <input readOnly value={venue.id ?? ''} />
            </Field>
            <Field label="Địa chỉ">
              <input readOnly value={body.address || venue.address || 'Chưa chọn vị trí'} />
            </Field>
            <p className="venue-form-hint">
              Sức chứa được quản lý theo từng phiên bản sơ đồ. Đổi vị trí tại mục Địa chỉ & Tiện ích.
            </p>
          </div>
        ) : (
          <div className="venue-location-editor">
            <VenueLocationPicker
              label="Tìm vị trí sân"
              value={body}
              disabled={save.isPending}
              onChange={({ address, city, district, lat, lng }) =>
                setBody({ ...body, address, city: city ?? '', district: district ?? '', lat, lng })
              }
            />
            <dl className="venue-location-values">
              <div>
                <dt>Địa chỉ đã chọn</dt>
                <dd>{body.address || 'Chưa chọn vị trí'}</dd>
              </div>
              <div>
                <dt>Vĩ độ</dt>
                <dd>{body.lat ?? '—'}</dd>
              </div>
              <div>
                <dt>Kinh độ</dt>
                <dd>{body.lng ?? '—'}</dd>
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
            disabled={!body.name?.trim() || !body.address?.trim() || save.isPending}
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
              <Field label="Nội quy">
                <textarea
                  rows={7}
                  value={body.rules ?? ''}
                  disabled={save.isPending}
                  onChange={(event) => setBody({ ...body, rules: event.target.value })}
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
