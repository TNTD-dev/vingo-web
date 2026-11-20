import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { getAdminEvent, putPriceTiers, putZonePrices } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { EventDetail, PriceTierInput } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { ErrorNotice, Panel, QueryState } from '@/design/admin/AdminUi'
import { LightButton } from '@/design/admin/wizard'
import { Button } from '@/design/ui/button'
import { formatVnd } from '@/lib/money'
import { SeatMapView } from '@/seatmap/SeatMapView'
import { toast } from 'sonner'
import { dateText } from '@/design/admin/data'
import { useLayoutSvg } from './catalog'
import { getVenueOverview } from '@/api/generated/endpoints/venue-imports/venue-imports'
import { mergeLayers } from './LayoutPreview'
import { activeShowtimes, stepLabels, useEventLayouts, useZoneAssignments } from './eventSetup'
import { formatVndShort } from './readiness'
import { saveZoneAssignments } from './zoneAssignments'
import { stepItems, WizardShell } from './WizardShell'

type Tier = { key: string; id?: string; name: string; price: number; color?: string }
const palette = ['#86BDF6', '#A4CC83', '#F5BF70', '#B6A1E5', '#F49CAB', '#70C8C1']
const fallbackColor = (price: number) => {
  const hash = (Math.trunc(price) | 0) ^ (Math.trunc(price / 2 ** 32) | 0)
  return palette[((hash % palette.length) + palette.length) % palette.length]
}

