import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  exportSeatLayoutSeats,
  exportSeatLayoutZones,
  updateVenue,
  useGetSeatLayout,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Venue, VenueInput } from '@/api/generated/model'
import { AdminPage, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { download } from '@/design/admin/data'
import { useLayoutDirectory, useVenueDirectory, cities } from './catalog'
import { VenueLayoutWorkspace } from './VenueLayoutWorkspace'
import { VenueActions } from './VenueActions'
import { venueLayout } from './venueLayoutModel'

export function VenueWorkspace({ venueId }: { venueId: string }) {
  const venues = useVenueDirectory()
  const layouts = useLayoutDirectory(venueId)
  const [params, setParams] = useSearchParams()
  const selected = venueLayout(layouts.data, params.get('layout'))
  const detail = useGetSeatLayout(selected?.id ?? '', { query: { enabled: !!selected?.id } })
  const venue = venues.data?.find((v) => v.id === venueId)
  const csv = useMutation({
    mutationFn: async (kind: 'zones' | 'seats') => {
      const content = await (kind === 'zones' ? exportSeatLayoutZones : exportSeatLayoutSeats)(selected!.id!)
      download(content, `${kind}-${selected!.id}.csv`, 'text/csv')
    },
  })
  return (
    <AdminPage
      title={venue?.name ?? 'Quản lý sân'}
      caption="SÂN · NỀN SVG · CÁC PHIÊN BẢN LAYOUT"
      actions={
        <div className="venue-inline-actions">
          <Link to="?import=new">Thêm layout</Link>
          {venue && <VenueActions venue={venue} />}
        </div>
      }
    >
      <div className="venue-import-shell">
        <Panel className="venue-card space-y-4">
          <h2>Các layout của sân</h2>
          <QueryState
            query={layouts}
            empty={!layouts.data?.length}
            emptyText="Chưa có layout. Chọn Thêm layout để nhập SVG."
          >
            <div className="venue-import-layouts">
              {layouts.data?.map((l) => (
                <Button
                  key={l.id}
                  variant={selected?.id === l.id ? 'default' : 'outline'}
                  onClick={() => setParams({ layout: l.id! })}
                >
                  {l.name} · {l.layout_type} · v{l.version}
                </Button>
              ))}
            </div>
          </QueryState>
        </Panel>
        {params.has('layout') && layouts.data && !selected && (
          <p role="alert">Layout không thuộc sân này hoặc không còn tồn tại. Chọn một layout trong danh sách.</p>
        )}
        {selected && (
          <QueryState query={detail}>
            {detail.data && (
              <VenueLayoutWorkspace
                key={selected.id}
                catalogOnly
                layout={detail.data}
                onExport={(kind) => csv.mutate(kind)}
                exportPending={csv.isPending}
                exportError={csv.error}
              />
            )}
          </QueryState>
        )}
        <QueryState query={venues} empty={!venue} emptyText="Không tìm thấy sân.">
          {venue && <VenueMetadata key={venue.id} venue={venue} />}
        </QueryState>
      </div>
    </AdminPage>
  )
}

function VenueMetadata({ venue }: { venue: Venue }) {
  const [body, setBody] = useState<VenueInput>({
    name: venue.name,
    address: venue.address ?? undefined,
    city: venue.city ?? undefined,
    district: venue.district ?? undefined,
    lat: venue.lat ?? undefined,
    lng: venue.lng ?? undefined,
    rules: venue.rules ?? undefined,
  })
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () => updateVenue(venue.id!, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-venue-directory'] }),
  })
  const number = (value: string) => (value === '' ? undefined : Number(value))
  return (
    <Panel className="venue-card space-y-4">
      <h2>Thông tin sân</h2>
      <div className="venue-setup-fields">
        <Field label="Tên sân">
          <input value={body.name ?? ''} onChange={(e) => setBody({ ...body, name: e.target.value })} />
        </Field>
        <Field label="Địa chỉ">
          <input value={body.address ?? ''} onChange={(e) => setBody({ ...body, address: e.target.value })} />
        </Field>
        <Field label="Tỉnh/thành">
          <select
            value={body.city ?? ''}
            onChange={(e) => setBody({ ...body, city: e.target.value as VenueInput['city'] })}
          >
            <option value="">Giữ tỉnh/thành hiện tại</option>
            {Object.entries(cities).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quận/huyện">
          <input value={body.district ?? ''} onChange={(e) => setBody({ ...body, district: e.target.value })} />
        </Field>
        <Field label="Vĩ độ">
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={body.lat ?? ''}
            onChange={(e) => setBody({ ...body, lat: number(e.target.value) })}
          />
        </Field>
        <Field label="Kinh độ">
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={body.lng ?? ''}
            onChange={(e) => setBody({ ...body, lng: number(e.target.value) })}
          />
        </Field>
        <Field label="Nội quy">
          <textarea rows={4} value={body.rules ?? ''} onChange={(e) => setBody({ ...body, rules: e.target.value })} />
        </Field>
      </div>
      <ErrorNotice error={save.error} />
      {save.isSuccess && <p role="status">Đã lưu thông tin sân.</p>}
      <Button disabled={!body.name?.trim() || !body.address?.trim() || save.isPending} onClick={() => save.mutate()}>
        Lưu thông tin sân
      </Button>
    </Panel>
  )
}
