import { useState } from 'react'
import { Link } from 'react-router'
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import type { Venue } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, Table } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { useVenueDirectory, venueTypes } from './catalog'
import './venue-admin-alignment.css'

type Readiness = 'READY' | 'DRAFT_ONLY' | 'NO_LAYOUT'
function readiness(venue: Venue): Readiness | undefined {
  if (venue.layout_count === undefined) return undefined
  if ((venue.published_layout_count ?? 0) > 0) return 'READY'
  return venue.layout_count > 0 ? 'DRAFT_ONLY' : 'NO_LAYOUT'
}
const stateNames = { READY: 'Sẵn sàng', DRAFT_ONLY: 'Chỉ có nháp', NO_LAYOUT: 'Chưa có sơ đồ' }
const pageSize = 10

export default function VenuesPage() {
  const query = useVenueDirectory()
  const [city, setCity] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const venues = query.data ?? []
  const cities = new Map(
    venues.filter((venue) => venue.city).map((venue) => [venue.city!, venue.city_name || venue.city!]),
  )
  const needle = search.trim().toLocaleLowerCase('vi-VN')
  const shown = venues.filter(
    (venue) =>
      (!city || venue.city === city) &&
      (!type || venue.type === type) &&
      (!status || readiness(venue) === status) &&
      (!needle ||
        [venue.name, venue.location?.display_address, venue.address, venue.city_name, venue.district].some((value) =>
          value?.toLocaleLowerCase('vi-VN').includes(needle),
        )),
  )
  const pages = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pages)
  const offset = (currentPage - 1) * pageSize
  return (
    <AdminPage
      title="Quản lý sân & sơ đồ ghế"
      caption="Địa điểm tổ chức sự kiện"
      actions={
        <Link className="venue-primary-link" to="/admin/venues/new">
          <Plus size={16} aria-hidden />
          Thêm sân
        </Link>
      }
    >
      <p className="venue-directory-intro">Tìm và quản lý thông tin địa điểm, vị trí và các cấu hình sơ đồ sân.</p>
      <Panel className="venue-directory-panel">
        <div className="venue-directory-filters">
          <label className="venue-directory-search">
            <Search size={18} aria-hidden />
            <input
              aria-label="Tìm sân"
              placeholder="Tìm theo tên sân, địa chỉ…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <select
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
          <select
            aria-label="Loại sân"
            value={type}
            onChange={(event) => {
              setType(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả loại hình</option>
            {Object.entries(venueTypes).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Tình trạng sơ đồ"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả tình trạng</option>
            {Object.entries(stateNames).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <QueryState query={query} empty={!shown.length} emptyText="Không có sân phù hợp với bộ lọc.">
          <Table
            label="Danh sách sân"
            headings={['Sân / địa điểm', 'Tỉnh / thành phố', 'Loại hình', 'Địa chỉ', 'Thao tác']}
          >
            {shown.slice(offset, offset + pageSize).map((venue) => {
              const state = readiness(venue)
              return (
                <tr key={venue.id}>
                  <td>
                    <Link className="venue-directory-name" to={`/admin/venues/${venue.id}`}>
                      {venue.name}
                    </Link>
                    <div className="venue-directory-subline">
                      {state && (
                        <span className="venue-readiness" data-state={state}>
                          {stateNames[state]}
                        </span>
                      )}
                      {venue.layout_count !== undefined && (
                        <span>
                          {venue.layout_count} sơ đồ · {venue.published_layout_count ?? 0} công bố
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {venue.city_name || venue.city || 'Chưa xác định'}
                    {venue.district && <small>{venue.district}</small>}
                  </td>
                  <td>{venue.type ? venueTypes[venue.type] : '—'}</td>
                  <td className="venue-directory-address">
                    {venue.location?.display_address || venue.address || 'Chưa chọn vị trí'}
                  </td>
                  <td>
                    <Link className="venue-manage-link" to={`/admin/venues/${venue.id}`}>
                      Quản lý
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        </QueryState>
        {!!shown.length && (
          <footer className="venue-directory-footer">
            <p>
              Hiển thị {offset + 1}–{Math.min(offset + pageSize, shown.length)} trong {shown.length} địa điểm
            </p>
            <div>
              <Button
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Trang trước"
              >
                <ChevronLeft size={16} />
              </Button>
              <span>
                Trang {currentPage} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Trang sau"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </footer>
        )}
        {!query.isPending && !query.error && !venues.length && (
          <p className="venue-directory-empty">
            <Building2 size={28} aria-hidden />
            Thêm địa điểm đầu tiên để bắt đầu thiết lập sơ đồ sân.
          </p>
        )}
      </Panel>
    </AdminPage>
  )
}
