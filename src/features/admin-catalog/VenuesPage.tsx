import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react'
import type { Venue } from '@/api/generated/model'
import { AdminLinkAction } from '@/design/admin/AdminAction'
import { AdminPage, Panel, QueryState, Table, Tabs } from '@/design/admin/AdminUi'
import { StatusBadge, type BadgeTone } from '@/design/StatusBadge'
import { Button } from '@/design/ui/button'
import { Input } from '@/design/ui/input'
import { useVenueDirectory, useVenueDrafts } from './catalog'
import './venue-directory.css'

type Readiness = 'READY' | 'DRAFT_ONLY' | 'NO_LAYOUT'

const states = {
  READY: { label: 'Sẵn sàng', tone: 'success' },
  DRAFT_ONLY: { label: 'Bản Nháp', tone: 'warning' },
  NO_LAYOUT: { label: 'Chưa có sơ đồ', tone: 'neutral' },
} satisfies Record<Readiness, { label: string; tone: BadgeTone }>

const statusFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'READY', label: states.READY.label },
  { value: 'DRAFT_ONLY', label: states.DRAFT_ONLY.label },
  { value: 'NO_LAYOUT', label: states.NO_LAYOUT.label },
] as const

const pageSize = 10

function readiness(venue: Venue): Readiness | undefined {
  if (venue.layout_count === undefined) return undefined
  if ((venue.published_layout_count ?? 0) > 0) return 'READY'
  return (venue.draft_layout_count ?? 0) > 0 ? 'DRAFT_ONLY' : 'NO_LAYOUT'
}

export default function VenuesPage() {
  const query = useVenueDirectory()
  const drafts = useVenueDrafts()
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<Readiness | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const venues: { venue: Venue; state: Readiness | undefined; path: string; isImport: boolean }[] = [
    ...(query.data ?? []).map((venue) => ({
      venue,
      state: readiness(venue),
      path: `/admin/venues/${venue.id}`,
      isImport: false,
    })),
    ...(drafts.data ?? [])
      .filter((item) => !item.target_venue_id)
      .map((item) => ({
        venue: {
          ...item.draft_data?.venue,
          name: item.draft_data?.venue?.name?.trim() || 'Nháp chưa đặt tên',
        },
        state: 'DRAFT_ONLY' as const,
        path: `/admin/venues/new?session=${item.id}`,
        isImport: true,
      })),
  ]
  const cities = new Map<string, string>()
  for (const { venue } of venues) {
    if (venue.city) cities.set(venue.city, venue.city_name || venue.city)
  }
  const needle = search.trim().toLocaleLowerCase('vi-VN')
  const hasFilters = Boolean(city || status || search)
  const shown = venues.filter(
    ({ venue, state }) =>
      (!city || venue.city === city) &&
      (!status || state === status) &&
      (!needle ||
        [venue.name, venue.address, venue.city_name, venue.district].some((value) =>
          value?.toLocaleLowerCase('vi-VN').includes(needle),
        )),
  )
  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pages)
  const offset = (currentPage - 1) * pageSize

  return (
    <AdminPage
      title="Quản lý sân & sơ đồ ghế"
      actions={<AdminLinkAction to="/admin/venues/new">Thêm sân</AdminLinkAction>}
    >
      <div className="wz-filters">
        <Tabs
          items={statusFilters}
          value={status}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
      </div>
      <Panel className="venue-directory-panel">
        <div className="venue-directory-toolbar">
          <div className="venue-directory-search">
            <Search className="size-4 text-ink-secondary" aria-hidden />
            <Input
              className="h-11 rounded-pill bg-surface pl-10"
              type="search"
              aria-label="Tìm sân"
              placeholder="Tìm theo tên sân, địa chỉ…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <select
            className="wz-select"
            aria-label="Tỉnh / thành phố"
            value={city}
            onChange={(event) => {
              setCity(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả tỉnh / thành phố</option>
            {[...cities].map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-pill"
              onClick={() => {
                setSearch('')
                setCity('')
                setStatus('')
                setPage(1)
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
        <QueryState
          query={{
            isPending: query.isPending || drafts.isPending,
            error: query.error || drafts.error,
            refetch: () => Promise.all([query.refetch(), drafts.refetch()]),
          }}
          empty={!shown.length}
          emptyText={
            venues.length ? 'Không có sân phù hợp với bộ lọc.' : 'Chưa có sân. Thêm sân để thiết lập sơ đồ ghế.'
          }
        >
          <Table label="Danh sách sân" headings={['Sân / địa điểm', 'Vị trí', 'Thao tác']}>
            {shown.slice(offset, offset + pageSize).map(({ venue, state, path: detailPath, isImport }) => {
              return (
                <tr key={detailPath}>
                  <td>
                    <Link className="venue-directory-name" to={detailPath}>
                      {venue.name}
                    </Link>
                    <div className="venue-directory-mobile-location">
                      <VenueLocation venue={venue} />
                    </div>
                    <div className="venue-directory-layouts">
                      {state && <StatusBadge tone={states[state].tone}>{states[state].label}</StatusBadge>}
                      {venue.layout_count !== undefined && (
                        <span>
                          {venue.layout_count} sơ đồ · {venue.published_layout_count ?? 0} công bố
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <VenueLocation venue={venue} />
                  </td>
                  <td>
                    <Button asChild variant="outline" className="h-10 rounded-pill">
                      <Link to={detailPath} aria-label={`${isImport ? 'Mở nháp' : 'Quản lý'} ${venue.name}`}>
                        {isImport ? 'Mở nháp' : 'Quản lý'} <ArrowUpRight className="hidden sm:block" aria-hidden />
                      </Link>
                    </Button>
                  </td>
                </tr>
              )
            })}
          </Table>
          <footer className="admin-listfoot">
            <output>
              Hiển thị {offset + 1}–{Math.min(offset + pageSize, shown.length)} trong {shown.length} địa điểm
            </output>
            {pages > 1 && (
              <nav aria-label="Phân trang sân" className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="rounded-pill"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Trang trước"
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <span>
                  Trang {currentPage} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="rounded-pill"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Trang sau"
                >
                  <ChevronRight aria-hidden />
                </Button>
              </nav>
            )}
          </footer>
        </QueryState>
      </Panel>
    </AdminPage>
  )
}

function VenueLocation({ venue }: { venue: Venue }) {
  const area = [venue.district, venue.city_name || venue.city].filter(Boolean).join(', ')

  return (
    <div className="venue-directory-location">
      <MapPin className="size-4 shrink-0 text-ink-secondary" aria-hidden />
      <div>
        <p>{area || 'Chưa xác định khu vực'}</p>
        <p className="text-xs text-ink-secondary">{venue.address || 'Chưa chọn vị trí'}</p>
      </div>
    </div>
  )
}
