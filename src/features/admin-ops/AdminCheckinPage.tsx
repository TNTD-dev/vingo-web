import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { checkIn, useListShowtimeCheckins } from '@/api/generated/endpoints/check-in/check-in'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import type { CheckinResult } from '@/api/generated/model'
import { AdminPage, Panel, Field, ErrorNotice, QueryState, Pager, Table, StateBadge } from '@/design/admin/AdminUi'
import { dateText, useCursor } from '@/design/admin/data'
import { Button } from '@/design/ui/button'
import { FormDialog } from '@/design/admin/FormDialog'
import { useEventDirectory } from '@/design/admin/data'
import cameraIcon from '@/design/admin/icons/camera.svg'
import checkIcon from '@/design/admin/icons/check-green.svg'
import CameraScanner from './CameraScanner'
const results = {
  OK: 'Hợp lệ',
  ALREADY_USED: 'Vé đã được sử dụng',
  TICKET_VOID: 'Vé đã bị vô hiệu hóa',
  WRONG_SHOWTIME: 'Vé không thuộc suất đang chọn',
}
export default function AdminCheckinPage() {
  const [eventChoice, setEventChoice] = useState(''),
    [showChoice, setShowChoice] = useState(''),
    [gate, setGate] = useState(''),
    [qr, setQr] = useState(''),
    [camera, setCamera] = useState(false),
    [settings, setSettings] = useState(false),
    [result, setResult] = useState<CheckinResult | null>(null)
  const events = useEventDirectory(),
    eventId = eventChoice || events.data?.find((e) => e.status === 'PUBLISHED')?.id || '',
    event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } }),
    showtimeId =
      showChoice ||
      event.data?.showtimes?.find((s) => !['CANCELLED', 'FINISHED', 'DRAFT'].includes(s.status ?? ''))?.id ||
      '',
    show = event.data?.showtimes?.find((s) => s.id === showtimeId),
    client = useQueryClient(),
    paging = useCursor(showtimeId)
  const history = useListShowtimeCheckins(
    showtimeId,
    { cursor: paging.cursor, limit: 10 },
    { query: { enabled: !!showtimeId, refetchInterval: 10000 } },
  )
  const count = useQueryMetric(
    { metric: 'checkins', group_by: 'none', showtime_id: showtimeId },
    { query: { enabled: !!showtimeId, refetchInterval: 10000 } },
  )
  const mutation = useMutation({
    mutationFn: (token: string) =>
      checkIn({ qr_token: token, showtime_id: showtimeId, gate: gate.trim() || undefined }),
    onSuccess: async (data) => {
      setResult(data)
      await client.invalidateQueries()
    },
    onSettled: () => setQr(''),
  })
  function submit(value: string) {
    if (!showtimeId || mutation.isPending || !value.trim()) return
    setCamera(false)
    setResult(null)
    mutation.mutate(value.trim())
  }
  const failed = history.data?.data?.filter((r) => r.result !== 'OK').length
  return (
    <AdminPage
      title={`Check-in${event.data?.title ? ` · ${event.data.title}` : ''}`}
      caption={`// SUẤT ${dateText(show?.starts_at)} · ${gate || 'CHƯA CHỌN CỔNG'}`}
      actions={
        <button
          className="admin-filter-select"
          disabled={mutation.isPending || camera}
          onClick={() => setSettings(true)}
        >
          Suất & cổng ⌄
        </button>
      }
    >
      <div className="admin-checkin-grid">
        <section className="admin-scanner">
          <div className="admin-camera-frame">
            {camera ? (
              <CameraScanner onScan={submit} />
            ) : (
              <button disabled={!showtimeId || mutation.isPending} onClick={() => setCamera(true)}>
                <img src={cameraIcon} width={56} height={56} alt="" />
                <span>{showtimeId ? 'Đưa mã QR vào khung' : 'Chọn suất diễn để soát vé'}</span>
                <small>{mutation.isPending ? 'Đang kiểm tra…' : 'Bấm để mở camera'}</small>
              </button>
            )}
          </div>
          {camera && (
            <button className="my-3 text-xs underline" onClick={() => setCamera(false)}>
              Đóng camera
            </button>
          )}
          <output
            className={`admin-scan-result ${result?.result === 'OK' ? 'is-success' : result ? 'is-error' : ''}`}
            aria-live="polite"
          >
            {result?.result === 'OK' && (
              <span className="admin-scan-check">
                <img src={checkIcon} alt="" width={18} height={18} />
              </span>
            )}
            <span>
              <span className="block font-mono text-xs">
                {result?.result ? `${results[result.result]} · ${result.ticket_code ?? ''}` : 'Sẵn sàng quét vé'}
              </span>
              <span className="mt-1 block text-sm">
                {result
                  ? `Khu ${result.zone ?? '—'}${result.row ? ` · Ghế ${result.row}-${result.number}` : ''}`
                  : 'Kết quả xác nhận sẽ hiển thị tại đây.'}
              </span>
              {result?.first_used_at && (
                <span className="mt-1 block text-xs">Đã dùng: {dateText(result.first_used_at)}</span>
              )}
            </span>
          </output>
          <ErrorNotice error={mutation.error} />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-white/60">Nhập QR từ máy đọc</summary>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit(qr)
              }}
            >
              <input
                type="password"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-white/20 p-3"
                aria-label="Nội dung QR"
                placeholder="Dán nội dung QR"
                value={qr}
                disabled={!showtimeId || mutation.isPending || camera}
                onChange={(e) => setQr(e.target.value)}
              />
              <Button
                className="bg-agent text-ink hover:bg-agent/90"
                disabled={!showtimeId || !qr.trim() || mutation.isPending || camera}
              >
                Check-in
              </Button>
            </form>
            {import.meta.env.VITE_USE_MOCK === 'true' && (
              <p className="mt-3 text-xs text-white/50">Dữ liệu demo: DEMO-OK / DEMO-VOID. Không dùng tại cổng thật.</p>
            )}
          </details>
        </section>
        <div>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <Panel className="admin-stat">
              <p className="admin-caption">Đã vào cổng</p>
              <p className="admin-stat-value">{count.data?.value?.toLocaleString('vi-VN') ?? '—'}</p>
              <p className="admin-stat-comparison">Toàn bộ suất đang chọn</p>
            </Panel>
            <Panel className="admin-stat">
              <p className="admin-caption">Lượt quét lỗi</p>
              <p className="admin-stat-value">{failed ?? '—'}</p>
              <p className="admin-stat-comparison">Trong trang lịch sử hiện tại</p>
            </Panel>
          </div>
          <Panel className="admin-table-panel">
            {showtimeId ? (
              <QueryState query={history} empty={!history.data?.data?.length}>
                <Table label="Lịch sử soát vé" headings={['Giờ', 'Vé · chỗ', 'Kết quả']}>
                  {history.data?.data?.map((r, i) => (
                    <tr key={`${r.ticket_code}-${i}`}>
                      <td className="font-mono text-[11px]">{dateText(r.scanned_at)}</td>
                      <td className="text-xs">
                        {r.ticket_code} · {r.zone} {r.row ? `${r.row}-${r.number}` : ''}
                      </td>
                      <td>
                        <StateBadge value={r.result} />
                      </td>
                    </tr>
                  ))}
                </Table>
                <Pager
                  cursor={history.data?.next_cursor}
                  previous={paging.previous}
                  next={() => paging.next(history.data!.next_cursor!)}
                  busy={history.isFetching}
                />
              </QueryState>
            ) : (
              <p className="admin-empty">Chọn suất để xem lịch sử check-in.</p>
            )}
          </Panel>
        </div>
      </div>
      {settings && (
        <FormDialog title="Chọn suất & cổng" pending={false} onClose={() => setSettings(false)}>
          <div className="space-y-4">
            <Field label="Sự kiện">
              <select
                value={eventId}
                onChange={(e) => {
                  setEventChoice(e.target.value)
                  setShowChoice('')
                  setResult(null)
                }}
              >
                {events.data
                  ?.filter((e) => e.status === 'PUBLISHED')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Suất diễn">
              <select
                value={showtimeId}
                onChange={(e) => {
                  setShowChoice(e.target.value)
                  setResult(null)
                }}
              >
                {event.data?.showtimes
                  ?.filter((s) => !['CANCELLED', 'FINISHED', 'DRAFT'].includes(s.status ?? ''))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {dateText(s.starts_at)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cổng soát vé">
              <input
                value={gate}
                maxLength={50}
                onChange={(e) => setGate(e.target.value)}
                placeholder="Ví dụ: Cổng B"
              />
            </Field>
            <ErrorNotice error={events.error || event.error} />
            <Button onClick={() => setSettings(false)} disabled={!showtimeId}>
              Sử dụng suất & cổng này
            </Button>
          </div>
        </FormDialog>
      )}
    </AdminPage>
  )
}