/** Bước 3 của wizard sự kiện: hạng giá + gán khu trên sơ đồ. */
export default function EventPricing({ event, goStep }: { event: EventDetail; goStep: (step: number) => void }) {
  const layouts = useEventLayouts(event),
    saved = useZoneAssignments(event)
  const ordered = !!event.seat_layout_id
  const hasLayout = ordered || activeShowtimes(event).some((s) => !!s.seat_layout_id)
  if (layouts.data && saved.data !== undefined && hasLayout)
    return (
      <PricingBody key={event.id} event={event} layouts={layouts.data} initial={saved.data ?? {}} goStep={goStep} />
    )
  return (
    <WizardShell
      title="Giá theo khu"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC ${ordered ? '2/5' : '3/4'}`}
      steps={stepItems(stepLabels(event), ordered ? 1 : 2)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <>
          <LightButton back onClick={() => goStep(ordered ? 1 : 2)}>
            Quay lại
          </LightButton>
        </>
      }
    >
      {!hasLayout ? (
        <Panel>
          <p className="admin-notice">Thêm suất diễn có sơ đồ trước để gán giá theo khu.</p>
          <Button className="admin-small-button mt-4" onClick={() => goStep(ordered ? 1 : 2)}>
            Về bước Suất diễn
          </Button>
        </Panel>
      ) : (
        <QueryState query={layouts}>
          <QueryState query={saved}>{null}</QueryState>
        </QueryState>
      )}
    </WizardShell>
  )
}

function PricingBody({
  event,
  layouts,
  initial,
  goStep,
}: {
  event: EventDetail
  layouts: NonNullable<ReturnType<typeof useEventLayouts>['data']>
  initial: Record<string, string>
  goStep: (step: number) => void
}) {
  const client = useQueryClient()
  const ordered = !!event.seat_layout_id
  const layoutList = Object.values(layouts)
  const [tiers, setTiers] = useState<Tier[]>(() =>
    event.price_tiers?.length
      ? event.price_tiers.map((t) => ({ key: t.id!, id: t.id, name: t.name, price: t.price, color: t.color }))
      : [{ key: 'new-0', name: '', price: 0 }],
  )
  // zone_id → key của hạng
  const [assign, setAssign] = useState<Record<string, string>>(initial)
  const [active, setActive] = useState(tiers[0].key),
    [layoutId, setLayoutId] = useState(layoutList[0]?.id ?? ''),
    [counter, setCounter] = useState(1)
  const [viewedAt] = useState(() => Date.now())
  const firstOpen = activeShowtimes(event)
    .map((s) => s.sale_opens_at)
    .filter((v): v is string => !!v)
    .sort()[0]
  const locked =
    event.status === 'ENDED' ||
    event.status === 'CANCELLED' ||
    (event.status === 'PUBLISHED' && !!firstOpen && Date.parse(firstOpen) <= viewedAt)
  const layout = layouts[layoutId] ?? layoutList[0]
  const svg = useLayoutSvg(layout?.id ?? '')
  const zones = [...new Map(layoutList.flatMap((l) => l.zones.map((z) => [z.id, z] as const))).values()]
  const tierKeys = new Set(tiers.map((t) => t.key))
  const assigned = (zoneId: string) => (tierKeys.has(assign[zoneId]) ? assign[zoneId] : undefined)
  const unpriced = zones.filter((z) => !assigned(z.id))
  const names = tiers.map((t) => t.name.trim().toLowerCase())
  const [displayNames, setDisplayNames] = useState(() =>
    Object.fromEntries((event.zone_prices ?? []).map((zone) => [zone.zone_id, zone.display_name ?? ''])),
  )
  const [picked, setPicked] = useState<string[]>([])
  const [bulk, setBulk] = useState(true)
  const colorOf = (tier: Tier) => tier.color ?? fallbackColor(tier.price)
  const overview = useQuery({
    queryKey: ['venue-overview', layout?.overview_id],
    queryFn: ({ signal }) => getVenueOverview(layout!.overview_id!, { signal }),
    enabled: !!layout?.overview_id,
  })
  const mapId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const mapSvg = useMemo(() => {
    if (!svg.data || !overview.data?.svg_content) return svg.data
    const merged = mergeLayers(overview.data.svg_content, [svg.data], `pricing-${mapId}`)
    return merged.skipped ? svg.data : merged.svg || svg.data
  }, [svg.data, overview.data?.svg_content, mapId])
  const tiersValid =
    tiers.length > 0 &&
    tiers.every((t) => t.name.trim() && Number.isSafeInteger(t.price) && t.price >= 0) &&
    new Set(names).size === names.length

  const layoutZones = layout?.zones ?? []
  const pickedPrices = new Set(picked.map((id) => tiers.find((tier) => tier.key === assigned(id))?.price))
  const estimate = layoutZones.reduce(
    (sum, z) => sum + z.capacity * (tiers.find((t) => t.key === assigned(z.id))?.price ?? 0),
    0,
  )
  const pricedHere = layoutZones.filter((z) => assigned(z.id)).length

  const save = useMutation({
    mutationFn: async () => {
      if (locked) return
      const body: PriceTierInput[] = tiers.map((t) => ({
        ...(t.id ? { id: t.id } : {}),
        name: t.name.trim(),
        price: t.price,
        color: colorOf(t),
      }))
      await putPriceTiers(event.id!, body)
      const fresh = tiers.some((t) => !t.id) ? await getAdminEvent(event.id!) : event
      const idOf = (t: Tier) => t.id ?? fresh.price_tiers?.find((x) => x.name === t.name.trim())?.id
      const keyToId = Object.fromEntries(tiers.map((t) => [t.key, idOf(t)]))
      const rows = zones.flatMap((z) => {
        const tierId = keyToId[assigned(z.id) ?? '']
        return tierId
          ? [{ zone_id: z.id, price_tier_id: tierId, display_name: displayNames[z.id]?.trim() || undefined }]
          : []
      })
      await putZonePrices(event.id!, rows)
      saveZoneAssignments(event.id!, Object.fromEntries(rows.map((r) => [r.zone_id, r.price_tier_id])))
    },
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success(locked ? 'Giá đã khóa, không thay đổi' : 'Đã lưu giá theo khu')
      goStep(ordered ? 3 : 4)
    },
  })

  function toggleZone(code: string) {
    if (locked) return
    const zone = layoutZones.find((z) => z.code === code)
    if (!zone) return
    if (bulk) {
      setPicked((current) =>
        current.includes(zone.id) ? current.filter((id) => id !== zone.id) : [...current, zone.id],
      )
      return
    }
    setAssign((a) => {
      const next = { ...a }
      if (next[zone.id] === active) delete next[zone.id]
      else next[zone.id] = active
      return next
    })
  }
  const activeIndex = Math.max(
    0,
    tiers.findIndex((t) => t.key === active),
  )
  return (
    <WizardShell
      title="Giá theo khu"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC ${ordered ? '2/5' : '3/4'}`}
      steps={stepItems(stepLabels(event), ordered ? 1 : 2)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <>
          <LightButton back onClick={() => goStep(ordered ? 1 : 2)}>
            Quay lại
          </LightButton>
          <AdminAction disabled={!tiersValid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Đang lưu…' : ordered ? 'Tiếp: Thông tin' : 'Tiếp: Xem lại'}
          </AdminAction>
        </>
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
        <Panel className="wz-panel order-2 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2>Hạng giá</h2>
              <p className="wz-panel-hint">Áp cho mọi suất · VND · số nguyên</p>
            </div>
            <span className="wz-chip" data-tone={unpriced.length ? 'warning' : 'success'}>
              {zones.length - unpriced.length}/{zones.length} khu có giá
            </span>
          </div>
          <fieldset disabled={locked || save.isPending} className="mt-4">
            {tiers.map((t, i) => {
              return (
                <div
                  key={t.key}
                  role="group"
                  aria-label={`Hạng giá ${i + 1}`}
                  className="wz-tier pricing-tier"
                  aria-current={t.key === active}
                  onClick={() => setActive(t.key)}
                >
                  <div>
                    <div className="wz-tier-name">
                      <input
                        type="color"
                        aria-label={`Màu hạng ${i + 1}`}
                        value={colorOf(t)}
                        onChange={(e) =>
                          setTiers((current) =>
                            current.map((tier) => (tier.key === t.key ? { ...tier, color: e.target.value } : tier)),
                          )
                        }
                      />
                      <input
                        aria-label={`Tên hạng ${i + 1}`}
                        required
                        maxLength={200}
                        placeholder="Tên hạng, VD: VIP"
                        value={t.name}
                        onFocus={() => setActive(t.key)}
                        onChange={(e) =>
                          setTiers(tiers.map((v) => (v.key === t.key ? { ...v, name: e.target.value } : v)))
                        }
                      />
                    </div>
                  </div>
                  <label className="wz-tier-price">
                    <input
                      aria-label={`Giá ${t.name || `hạng ${i + 1}`}`}
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={t.price}
                      onFocus={() => setActive(t.key)}
                      onChange={(e) =>
                        setTiers(tiers.map((v) => (v.key === t.key ? { ...v, price: Number(e.target.value) } : v)))
                      }
                    />
                    <span aria-hidden>₫</span>
                  </label>

                  <button
                    type="button"
                    aria-label={`Xóa ${t.name || `hạng ${i + 1}`}`}
                    disabled={tiers.length === 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rest = tiers.filter((v) => v.key !== t.key)
                      setTiers(rest)
                      if (active === t.key) setActive(rest[0].key)
                    }}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="wz-dashed"
              onClick={() => {
                const key = `new-${counter}`
                setCounter(counter + 1)
                setTiers([...tiers, { key, name: '', price: 0 }])
                setActive(key)
              }}
            >
              + Thêm hạng giá
            </button>
          </fieldset>
          {!!unpriced.length && (
            <div className="wz-callout mt-4" data-tone="warning">
              <AlertTriangle className="wz-warn-text" aria-hidden />
              <div className="flex-1">
                <strong>
                  {unpriced.length} khu chưa có giá:{' '}
                  {unpriced
                    .slice(0, 4)
                    .map((z) => z.code)
                    .join(', ')}
                  {unpriced.length > 4 ? '…' : ''}
                </strong>
                <small>
                  {unpriced.reduce((s, z) => s + z.capacity, 0).toLocaleString('vi-VN')} ghế sẽ không bán được. Bắt buộc
                  gán trước khi công bố.
                </small>
              </div>
              {!locked && (
                <button
                  type="button"
                  className="wz-link"
                  onClick={() =>
                    setAssign((a) => ({ ...a, ...Object.fromEntries(unpriced.map((z) => [z.id, active])) }))
                  }
                >
                  Gán vào hạng
                </button>
              )}
            </div>
          )}
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Gán theo danh sách khu</summary>
            <div className="mt-3 grid max-h-72 gap-2 overflow-auto">
              {zones.map((z) => (
                <div key={z.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>{z.label || z.code}</span>
                  <input
                    className="admin-input w-48"
                    value={displayNames[z.id] ?? ''}
                    maxLength={200}
                    aria-label={`Tên khu ${z.code}`}
                    placeholder="Dùng tên gốc"
                    disabled={locked}
                    onChange={(e) => setDisplayNames({ ...displayNames, [z.id]: e.target.value })}
                  />
                  <select
                    className="admin-input w-48"
                    aria-label={`Hạng giá khu ${z.label || z.code}`}
                    disabled={locked}
                    value={assigned(z.id) ?? ''}
                    onChange={(e) =>
                      setAssign((a) => {
                        const next = { ...a }
                        if (e.target.value) next[z.id] = e.target.value
                        else delete next[z.id]
                        return next
                      })
                    }
                  >
                    <option value="">Chưa gán</option>
                    {tiers.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name || 'Hạng chưa đặt tên'}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
          <p className="wz-total mt-4">
            Doanh thu tối đa ước tính ({pricedHere}/{layoutZones.length} khu): ≈ {formatVndShort(estimate)} / suất
          </p>
          <p className="wz-note mt-3">
            {locked
              ? 'Giá đã khóa vì suất đầu tiên đã mở bán, hoặc sự kiện đã kết thúc/hủy. Đơn đang giữ chỗ giữ nguyên mức giá cũ.'
              : event.status === 'DRAFT' && firstOpen && Date.parse(firstOpen) <= viewedAt
                ? 'Giờ mở bán trong bản nháp đã qua. Bạn vẫn có thể đặt giá và đổi lịch ở bước Suất diễn.'
                : firstOpen
                  ? `Giá bị khóa khi suất đầu tiên mở bán (${dateText(firstOpen)}) nếu sự kiện đã công bố. Đơn đang giữ chỗ giữ nguyên mức giá cũ.`
                  : 'Giá bị khóa khi suất đầu tiên mở bán.'}
          </p>
          <ErrorNotice error={save.error} />
          {!tiersValid && <p className="admin-notice mt-3">Mỗi hạng cần tên không trùng nhau và giá không âm.</p>}
        </Panel>
        <Panel className="wz-panel order-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2>Gán khu trên sơ đồ</h2>
              <p className="wz-panel-hint">
                Bấm khu để gán vào hạng đang chọn
                {tiers[activeIndex]?.name ? ` (${tiers[activeIndex].name})` : ''}. Bấm lại để bỏ gán.
              </p>
            </div>
            {layoutList.length > 1 ? (
              <select
                aria-label="Sơ đồ"
                className="wz-select"
                value={layout?.id}
                onChange={(e) => setLayoutId(e.target.value)}
              >
                {layoutList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · v{l.version}
                  </option>
                ))}
              </select>
            ) : (
              <span className="wz-chip">Sơ đồ v{layout?.version}</span>
            )}
          </div>
          {!locked && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                aria-pressed={bulk}
                onClick={() => {
                  setBulk(!bulk)
                  setPicked([])
                }}
              >
                Chọn nhiều khu
              </Button>
              {bulk && (
                <>
                  <Button
                    disabled={!picked.length}
                    onClick={() => {
                      setAssign((current) => ({ ...current, ...Object.fromEntries(picked.map((id) => [id, active])) }))
                      setPicked([])
                    }}
                  >
                    Gán hạng cho {picked.length} khu
                  </Button>
                  <Button variant="ghost" disabled={!picked.length} onClick={() => setPicked([])}>
                    Bỏ chọn
                  </Button>
                  {picked.length > 0 && (
                    <div className="w-full text-sm" aria-live="polite">
                      <p>
                        {zones
                          .filter((zone) => picked.includes(zone.id))
                          .map((zone) => displayNames[zone.id] || zone.label || zone.code)
                          .join(', ')}
                      </p>
                      {pickedPrices.size > 1 && <p className="wz-sub">Các khu đang có mức giá khác nhau.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {overview.isError && <ErrorNotice error={overview.error} />}
          <div className="mt-4 h-[380px] overflow-hidden rounded-xl bg-canvas">
            {mapSvg && (!layout?.overview_id || !overview.isPending) ? (
              <SeatMapView
                svg={mapSvg}
                zones={Object.fromEntries(
                  layoutZones.map((z) => {
                    const key = assigned(z.id),
                      i = tiers.findIndex((t) => t.key === key)
                    return [z.code, i >= 0 ? { tier: 1, color: colorOf(tiers[i]), soldOut: false } : { soldOut: true }]
                  }),
                )}
                selected={new Set()}
                selectedZones={new Set(layoutZones.filter((zone) => picked.includes(zone.id)).map((zone) => zone.code))}
                tooltip={(code) => {
                  const zone = layoutZones.find((entry) => entry.code === code)
                  if (!zone) return null
                  const tier = tiers.find((entry) => entry.key === assigned(zone.id))
                  return `${displayNames[zone.id] || zone.label || code} · ${tier ? formatVnd(tier.price) : 'Chưa có giá'}`
                }}
                onZoneClick={toggleZone}
                className="pricing-zone-map h-full"
              />
            ) : (
              <p className="grid h-full place-items-center text-ink-tertiary">
                {svg.isError ? 'Không tải được sơ đồ. Dùng danh sách khu bên phải.' : 'Đang tải sơ đồ…'}
              </p>
            )}
          </div>
          <div className="wz-legend">
            {tiers.map((t) => (
              <p key={t.key}>
                <input
                  type="color"
                  aria-label={`Màu hạng ${t.name || 'chưa đặt tên'}`}
                  value={colorOf(t)}
                  onChange={(e) =>
                    setTiers((current) =>
                      current.map((tier) => (tier.key === t.key ? { ...tier, color: e.target.value } : tier)),
                    )
                  }
                />
                <span>{t.name || 'Hạng chưa đặt tên'}</span>
                <span>{formatVnd(t.price)}</span>
              </p>
            ))}
            <p>
              <span className="wz-tier-swatch" style={{ background: 'var(--vg-map-sold)' }} />
              <span>Chưa có giá</span>
            </p>
          </div>
        </Panel>
      </div>
    </WizardShell>
  )
}
