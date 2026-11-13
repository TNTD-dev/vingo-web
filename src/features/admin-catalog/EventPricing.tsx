import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { putPriceTiers, putZonePrices, getSeatLayout } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getSeatmap } from '@/api/generated/endpoints/search/search'
import type { EventDetail, PriceTierInput } from '@/api/generated/model'
import { Panel, Field, ErrorNotice, QueryState, Table } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { formatVnd } from '@/lib/money'
import { toast } from 'sonner'

export default function EventPricing({ event }: { event: EventDetail }) {
  const [tiers, setTiers] = useState<PriceTierInput[]>(event.price_tiers?.map((t) => ({ ...t })) ?? [])
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () =>
      putPriceTiers(
        event.id!,
        tiers.map((t) => ({ ...t, name: t.name.trim() })),
      ),
    onSuccess: async () => {
      toast.success('Đã lưu hạng giá')
      await client.invalidateQueries()
    },
  })
  return (
    <div className="space-y-4">
      <Panel>
        <h2 className="mb-5">Hạng giá</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
          className="space-y-4"
        >
          <fieldset disabled={save.isPending} className="space-y-3">
            {tiers.map((t, i) => (
              <div key={t.id ?? i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label={`Tên hạng ${i + 1}`}>
                  <input
                    required
                    maxLength={200}
                    value={t.name}
                    onChange={(e) => setTiers(tiers.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))}
                  />
                </Field>
                <Field label="Giá vé (VND)">
                  <input
                    required
                    type="number"
                    min={0}
                    step={1}
                    value={t.price}
                    onChange={(e) =>
                      setTiers(tiers.map((v, j) => (j === i ? { ...v, price: Number(e.target.value) } : v)))
                    }
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Xóa ${t.name || `hạng ${i + 1}`}`}
                  onClick={() => setTiers(tiers.filter((_, j) => i !== j))}
                >
                  ×
                </Button>
              </div>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setTiers([...tiers, { name: '', price: 0 }])}>
              + Thêm hạng
            </Button>
            <Button disabled={save.isPending || !tiers.length || tiers.some((t) => !t.name.trim())}>
              Lưu hạng giá
            </Button>
          </div>
          <ErrorNotice error={save.error} />
        </form>
      </Panel>
      <ZonePricing event={event} />
    </div>
  )
}
function ZonePricing({ event }: { event: EventDetail }) {
  const shows = event.showtimes?.filter((s) => s.status !== 'CANCELLED') ?? []
  const layoutIds = [...new Set(shows.flatMap((s) => (s.seat_layout_id ? [s.seat_layout_id] : [])))]
  const [changes, setChanges] = useState<Record<string, string>>({})
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['admin-all-price-zones', event.id, layoutIds, event.status],
    enabled: !!layoutIds.length,
    queryFn: async () => {
      const layouts = await Promise.all(layoutIds.map((id) => getSeatLayout(id)))
      // Public seatmap chỉ đọc được sự kiện PUBLISHED; cấu hình nháp dùng trực tiếp các layout admin.
      const maps =
        event.status === 'PUBLISHED'
          ? await Promise.all(shows.filter((s) => s.id && s.status !== 'DRAFT').map((s) => getSeatmap(s.id!)))
          : []
      return {
        zones: [
          ...new Map(
            layouts.flatMap((l) => l.zones.map((z) => [z.id, { ...z, layoutName: l.name }] as const)),
          ).values(),
        ],
        prices: Object.fromEntries(
          maps.flatMap(
            (m) => m.zones?.filter((z) => z.zone_id && z.tier?.id).map((z) => [z.zone_id!, z.tier!.id!]) ?? [],
          ),
        ),
      }
    },
  })
  const current = (id: string) => changes[id] ?? query.data?.prices[id] ?? ''
  const save = useMutation({
    mutationFn: () =>
      putZonePrices(
        event.id!,
        query.data!.zones.map((z) => ({ zone_id: z.id, price_tier_id: current(z.id) })),
      ),
    onSuccess: async () => {
      toast.success('Đã lưu giá của tất cả các khu')
      await client.invalidateQueries()
    },
  })
  return (
    <Panel>
      <h2 className="mb-4">Gán giá theo khu</h2>
      <p className="admin-notice mb-5">
        Bảng này gồm tất cả khu của các suất chưa hủy. Lưu sẽ thay toàn bộ cấu hình giá theo khu; hãy chọn đầy đủ hạng
        giá trước khi lưu.
      </p>
      {!layoutIds.length ? (
        <p>Thêm suất diễn trước để cấu hình hạng giá theo khu.</p>
      ) : (
        <QueryState query={query}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <Field label="Gán nhanh cho tất cả khu">
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value)
                    setChanges(Object.fromEntries(query.data!.zones.map((z) => [z.id, e.target.value])))
                }}
              >
                <option value="">Chọn một hạng giá…</option>
                {event.price_tiers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {formatVnd(t.price)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="mt-5 max-h-[500px] overflow-auto">
              <Table label="Giá theo khu" headings={['Khu / sơ đồ', 'Sức chứa', 'Hạng giá']}>
                {query.data?.zones.map((z) => (
                  <tr key={z.id}>
                    <td>
                      {z.label || z.code}
                      <p className="mt-1 text-xs text-ink-secondary">{z.layoutName}</p>
                    </td>
                    <td>{z.capacity.toLocaleString('vi-VN')}</td>
                    <td>
                      <Field label={`Hạng giá khu ${z.label || z.code}`}>
                        <select
                          required
                          aria-label={`Hạng giá khu ${z.label || z.code}`}
                          value={current(z.id)}
                          onChange={(e) => setChanges({ ...changes, [z.id]: e.target.value })}
                        >
                          <option value="">Chưa gán</option>
                          {event.price_tiers?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} · {formatVnd(t.price)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            <ErrorNotice error={save.error} />
            <Button
              className="mt-5 rounded-pill"
              disabled={save.isPending || !query.data?.zones.length || !event.price_tiers?.length}
            >
              Lưu giá theo khu
            </Button>
          </form>
        </QueryState>
      )}
    </Panel>
  )
}
