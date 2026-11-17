import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LockKeyhole, Search, Shuffle } from 'lucide-react'
import { useGetSeatLayoutZone } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getVenueOverview } from '@/api/generated/endpoints/venue-imports/venue-imports'
import type { SeatLayoutOverview } from '@/api/generated/model'
import { Button } from '@/design/ui/button'
import { ErrorNotice, QueryState, Table } from '@/design/admin/AdminUi'
import { formatVnd } from '@/lib/money'
import { parseSeatId, sameZone } from '@/seatmap/svg'
import { useLayoutSvg } from './catalog'
import {
  assignPriceToZones,
  groupZonesByPrice,
  loadLayoutZonePricing,
  removeZonePrices,
  rerandomizePriceColor,
  saveLayoutZonePricing,
  type LayoutZonePricing,
} from './venueLayoutModel'
import { VenueMapView, type VenueGate } from './VenueMapView'
import { mergeLayers } from './LayoutPreview'

export function VenueLayoutWorkspace({
  layout,
  onRename,
  onPublish,
  onExport,
  exportPending,
  exportError,
  catalogOnly = false,
}: {
  layout: SeatLayoutOverview
  onRename: () => void
  onPublish: () => void
  onExport: (kind: 'zones' | 'seats') => void
  exportPending: boolean
  exportError: unknown
  catalogOnly?: boolean
}) {
  const [focus, setFocus] = useState<string>(),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState(''),
    [seatId, setSeatId] = useState<string>(),
    [gate, setGate] = useState<VenueGate>(),
    [pricing, setPricing] = useState<LayoutZonePricing>(() => loadLayoutZonePricing(layout.id ?? '')),
    [pickedZones, setPickedZones] = useState<string[]>([]),
    [priceInput, setPriceInput] = useState(''),
    [pickOnMap, setPickOnMap] = useState(false)
  const svg = useLayoutSvg(layout.id!)
  const overviewId = catalogOnly ? layout.overview_id : undefined
  const overview = useQuery({
    queryKey: ['venue-overview', overviewId],
    queryFn: () => getVenueOverview(overviewId!),
    enabled: !!overviewId,
  })
  const mapId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const merged = useMemo(() => {
    if (!overview.data?.svg_content || !svg.data) return
    return mergeLayers(overview.data.svg_content, [svg.data], `workspace-${mapId}`)
  }, [overview.data?.svg_content, svg.data, mapId])
  const mapSvg = merged?.svg && !merged.skipped ? merged.svg : svg.data
  const zone = layout.zones.find((z) => z.code === focus || sameZone(focus ?? '', z.code))
  const detail = useGetSeatLayoutZone(layout.id!, zone?.id ?? '', {
    query: { enabled: !!zone && zone.kind === 'SEATED' },
  })
  const seat = seatId ? parseSeatId(seatId) : null
  const seatData =
    seat && detail.data?.rows?.find((r) => r.row_label === seat.row)?.seats.find((s) => s.number === seat.number)
  function openZone(code: string) {
    setFocus(code)
    setSeatId(undefined)
    setGate(undefined)
  }
  function updatePricing(next: LayoutZonePricing) {
    setPricing(next)
    if (layout.id) saveLayoutZonePricing(layout.id, next)
  }
  function togglePickZone(code: string) {
    const targetCode = layout.zones.find((z) => z.code === code || sameZone(code, z.code))?.code ?? code
    setPickedZones((prev) => (prev.includes(targetCode) ? prev.filter((c) => c !== targetCode) : [...prev, targetCode]))
  }
  const rows = layout.zones.filter(
    (z) =>
      (!kind || kind === z.kind) &&
      [z.code, z.label].some((v) => v.toLowerCase().includes(search.trim().toLowerCase())),
  )
  const pickedSet = new Set(pickedZones)
  const zoneColors = Object.fromEntries(
    Object.entries(pricing.zonePrices).flatMap(([code, price]) => {
      const color = pricing.priceColors[String(price)]
      return color ? [[code, color]] : []
    }),
  )
  const priceGroups = groupZonesByPrice(pricing)
  const parsedPrice = priceInput.trim() === '' ? Number.NaN : Number(priceInput)
  const canAssign = pickedZones.length > 0 && Number.isFinite(parsedPrice) && parsedPrice >= 0
  const anyPickedPriced = pickedZones.some((code) => code in pricing.zonePrices)
  const selectedZonePrice = zone ? pricing.zonePrices[zone.code] : undefined
  return (
    <div className="venue-workspace">
      <section className="venue-card venue-canvas-card" aria-label="Sơ đồ sân">
        <div className="venue-map-toolbar">
          <div>
            <strong>Sơ đồ sân</strong>
            <span className="venue-chip">
              {layout.status === 'PUBLISHED' ? (
                <>
                  <LockKeyhole size={12} /> Đã khóa
                </>
              ) : (
                'Bản nháp'
              )}
            </span>
          </div>
          <div className="venue-inline-actions">
            <details className="venue-export">
              <summary>Xuất CSV</summary>
              <div>
                <button
                  type="button"
                  disabled={exportPending}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open')
                    onExport('zones')
                  }}
                >
                  Danh sách khu
                </button>
                <button
                  type="button"
                  disabled={exportPending}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open')
                    onExport('seats')
                  }}
                >
                  Danh sách ghế
                </button>
              </div>
            </details>
            {layout.status === 'DRAFT' && !layout.legacy && (
              <>
                <Button variant="outline" onClick={onRename}>
                  Đổi tên
                </Button>
                <Button onClick={onPublish}>Phát hành</Button>
              </>
            )}
          </div>
        </div>
        <div className="venue-map-heading">
          <div>
            <h2>{layout.name}</h2>
            <p>Màu, hình học và cổng từ SVG xuất từ Figma</p>
          </div>
          {focus && <span className="venue-chip">{zone?.label ?? focus}</span>}
        </div>
        {overviewId && overview.isError && <ErrorNotice error={overview.error} />}
        {merged && (!merged.svg || merged.skipped > 0) && <p role="alert">Không thể ghép SVG nền với layout này.</p>}
        <QueryState query={svg}>
          <div className="venue-map-area">
            {overviewId && overview.isPending && <p role="status">Đang tải nền sân…</p>}
            {mapSvg && (!overviewId || !overview.isPending) && (
              <VenueMapView
                svg={mapSvg}
                focus={focus}
                selectedSeat={seatId}
                selectedZones={pickedSet}
                zoneColors={catalogOnly ? undefined : zoneColors}
                onZoneClick={(code) => {
                  if (pickOnMap) {
                    togglePickZone(code)
                    return
                  }
                  openZone(code)
                }}
                onOverview={() => {
                  setFocus(undefined)
                  setSeatId(undefined)
                  setGate(undefined)
                }}
                onSeatClick={(id) => {
                  const s = parseSeatId(id)
                  if (s) {
                    setFocus(s.zone)
                    setSeatId(id)
                    setGate(undefined)
                  }
                }}
                onGateClick={(g) => {
                  setGate(g)
                  setSeatId(undefined)
                }}
              />
            )}
          </div>
        </QueryState>
        <ErrorNotice error={exportError} />
        <footer className="venue-map-help">
          Lăn chuột để zoom · Kéo để di chuyển · Bấm khu để xem ghế.
          <br />
          {layout.status === 'PUBLISHED'
            ? 'Sơ đồ đã phát hành được khóa. Nhập SVG xuất từ Figma để tạo cấu hình mới.'
            : 'Đây là bản nháp, chưa dùng được cho suất diễn cho tới khi phát hành.'}
        </footer>
      </section>
      <aside className="venue-card venue-zone-panel" aria-label="Danh sách khu và thông tin chi tiết">
        <h2>Danh sách khu ({layout.zones.length})</h2>
        {catalogOnly ? (
          <p className="venue-setup-hint">Giá vé được cấu hình theo sự kiện.</p>
        ) : (
          <section className="venue-pricing-box" aria-label="Cấu hình giá vé theo khu">
            <div className="venue-pricing-head">
              <strong>Cấu hình giá vé chung</strong>
              <button
                type="button"
                className="venue-pricing-toggle"
                aria-pressed={pickOnMap}
                onClick={() => setPickOnMap((v) => !v)}
              >
                {pickOnMap ? 'Đang chọn trên sơ đồ' : 'Chọn nhiều khu trên sơ đồ'}
              </button>
            </div>
            <div className="venue-pricing-quick">
              <button type="button" onClick={() => setPickedZones(rows.map((z) => z.code))} disabled={!rows.length}>
                Chọn tất cả ({rows.length})
              </button>
              {!!pickedZones.length && (
                <button type="button" onClick={() => setPickedZones([])}>
                  Bỏ chọn ({pickedZones.length})
                </button>
              )}
            </div>
            <form
              className="venue-pricing-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!canAssign) return
                updatePricing(assignPriceToZones(pricing, pickedZones, parsedPrice))
                setPickedZones([])
              }}
            >
              <input
                aria-label="Giá vé chung cho các khu đã chọn"
                type="number"
                min={0}
                step={1000}
                placeholder="Giá vé VNĐ (VD: 500000)"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
              <Button type="submit" disabled={!canAssign}>
                Gán giá ({pickedZones.length} khu)
              </Button>
              {anyPickedPriced && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    updatePricing(removeZonePrices(pricing, pickedZones))
                    setPickedZones([])
                  }}
                >
                  Xóa giá
                </Button>
              )}
            </form>
            {!!priceGroups.length && (
              <div className="venue-price-groups" aria-label="Các mức giá đã cấu hình">
                {priceGroups.map((g) => (
                  <div key={g.price} className="venue-price-chip">
                    <button
                      type="button"
                      className="venue-price-select"
                      onClick={() => {
                        setPickedZones(g.zones)
                        setPriceInput(String(g.price))
                      }}
                    >
                      <span
                        className="venue-color-dot"
                        style={{ background: g.color.fill, borderColor: g.color.stroke }}
                        aria-hidden="true"
                      />
                      <strong>{formatVnd(g.price)}</strong>
                      <span>{g.zones.length} khu</span>
                    </button>
                    <button
                      type="button"
                      className="venue-price-reroll"
                      aria-label={`Đổi màu mức giá ${formatVnd(g.price)}`}
                      title="Đổi màu ngẫu nhiên"
                      onClick={() => updatePricing(rerandomizePriceColor(pricing, g.price))}
                    >
                      <Shuffle size={12} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        <div className="venue-zone-filters">
          <label className="venue-search">
            <Search size={14} />
            <input
              aria-label="Tìm mã hoặc tên khu"
              placeholder="Tìm mã khu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select aria-label="Lọc loại khu" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Tất cả loại</option>
            <option value="SEATED">Ghế ngồi</option>
            <option value="STANDING">Chỗ đứng</option>
          </select>
        </div>
        <Table
          label="Khu trong sơ đồ"
          headings={catalogOnly ? ['Mã khu', 'Loại', 'Sức chứa'] : ['Mã khu', 'Loại', 'Giá vé', 'Sức chứa']}
        >
          {rows.map((z) => {
            const active = !!focus && (z.code === focus || z.code === zone?.code)
            const picked = pickedSet.has(z.code)
            const price = pricing.zonePrices[z.code]
            const color = !catalogOnly && price !== undefined ? pricing.priceColors[String(price)] : undefined
            return (
              <tr key={z.id} className={active ? 'venue-zone-active' : undefined}>
                <td>
                  <span className="venue-zone-check">
                    {!catalogOnly && (
                      <input
                        type="checkbox"
                        aria-label={`Chọn khu ${z.code}`}
                        checked={picked}
                        onChange={() => togglePickZone(z.code)}
                      />
                    )}
                    {color && (
                      <span
                        className="venue-color-dot"
                        style={{ background: color.fill, borderColor: color.stroke }}
                        aria-hidden="true"
                      />
                    )}
                    <button aria-pressed={active} onClick={() => openZone(z.code)} title={z.label}>
                      {z.label || z.code}
                    </button>
                  </span>
                </td>
                <td>{z.kind === 'SEATED' ? 'Ghế ngồi' : 'Chỗ đứng'}</td>
                {!catalogOnly && <td>{price !== undefined ? formatVnd(price) : '—'}</td>}
                <td>{z.capacity.toLocaleString('vi-VN')}</td>
              </tr>
            )
          })}
        </Table>
        {!rows.length && <p className="venue-empty">Không có khu phù hợp với bộ lọc.</p>}
        <p className="venue-table-count">
          {rows.length} / {layout.zones.length} khu
        </p>
        <section className="venue-zone-detail" aria-label="Thông tin khu đang chọn">
          <h3>{zone ? `Khu ${zone.label || zone.code}` : 'Chọn một khu'}</h3>
          {zone ? (
            <>
              <p>
                {zone.capacity.toLocaleString('vi-VN')} {zone.kind === 'SEATED' ? 'ghế ngồi' : 'chỗ đứng'}
                {!catalogOnly && selectedZonePrice !== undefined ? ` · ${formatVnd(selectedZonePrice)}` : ''}
              </p>
              <p className="venue-svg-id">{zone.svg_id}</p>
              {zone.kind === 'SEATED' && (
                <QueryState query={detail}>
                  <p>{detail.data?.rows?.length ?? 0} hàng ghế</p>
                  {seat && (
                    <div className="venue-selection">
                      <strong>
                        Hàng {seat.row} · Ghế {seat.number}
                      </strong>
                      <p>{seatData ? `Mã ghế: ${seatData.id}` : 'Chưa tìm thấy dữ liệu ghế tương ứng trong API.'}</p>
                      <small>Chỉ xem cấu hình, không thay đổi trạng thái vé.</small>
                    </div>
                  )}
                </QueryState>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setFocus(undefined)
                  setSeatId(undefined)
                  setGate(undefined)
                }}
              >
                Về toàn cảnh
              </Button>
            </>
          ) : (
            <p>Bấm một khu trên sơ đồ hoặc trong bảng để xem chi tiết.</p>
          )}
          {gate && (
            <div className="venue-selection">
              <strong>Cổng {gate.number}</strong>
              <p className="venue-svg-id">{gate.id}</p>
              {gate.zone && <p>Khu {gate.zone}</p>}
              <small>Định danh từ SVG; không suy đoán hướng hoặc tình trạng mở cổng.</small>
            </div>
          )}
        </section>
      </aside>
    </div>
  )
}
