import { useState } from 'react'
import { Link } from 'react-router'
import { useQueries } from '@tanstack/react-query'
import { AlertTriangle, MapPin } from 'lucide-react'
import { listSeatLayouts } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { SeatLayout, Venue } from '@/api/generated/model'
import { AdminPage, QueryState, Tabs } from '@/design/admin/AdminUi'
import { AdminLinkAction } from '@/design/admin/AdminAction'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/design/ui/dropdown-menu'
import more from '@/design/admin/icons/more.svg'
import { Button } from '@/design/ui/button'
import { cities, useVenueDirectory, venueTypes } from './catalog'
import { latestPublished, venueState, type VenueState } from './readiness'

type StatusFilter = '' | 'READY' | 'NOT_READY'

/** Phác hoạ sơ đồ theo loại sân cho nền thẻ (trang trí, không phải sơ đồ thật). */
function CoverArt({ type }: { type?: string }) {
  if (type === 'THEATER')
    return (
      <svg viewBox="0 0 200 120" aria-hidden fill="none" stroke="currentColor" strokeWidth="6">
        <rect x="60" y="20" width="80" height="8" rx="4" fill="currentColor" stroke="none" />
        {[44, 58, 72, 86].map((r) => (
          <path key={r} d={`M${100 - r * 1.6} ${60 + r * 0.9} Q100 ${30 + r * 0.4} ${100 + r * 1.6} ${60 + r * 0.9}`} />
        ))}
      </svg>
    )
  if (type === 'OUTDOOR')
    return (
      <svg viewBox="0 0 200 120" aria-hidden fill="currentColor">
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={20 + (i % 10) * 18} cy={20 + Math.floor(i / 10) * 22} r="3" />
        ))}
      </svg>
    )
  return (
    <svg viewBox="0 0 200 120" aria-hidden fill="none" stroke="currentColor" strokeWidth="14">
      <ellipse cx="100" cy="60" rx="80" ry="50" strokeDasharray="20 6" />
      <ellipse cx="100" cy="60" rx="44" ry="26" fill="var(--vg-bg-inverse)" stroke="none" />
    </svg>
  )
}

const stateText: Record<VenueState, { chip: string; tone: string }> = {
  READY: { chip: 'Sẵn sàng', tone: 'success' },
  DRAFT_ONLY: { chip: 'Sơ đồ nháp', tone: 'warning' },
  NO_LAYOUT: { chip: 'Thiếu sơ đồ', tone: 'danger' },
}

