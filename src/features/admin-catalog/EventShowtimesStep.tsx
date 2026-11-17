import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelShowtime } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { EventDetail, Showtime } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { ConfirmDialog, Panel, StateBadge } from '@/design/admin/AdminUi'
import { dateText } from '@/design/admin/data'
import { LightButton } from '@/design/admin/wizard'
import { vnParts } from './catalog'
import { activeShowtimes, stepLabels } from './eventSetup'
import ShowtimeEditor from './ShowtimeEditor'
import { stepItems, WizardShell } from './WizardShell'

type Mode = { kind: 'edit'; show: Showtime } | { kind: 'new'; template?: Showtime }

/** Bước 2 của wizard sự kiện: danh sách suất bên trái, form một suất bên phải. */
export default function EventShowtimesStep({
  event,
  venueHint,
  goStep,
}: {
  event: EventDetail
  venueHint: string | null
  goStep: (step: number) => void
}) {
  const shows = activeShowtimes(event)
  const client = useQueryClient()
  const [cancelId, setCancelId] = useState<string>()
  const cancel = useMutation({
    mutationFn: (reason: string) => cancelShowtime(cancelId!, { reason }),
    onSuccess: async () => {
      setCancelId(undefined)
      setMode({ kind: 'new' })
      await client.invalidateQueries()
    },
  })
  const [mode, setMode] = useState<Mode>(() => (shows[0] ? { kind: 'edit', show: shows[0] } : { kind: 'new' }))
  const ordered = !!event.seat_layout_id
  const football = event.category === 'FOOTBALL'
  const canAdd = !football || shows.length === 0
  const editorMode: Mode =
    football && shows.length
      ? { kind: 'edit', show: shows.find((show) => mode.kind === 'edit' && show.id === mode.show.id) ?? shows[0] }
      : mode
  const selected = editorMode.kind === 'edit' ? editorMode.show : undefined
  // Form trống mặc định chọn sẵn sân của suất gần nhất để thêm các suất cùng sân nhanh hơn.
  const lastVenue = shows.at(-1)?.venue?.id ?? venueHint
  return (
    <WizardShell
      title="Suất diễn"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC ${ordered ? '4/5' : '2/4'}`}
      steps={stepItems(stepLabels(event), ordered ? 3 : 1)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <>
          <LightButton back onClick={() => goStep(ordered ? 3 : 1)}>
            Quay lại
          </LightButton>
          <AdminAction disabled={!shows.length} onClick={() => goStep(ordered ? 5 : 3)}>
            {ordered ? 'Tiếp: Xem lại' : 'Tiếp: Giá theo khu'}
          </AdminAction>
        </>
      }
    >
      <div className="wz-grid wz-grid-side-left" style={{ gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)' }}>
        <Panel className="wz-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2>{shows.length} suất diễn</h2>
            {selected && canAdd && (
              <LightButton
                type="button"
                onClick={() => setMode({ kind: 'new', template: selected })}
                aria-label="Nhân bản suất đang chọn"
              >
                Nhân bản
              </LightButton>
            )}
          </div>
          {shows.map((s) => {
            const p = vnParts(s.starts_at),
              end = vnParts(s.ends_at),
              open = vnParts(s.sale_opens_at),
              where = s.venue
            return (
              <button
                key={s.id}
                type="button"
                className="wz-show"
                aria-current={selected?.id === s.id}
                onClick={() => setMode({ kind: 'edit', show: s })}
              >
                <span className="wz-show-day">
                  <strong>{p?.day}</strong>
                  <small>TH{p?.month}</small>
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="font-medium">
                    {p?.weekday} · {p?.time}–{end?.time}
                  </strong>
                  <small>
                    {where ? `${where.name}` : 'Sân'} · mở bán{' '}
                    {open ? `${open.day}/${open.month} ${open.time}` : dateText(s.sale_opens_at)}
                  </small>
                  <span className="mt-1 inline-block">
                    <StateBadge value={selected?.id === s.id ? 'ĐANG SỬA' : s.status} />
                  </span>
                </span>
              </button>
            )
          })}
          {!football && (
            <button type="button" className="wz-dashed" onClick={() => setMode({ kind: 'new' })}>
              + Thêm suất
            </button>
          )}
        </Panel>
        <Panel className="wz-panel">
          <ShowtimeEditor
            key={
              editorMode.kind === 'edit' ? editorMode.show.id : `new-${editorMode.template?.id ?? ''}-${shows.length}`
            }
            eventId={event.id!}
            initial={editorMode.kind === 'edit' ? editorMode.show : undefined}
            template={editorMode.kind === 'new' ? editorMode.template : undefined}
            venueHint={event.venue_id ?? lastVenue}
            requiredLayout={event.seat_layout_id}
            category={event.category}
            onSaved={() => setMode({ kind: 'new' })}
            onCancel={() => setMode(shows[0] ? { kind: 'edit', show: shows[0] } : { kind: 'new' })}
          />
          {selected?.id && event.status === 'DRAFT' && (
            <LightButton
              type="button"
              onClick={() => {
                cancel.reset()
                setCancelId(selected.id)
              }}
            >
              Hủy suất này
            </LightButton>
          )}
        </Panel>
      </div>
      {cancelId && (
        <ConfirmDialog
          open
          title="Hủy suất diễn?"
          description="Suất này sẽ bị gỡ khỏi lịch bán vé. Sự kiện cần ít nhất một suất hợp lệ để công bố."
          label="Hủy suất diễn"
          cancelLabel="Giữ suất"
          danger
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setCancelId(undefined)}
          onConfirm={(reason) => cancel.mutate(reason)}
        />
      )}
    </WizardShell>
  )
}
