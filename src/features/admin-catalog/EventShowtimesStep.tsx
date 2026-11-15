import { useState } from 'react'
import type { EventDetail, Showtime } from '@/api/generated/model'
import { AdminAction } from '@/design/admin/AdminAction'
import { Panel, StateBadge } from '@/design/admin/AdminUi'
import { dateText } from '@/design/admin/data'
import { LightButton } from '@/design/admin/wizard'
import { vnParts, useVenueDirectory } from './catalog'
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
  const shows = activeShowtimes(event),
    venues = useVenueDirectory()
  const [mode, setMode] = useState<Mode>(() => (shows[0] ? { kind: 'edit', show: shows[0] } : { kind: 'new' }))
  const hallName = (hallId?: string) =>
    venues.data?.flatMap((v) => (v.halls ?? []).map((h) => ({ v, h }))).find((x) => x.h.id === hallId)
  const selected = mode.kind === 'edit' ? mode.show : undefined
  // Form trống mặc định chọn sẵn sân của suất gần nhất để thêm các suất cùng sân nhanh hơn.
  const lastVenue = hallName(shows.at(-1)?.hall_id)?.v.id ?? venueHint
  return (
    <WizardShell
      title="Suất diễn"
      caption={`// ${event.title?.toUpperCase()} · BƯỚC 2/4`}
      steps={stepItems(stepLabels(event), 1)}
      onSelectStep={(i) => goStep(i + 1)}
      actions={
        <>
          <LightButton back onClick={() => goStep(1)}>
            Quay lại
          </LightButton>
          <AdminAction disabled={!shows.length} onClick={() => goStep(3)}>
            Tiếp: Giá theo khu
          </AdminAction>
        </>
      }
    >
      <div className="wz-grid wz-grid-side-left" style={{ gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)' }}>
        <Panel className="wz-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2>{shows.length} suất diễn</h2>
            {selected && (
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
              where = hallName(s.hall_id)
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
                    {where ? `${where.h.name}` : 'Hall'} · mở bán{' '}
                    {open ? `${open.day}/${open.month} ${open.time}` : dateText(s.sale_opens_at)}
                  </small>
                  <span className="mt-1 inline-block">
                    <StateBadge value={selected?.id === s.id ? 'ĐANG SỬA' : s.status} />
                  </span>
                </span>
              </button>
            )
          })}
          <button type="button" className="wz-dashed" onClick={() => setMode({ kind: 'new' })}>
            + Thêm suất
          </button>
        </Panel>
        <Panel className="wz-panel">
          <ShowtimeEditor
            key={mode.kind === 'edit' ? mode.show.id : `new-${mode.template?.id ?? ''}-${shows.length}`}
            eventId={event.id!}
            initial={mode.kind === 'edit' ? mode.show : undefined}
            template={mode.kind === 'new' ? mode.template : undefined}
            venueHint={lastVenue}
            onSaved={() => setMode({ kind: 'new' })}
            onCancel={() => setMode(shows[0] ? { kind: 'edit', show: shows[0] } : { kind: 'new' })}
          />
        </Panel>
      </div>
    </WizardShell>
  )
}