export default function VenuesPage() {
  const query = useVenueDirectory()
  const [city, setCity] = useState(''),
    [type, setType] = useState(''),
    [status, setStatus] = useState<StatusFilter>(''),
    [q, setQ] = useState('')
  const venues = query.data
  const layoutQueries = useQueries({
    queries: (venues ?? []).map((v) => ({
      queryKey: ['admin-layout-directory', v.id],
      queryFn: async () => {
        const all: SeatLayout[] = []
        let cursor: string | undefined
        do {
          const page = await listSeatLayouts(v.id!, { limit: 100, cursor })
          all.push(...(page.data ?? []))
          cursor = page.next_cursor ?? undefined
        } while (cursor)
        return all
      },
      staleTime: 30_000,
    })),
  })
  const layoutsOf = (venue: Venue): SeatLayout[][] | undefined => {
    const query = layoutQueries[venues?.findIndex((v) => v.id === venue.id) ?? -1]
    return query?.data ? [query.data] : undefined
  }
  const states = new Map(venues?.map((v) => [v.id, layoutsOf(v) && venueState(layoutsOf(v)!)]))
  const ready = venues?.filter((v) => states.get(v.id) === 'READY').length ?? 0
  const notReady = venues?.filter((v) => states.get(v.id) && states.get(v.id) !== 'READY') ?? []
  const needle = q.trim().toLowerCase()
  const shown = venues?.filter(
    (v) =>
      (!city || v.city === city) &&
      (!type || v.type === type) &&
      (!status || (status === 'READY' ? states.get(v.id) === 'READY' : notReady.includes(v))) &&
      (!needle || [v.name, v.district, v.address].some((x) => x?.toLowerCase().includes(needle))),
  )
  return (
    <AdminPage
      title="Sân & địa điểm"
      caption={`// CATALOG · ${venues?.length ?? '—'} SÂN${venues ? ` · ${ready} SẴN SÀNG` : ''}`}
      search={{ label: 'Sân', placeholder: 'Tìm tên sân, quận…', value: q, onChange: setQ }}
      actions={<AdminLinkAction to="/admin/venues/new">Thêm sân</AdminLinkAction>}
    >
      <div className="wz-filters">
        <Tabs
          value={city}
          onChange={setCity}
          items={[
            { value: '', label: `Tất cả · ${venues?.length ?? 0}` },
            ...Object.entries(cities).map(([value, label]) => ({
              value,
              label: `${value === 'HCM' ? 'TP.HCM' : label} · ${venues?.filter((v) => v.city === value).length ?? 0}`,
            })),
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Loại sân" className="wz-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Mọi loại sân</option>
            {Object.entries(venueTypes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Tình trạng"
            className="wz-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="">Tình trạng: Tất cả</option>
            <option value="READY">Tình trạng: Sẵn sàng</option>
            <option value="NOT_READY">Tình trạng: Chưa sẵn sàng</option>
          </select>
        </div>
      </div>
      {!!notReady.length && (
        <div className="wz-banner" role="status">
          <AlertTriangle className="wz-warn-text" aria-hidden />
          <div>
            <strong>{notReady.length} sân chưa thể gắn vào suất diễn</strong>
            <small>
              {notReady
                .slice(0, 3)
                .map((v) => `${v.name}: ${states.get(v.id) === 'NO_LAYOUT' ? 'chưa có sơ đồ' : 'sơ đồ còn bản nháp'}`)
                .join(' · ')}
            </small>
          </div>
          <Button className="wz-select" variant="outline" onClick={() => setStatus('NOT_READY')}>
            Xem {notReady.length} sân
          </Button>
        </div>
      )}
      <QueryState query={query} empty={!shown?.length}>
        <div className="wz-venues">
          {shown?.map((v) => (
            <VenueCard key={v.id} venue={v} layouts={layoutsOf(v)} />
          ))}
        </div>
      </QueryState>
    </AdminPage>
  )
}

function VenueCard({ venue: v, layouts }: { venue: Venue; layouts?: SeatLayout[][] }) {
  const state = layouts && venueState(layouts)
  const latest = layouts?.map((l) => latestPublished(l)).filter((l) => !!l)
  const seats = latest?.reduce((sum, l) => sum + (l.seat_count ?? 0), 0) ?? 0
  const version = Math.max(0, ...(latest?.map((l) => l.version ?? 0) ?? []))
  const draftVersion = Math.max(0, ...(layouts?.flat().map((l) => l.version ?? 0) ?? []))
  const setup = `/admin/venues/${v.id}/setup`
  const dash = <span aria-label="Chưa có">–</span>
  return (
    <article className="wz-venue">
      <Link to={setup} className="wz-venue-cover" aria-label={`Quản lý ${v.name}`}>
        <CoverArt type={v.type} />
        <span className="wz-chip">{v.type}</span>
        {state && (
          <span className="wz-chip" data-tone={stateText[state].tone}>
            {stateText[state].chip}
          </span>
        )}
      </Link>
      <div className="wz-venue-body">
        <div className="wz-venue-title">
          <Link to={setup}>
            <h2>{v.name}</h2>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="admin-more" aria-label={`Thao tác ${v.name}`}>
                <img src={more} alt="" width={18} height={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={setup}>Quản lý sân & sơ đồ</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={setup}>Chỉnh sửa sân</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="wz-venue-meta">
          <MapPin size={14} aria-hidden />
          {v.city ? cities[v.city] : v.city_name}
          {v.district ? ` · ${v.district}` : ''}
        </p>
        <div className="wz-venue-stats">
          <span>{!layouts ? '…' : version ? `Sơ đồ v${version}` : draftVersion ? `v${draftVersion} nháp` : dash}</span>
          <span>{!layouts ? '…' : seats ? `${seats.toLocaleString('vi-VN')} ghế` : dash}</span>
        </div>
        <div className="wz-venue-foot">
          <span className={state === 'NO_LAYOUT' ? 'wz-danger-text' : state === 'DRAFT_ONLY' ? 'wz-warn-text' : ''}>
            {state === 'NO_LAYOUT' ? 'Chưa có sơ đồ ghế' : state === 'DRAFT_ONLY' ? 'Sơ đồ chưa phát hành' : ''}
          </span>
          {state === 'READY' ? (
            <Link className="wz-link" to={`/admin/events/new?venueId=${v.id}`}>
              Tạo sự kiện →
            </Link>
          ) : state ? (
            <Link className="wz-link" to={setup}>
              Hoàn thiện sân →
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}
