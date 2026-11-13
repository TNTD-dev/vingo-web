import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  blockSeats,
  unblockSeats,
  useGetSeatLayout,
  useGetAdminEvent,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { useGetSeatmap } from '@/api/generated/endpoints/search/search'
import { AdminPage, Panel, Field, QueryState, StateBadge, Table, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { dateText } from '@/design/admin/data'
import { SeatMapView, type SeatState } from '@/seatmap/SeatMapView'
import { seatSvgId } from '@/seatmap/svg'
import { useLayoutSvg } from './catalog'
import { toast } from 'sonner'
import lockWhite from '@/design/admin/icons/lock-white.svg'
export default function ShowtimeSeatsPage() {
  const { showtimeId = '' } = useParams(),
    [params] = useSearchParams(),
    client = useQueryClient(),
    eventId = params.get('eventId') ?? ''
  const event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } }),
    show = event.data?.showtimes?.find((s) => s.id === showtimeId),
    layoutId = show?.seat_layout_id ?? params.get('layoutId') ?? ''
  const layout = useGetSeatLayout(layoutId, { query: { enabled: !!layoutId } }),
    svg = useLayoutSvg(layoutId),
    [zoneChoice, setZoneChoice] = useState<string>(),
    [mode, setMode] = useState<'block' | 'unblock'>('block'),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [reason, setReason] = useState('')
  const focus =
      zoneChoice === undefined ? layout.data?.zones.find((z) => z.kind === 'SEATED')?.code : zoneChoice || undefined,
    zone = layout.data?.zones.find((z) => z.code === focus)
  const visible = (!eventId || event.data?.status === 'PUBLISHED') && show?.status !== 'DRAFT',
    map = useGetSeatmap(showtimeId, zone ? { zone_id: zone.id } : undefined, {
      query: { enabled: visible && !!layout.data, refetchInterval: 15000 },
    })
  const zoneData = map.data?.zones?.find((z) => z.zone_id === zone?.id),
    expected = mode === 'block' ? 'AVAILABLE' : 'BLOCKED'
  const seats = useMemo(
    () =>
      new Map(
        (zoneData?.seats ?? [])
          .filter((s) => s.row && s.number && s.seat_id)
          .map((s) => [seatSvgId(focus ?? '', s.row!, s.number!), s]),
      ),
    [zoneData, focus],
  )
  const states = Object.fromEntries([...seats].map(([id, s]) => [id, s.status ?? 'BLOCKED'])) as Record<
      string,
      SeatState
    >,
    validIds = [...selected].filter((id) => seats.get(id)?.status === expected),
    disabled = map.data?.status === 'CANCELLED' || map.data?.status === 'FINISHED'
  const mutation = useMutation({
    mutationFn: () => {
      const seat_ids = validIds.map((id) => seats.get(id)!.seat_id!)
      return mode === 'block'
        ? blockSeats(showtimeId, { seat_ids, reason: reason.trim() })
        : unblockSeats(showtimeId, { seat_ids })
    },
    onSuccess: async () => {
      setSelected(new Set())
      toast.success(mode === 'block' ? 'Đã khóa ghế' : 'Đã mở khóa ghế')
      await client.invalidateQueries()
    },
  })
  function select(id: string) {
    if (disabled || mutation.isPending || seats.get(id)?.status !== expected) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 200) next.add(id)
      return next
    })
  }
  function chooseZone(code: string) {
    setZoneChoice(code)
    setSelected(new Set())
  }
  return (
    <AdminPage
      title={`Ghế · ${event.data?.title ?? 'Suất diễn'}`}
      caption={`// SUẤT ${dateText(show?.starts_at)} · ${show?.status ?? ''}`}
    >
      {!visible && !event.isPending ? (
        <Panel>
          <p>
            Trạng thái ghế hiện chỉ xem được khi sự kiện và suất đã công bố. Xem sơ đồ gốc trong mục{' '}
            <Link className="underline" to="/admin/venues">
              Sân & sơ đồ ghế
            </Link>
            .
          </p>
        </Panel>
      ) : !layoutId ? (
        <Panel>
          <p>Chọn suất từ trang quản lý sự kiện để tải đúng sơ đồ.</p>
        </Panel>
      ) : (
        <QueryState query={layout}>
          <QueryState query={map}>
            <div className="admin-seats-grid">
              <Panel>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="admin-segment">
                    {(['block', 'unblock'] as const).map((m) => (
                      <button
                        key={m}
                        disabled={mutation.isPending}
                        aria-pressed={mode === m}
                        onClick={() => {
                          setMode(m)
                          setSelected(new Set())
                        }}
                      >
                        {m === 'block' ? (
                          <>
                            <img src={lockWhite} alt="" width={14} height={14} /> Khóa ghế
                          </>
                        ) : (
                          'Mở khóa'
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="admin-zone-tabs">
                    <button aria-pressed={!focus} onClick={() => chooseZone('')}>
                      Toàn cảnh
                    </button>
                    {layout.data?.zones.map((z) => (
                      <button key={z.id} aria-pressed={focus === z.code} onClick={() => chooseZone(z.code)}>
                        {z.label || z.code}
                      </button>
                    ))}
                  </div>
                </div>
                <QueryState query={svg}>
                  <div className="admin-seat-canvas">
                    {svg.data && (
                      <SeatMapView
                        svg={svg.data}
                        zones={Object.fromEntries(
                          (layout.data?.zones ?? []).map((z) => [z.code, { tier: 1, soldOut: false }]),
                        )}
                        focus={focus}
                        seats={states}
                        selected={new Set(validIds)}
                        selectableStatuses={mode === 'unblock' ? ['BLOCKED'] : ['AVAILABLE']}
                        onZoneClick={chooseZone}
                        onSeatClick={select}
                        className="h-full"
                      />
                    )}
                  </div>
                </QueryState>
                <div className="admin-seat-legend">
                  {[
                    ['Trống', 'available'],
                    ['Đang chọn', 'selected'],
                    ['Đã khóa', 'blocked'],
                    ['Đang giữ', 'held'],
                    ['Đã bán', 'sold'],
                  ].map(([label, state]) => (
                    <span key={state}>
                      <i className={state} />
                      {label}
                    </span>
                  ))}
                </div>
              </Panel>
              <Panel>
                <p className="admin-caption">Đang chọn</p>
                <h2 className="my-4">
                  {validIds.length} ghế
                  {validIds.length > 0
                    ? ` · ${validIds
                        .slice(0, 6)
                        .map((id) => {
                          const s = seats.get(id)
                          return `${s?.row}-${s?.number}`
                        })
                        .join(', ')}${validIds.length > 6 ? '…' : ''}`
                    : ''}
                </h2>
                <div className="admin-review-facts">
                  <div>
                    <dt>Đang khóa trong khu</dt>
                    <dd>{[...seats.values()].filter((s) => s.status === 'BLOCKED').length} ghế</dd>
                  </div>
                  <div>
                    <dt>Bỏ qua tự động</dt>
                    <dd>Ghế đã bán / đang giữ</dd>
                  </div>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (validIds.length) mutation.mutate()
                  }}
                >
                  {mode === 'block' && (
                    <Field label="Lý do (ghi audit)">
                      <input
                        required
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ví dụ: Khách mời nhà tài trợ"
                      />
                    </Field>
                  )}
                  <p className="admin-seat-warning">
                    △{' '}
                    {zone?.kind === 'STANDING'
                      ? 'Khóa / mở áp dụng cho ghế có số. Khu đứng được quản lý theo sức chứa.'
                      : 'Không khóa được ghế đã bán hoặc đang được giữ. Mở khóa trả ghế về trạng thái trống ngay.'}
                  </p>
                  <ErrorNotice error={mutation.error} />
                  <AdminAction
                    className="w-full justify-start"
                    disabled={
                      !validIds.length || disabled || mutation.isPending || (mode === 'block' && !reason.trim())
                    }
                  >
                    {mutation.isPending
                      ? 'Đang xử lý…'
                      : `${mode === 'block' ? 'Khóa' : 'Mở khóa'} ${validIds.length} ghế`}
                  </AdminAction>
                  <AdminAction
                    secondary
                    type="button"
                    className="w-full justify-start"
                    disabled={!selected.size || mutation.isPending}
                    onClick={() => setSelected(new Set())}
                  >
                    Bỏ chọn
                  </AdminAction>
                </form>
                {focus && zone?.kind === 'SEATED' && (
                  <details className="mt-5">
                    <summary className="cursor-pointer text-xs text-ink-secondary">Chọn ghế theo danh sách</summary>
                    <div className="mt-3 max-h-80 overflow-auto">
                      <Table label="Chọn ghế theo danh sách" headings={['Chọn', 'Ghế', 'Trạng thái']}>
                        {[...seats].map(([id, s]) => (
                          <tr key={id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Chọn ghế ${s.row}${s.number}`}
                                checked={validIds.includes(id)}
                                disabled={s.status !== expected || disabled || mutation.isPending}
                                onChange={() => select(id)}
                              />
                            </td>
                            <td>
                              {s.row}
                              {s.number}
                            </td>
                            <td>
                              <StateBadge value={s.status} />
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  </details>
                )}
                <button className="mt-4 text-xs text-ink-secondary underline" onClick={() => void map.refetch()}>
                  Làm mới trạng thái
                </button>
              </Panel>
            </div>
          </QueryState>
        </QueryState>
      )}
    </AdminPage>
  )
}
