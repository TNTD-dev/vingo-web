import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  exportSeatLayoutSeats,
  exportSeatLayoutZones,
  publishSeatLayout,
  renameSeatLayout,
  updateVenue,
  useGetSeatLayout,
} from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Venue, VenueInput } from '@/api/generated/model'
import { AdminPage, ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { download } from '@/design/admin/data'
import { useLayoutDirectory, useVenueDirectory, venueTypes, cities, venueInfoText } from './catalog'
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
  const [mode, setMode] = useState<'rename' | 'publish' | null>(null)
  const [name, setName] = useState('')
  const client = useQueryClient()
  const action = useMutation({
    mutationFn: async () => {
      if (mode === 'publish') await publishSeatLayout(selected!.id!)
      else await renameSeatLayout(selected!.id!, { name: name.trim() })
    },
    onSuccess: async () => {
      setMode(null)
      await client.invalidateQueries()
    },
  })
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
                  {l.name} · {l.legacy ? 'Legacy' : l.layout_type} · v{l.version} · {l.status}
                </Button>
              ))}
            </div>
          </QueryState>
        </Panel>
        {params.has('layout') && layouts.data && !selected && (
          <p role="alert">Layout không thuộc sân này hoặc không còn tồn tại. Chọn một layout trong danh sách.</p>
        )}
        {selected?.legacy && (
          <p className="admin-notice">
            Sơ đồ lịch sử: giữ nguyên để đọc/xuất. Nhập phiên bản v2 để sử dụng cho suất mới.
          </p>
        )}
        {selected && (
          <QueryState query={detail}>
            {detail.data && (
              <VenueLayoutWorkspace
                key={selected.id}
                catalogOnly
                layout={detail.data}
                onRename={() => {
                  action.reset()
                  setName(selected.name)
                  setMode('rename')
                }}
                onPublish={() => {
                  action.reset()
                  setMode('publish')
                }}
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
        {mode === 'publish' && (
          <ConfirmDialog
            open
            title="Phát hành layout?"
            description="Nền và layout sẽ được khóa hình học. Sau khi phát hành, layout có thể được dùng cho suất diễn mới."
            requireReason={false}
            label="Phát hành"
            pending={action.isPending}
            error={action.error}
            onClose={() => setMode(null)}
            onConfirm={() => action.mutate()}
          />
        )}
        {mode === 'rename' && (
          <Panel className="venue-card space-y-4">
            <Field label="Tên layout nháp">
              <input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <ErrorNotice error={action.error} />
            <Button disabled={!name.trim() || action.isPending} onClick={() => action.mutate()}>
              Lưu tên
            </Button>
            <Button variant="outline" onClick={() => setMode(null)}>
              Hủy
            </Button>
          </Panel>
        )}
      </div>
    </AdminPage>
  )
}

function VenueMetadata({ venue }: { venue: Venue }) {
  const [body, setBody] = useState<VenueInput>({
    name: venue.name,
    type: venue.type,
    address: venue.address ?? undefined,
    city: venue.city ?? undefined,
    district: venue.district ?? undefined,
    lat: venue.lat ?? undefined,
    lng: venue.lng ?? undefined,
    info: venue.info,
  })
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: () => updateVenue(venue.id!, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-venue-directory'] }),
  })
  return (
    <Panel className="venue-card space-y-4">
      <h2>Thông tin sân</h2>
      <div className="venue-setup-fields">
        <Field label="Tên sân">
          <input value={body.name} onChange={(e) => setBody({ ...body, name: e.target.value })} />
        </Field>
        <Field label="Loại địa điểm">
          <select value={body.type} onChange={(e) => setBody({ ...body, type: e.target.value as VenueInput['type'] })}>
            {Object.entries(venueTypes).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Địa chỉ">
          <input value={body.address} onChange={(e) => setBody({ ...body, address: e.target.value })} />
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
        {(['parking', 'opening_hours', 'rules'] as const).map((k, i) => (
          <Field key={k} label={['Gửi xe', 'Giờ hoạt động', 'Nội quy'][i]}>
            <textarea
              value={venueInfoText(body.info, k) ?? ''}
              onChange={(e) => setBody({ ...body, info: { ...body.info, [k]: e.target.value } })}
            />
          </Field>
        ))}
      </div>
      <ErrorNotice error={save.error} />
      {save.isSuccess && <p role="status">Đã lưu thông tin sân.</p>}
      <Button disabled={!body.name?.trim() || !body.address?.trim() || save.isPending} onClick={() => save.mutate()}>
        Lưu thông tin sân
      </Button>
    </Panel>
  )
}
