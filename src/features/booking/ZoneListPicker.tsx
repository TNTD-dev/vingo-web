import { useMemo, useState } from 'react'

import { useGetSeatmap } from '@/api/generated/endpoints/search/search'
import type { GetAvailability200ZonesItem, SeatMapZonesItem, SeatMapZonesItemSeatsItem } from '@/api/generated/model'
import { Skeleton } from '@/design/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatVnd } from '@/lib/money'

type Seat = SeatMapZonesItemSeatsItem

type Props = {
  showtimeId: string
  zones: GetAvailability200ZonesItem[]
  /** Id ghế (API) đang được chọn. */
  selected: ReadonlySet<string>
  /** Khu đứng đang chọn (nếu có). */
  standingZoneId?: string
  /** Bấm ghế: truyền khu, ghế và toàn bộ ghế của khu (để tìm ghế cặp). */
  onSeatClick: (zone: GetAvailability200ZonesItem, seat: Seat, seats: Seat[]) => void
  onStandingClick: (zone: GetAvailability200ZonesItem) => void
}

/**
 * Chọn khu/ghế dạng danh sách, không cần SVG.
 * Dùng khi API chưa có SVG sơ đồ cho người mua: chỉ cần availability (khu, giá, số chỗ)
 * và seatmap (ghế, trạng thái) là đủ để chọn và giữ chỗ.
 */
export function ZoneListPicker({ showtimeId, zones, selected, standingZoneId, onSeatClick, onStandingClick }: Props) {
  const [openId, setOpenId] = useState<string>()
  const open = zones.find((z) => z.zone_id === openId)
  const seatmap = useGetSeatmap(
    showtimeId,
    { zone_id: openId },
    { query: { enabled: Boolean(openId), refetchInterval: 15_000 } },
  )
  const zoneMap: SeatMapZonesItem | undefined = seatmap.data?.zones?.find((z) => z.zone_id === openId)

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Danh sách khu">
        {zones.map((z) => {
          const soldOut = (z.seats_left ?? 0) <= 0
          const active = z.zone_id === openId || z.zone_id === standingZoneId
          return (
            <li key={z.zone_id}>
              <button
                type="button"
                disabled={soldOut}
                aria-pressed={active}
                onClick={() => {
                  setOpenId(z.zone_id)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
                  active ? 'bg-ink text-on-ink' : 'bg-canvas hover:bg-muted',
                )}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate type-body-m-strong">{z.name}</span>
                  <span className={cn('type-caption', active ? 'text-on-ink-secondary' : 'text-ink-tertiary')}>
                    {soldOut ? 'Hết chỗ' : `Còn ${z.seats_left} chỗ`}
                  </span>
                </span>
                <span className="shrink-0 type-body-m-strong">{z.tier ? formatVnd(z.tier.price) : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {open && (
        <div className="flex flex-col gap-3 rounded-md border border-line p-4">
          {seatmap.isPending ? (
            <Skeleton className="h-32 rounded-md" aria-busy="true" />
          ) : seatmap.isError || !zoneMap ? (
            <p className="type-body-m text-ink-secondary">Chưa tải được ghế của khu này. Vui lòng chọn lại khu.</p>
          ) : zoneMap.kind === 'STANDING' ? (
            <div className="flex flex-col gap-3">
              <p className="type-body-m text-ink-secondary">
                Khu đứng không có số ghế. Chọn số lượng vé ở khung bên cạnh sau khi chọn khu.
              </p>
              <button
                type="button"
                onClick={() => onStandingClick(open)}
                className="self-start rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Chọn khu {open.name}
              </button>
            </div>
          ) : (
            <SeatGrid zone={open} seats={zoneMap.seats ?? []} selected={selected} onSeatClick={onSeatClick} />
          )}
        </div>
      )}
      {!open && <p className="type-caption text-ink-tertiary">Chọn một khu để xem ghế còn trống.</p>}
    </div>
  )
}

function SeatGrid({
  zone,
  seats,
  selected,
  onSeatClick,
}: {
  zone: GetAvailability200ZonesItem
  seats: Seat[]
  selected: ReadonlySet<string>
  onSeatClick: Props['onSeatClick']
}) {
  const rows = useMemo(() => {
    const byRow = new Map<string, Seat[]>()
    for (const s of seats) byRow.set(s.row ?? '', [...(byRow.get(s.row ?? '') ?? []), s])
    return [...byRow.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
      .map(([row, list]) => [row, [...list].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))] as const)
  }, [seats])

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <h3 className="type-mono-label text-ink-secondary">Khu {zone.name}</h3>
      {rows.map(([row, list]) => (
        <div key={row} className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 type-caption text-ink-tertiary">{row}</span>
          {list.map((s) => {
            const isSelected = s.seat_id ? selected.has(s.seat_id) : false
            const free = s.status === 'AVAILABLE'
            return (
              <button
                key={s.seat_id}
                type="button"
                disabled={!free && !isSelected}
                aria-pressed={isSelected}
                aria-label={`Hàng ${row} ghế ${s.number}${free || isSelected ? '' : s.status === 'HELD' ? ', đang được giữ' : ', không còn'}`}
                onClick={() => onSeatClick(zone, s, seats)}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md type-caption outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'bg-seat-selected text-on-ink'
                    : free
                      ? 'border border-ink-tertiary bg-seat-available hover:bg-muted'
                      : s.status === 'HELD'
                        ? 'cursor-not-allowed bg-warning/70'
                        : 'cursor-not-allowed bg-map-sold',
                )}
              >
                {s.number}
              </button>
            )
          })}
        </div>
      ))}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
        {[
          ['border border-ink-tertiary bg-seat-available', 'Trống'],
          ['bg-seat-selected', 'Bạn chọn'],
          ['bg-warning/70', 'Đang được giữ'],
          ['bg-map-sold', 'Đã bán'],
        ].map(([cls, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className={cn('size-3.5 rounded-pill', cls)} />
            <span className="type-caption text-ink-secondary">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
