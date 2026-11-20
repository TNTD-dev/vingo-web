import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { createEvent, updateEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { getVenueOverview } from '@/api/generated/endpoints/venue-imports/venue-imports'
import type { EventDetail } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { ConfirmDialog, ErrorNotice, Field, Panel, QueryState } from '@/design/admin/AdminUi'
import { LightButton } from '@/design/admin/wizard'
import { useLayoutDirectory, useLayoutSvg, useVenueDirectory } from './catalog'
import { stepLabels } from './eventSetup'
import { LayoutPreview } from './LayoutPreview'
import { stepItems, WizardShell } from './WizardShell'

type Category = 'FOOTBALL' | 'CONCERT'

export function EventLayoutStep({
  event,
  venueHint,
  goStep,
}: {
  event?: EventDetail
  venueHint?: string | null
  goStep: (step: number, id?: string) => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [venueId, setVenueId] = useState(event?.venue?.id ?? venueHint ?? '')
  const [category, setCategory] = useState<Category>(event?.category === 'CONCERT' ? 'CONCERT' : 'FOOTBALL')
  const [choice, setChoice] = useState(event?.seat_layout_id ?? '')
  const [confirm, setConfirm] = useState<boolean | null>(null)
  const client = useQueryClient()
  const venues = useVenueDirectory()
  const layouts = useLayoutDirectory(venueId, category)
  const candidates = (layouts.data ?? []).filter((layout) => layout.layout_type === category)
  const layout = candidates.find((item) => item.id === choice) ?? (candidates.length === 1 ? candidates[0] : undefined)
  const svg = useLayoutSvg(layout?.id ?? '')
  const overview = useQuery({
    queryKey: ['venue-overview', layout?.overview_id],
    queryFn: ({ signal }) => getVenueOverview(layout!.overview_id!, { signal }),
    enabled: !!layout?.overview_id,
  })
  const selectionLocked =
    !!event && (event.status !== 'DRAFT' || event.showtimes?.some((show) => show.status !== 'CANCELLED'))
  const changed = !!event?.seat_layout_id && layout?.id !== event.seat_layout_id
  const save = useMutation({
    mutationFn: (advance: boolean) => {
      const body = {
        title: title.trim(),
        category,
        ...(layout?.id && !selectionLocked ? { seat_layout_id: layout.id } : {}),
      }
      return (event?.id ? updateEvent(event.id, body) : createEvent(body)).then((saved) => ({ saved, advance }))
    },
    onSuccess: async ({ saved, advance }) => {
      setConfirm(null)
      await client.invalidateQueries()
      goStep(advance ? 2 : 1, saved.id)
    },
  })

  function requestSave(advance: boolean) {
    if (changed && layout?.id && !selectionLocked) setConfirm(advance)
    else save.mutate(advance)
  }

  return (
    <WizardShell
      title="Sân & layout"
      caption="// SỰ KIỆN · BƯỚC 1/5"
      steps={stepItems(stepLabels(event, true), 0)}
      onSelectStep={event?.seat_layout_id ? (index) => goStep(index + 1) : undefined}
      actions={
        <>
          <LightButton disabled={!title.trim() || save.isPending} onClick={() => requestSave(false)}>
            Lưu nháp
          </LightButton>
          <AdminAction
            disabled={!title.trim() || !(layout?.id ?? event?.seat_layout_id) || save.isPending}
            onClick={() => requestSave(true)}
          >
            Tiếp: Giá theo khu
          </AdminAction>
        </>
      }
    >
      <Panel className="wz-panel space-y-4">
        <Field label="Tên sự kiện *">
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <QueryState query={venues}>
          <Field label="Sân">
            <select
              value={venueId}
              disabled={selectionLocked}
              onChange={(e) => {
                setVenueId(e.target.value)
                setChoice('')
              }}
            >
              <option value="">Chọn sân</option>
              {venues.data?.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </Field>
        </QueryState>
        <Field label="Loại sự kiện">
          <select
            value={category}
            disabled={selectionLocked}
            onChange={(e) => {
              const value = e.target.value
              if (value === 'FOOTBALL' || value === 'CONCERT') {
                setCategory(value)
                setChoice('')
              }
            }}
          >
            <option value="FOOTBALL">Bóng đá</option>
            <option value="CONCERT">Concert</option>
          </select>
        </Field>
        {selectionLocked && <p>Sân, loại và layout đã được dùng cho suất diễn.</p>}
        {venueId && (
          <QueryState
            query={layouts}
            empty={!candidates.length}
            emptyText="Sân chưa có layout đã phát hành cho loại sự kiện này."
          >
            <Field label="Layout đã phát hành">
              <select value={layout?.id ?? ''} disabled={selectionLocked} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Chọn layout</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version}
                  </option>
                ))}
              </select>
            </Field>
          </QueryState>
        )}
        {venueId && <Link to={`/admin/venues/${venueId}/setup`}>Quản lý layout của sân →</Link>}
        {layout?.id && (
          <QueryState query={svg}>
            {layout.overview_id ? (
              <QueryState query={overview}>
                {overview.data?.svg_content && svg.data && (
                  <LayoutPreview overview={overview.data.svg_content} details={[svg.data]} label={layout.name} />
                )}
              </QueryState>
            ) : (
              svg.data && <LayoutPreview overview={svg.data} details={[]} label={layout.name} />
            )}
          </QueryState>
        )}
        <ErrorNotice error={save.error} />
      </Panel>
      {confirm !== null && (
        <ConfirmDialog
          open
          title="Đổi layout sự kiện?"
          description="Giá và tên khu không thuộc layout mới sẽ được gỡ."
          requireReason={false}
          label="Đổi layout"
          pending={save.isPending}
          error={save.error}
          onClose={() => setConfirm(null)}
          onConfirm={() => save.mutate(confirm)}
        />
      )}
    </WizardShell>
  )
}
