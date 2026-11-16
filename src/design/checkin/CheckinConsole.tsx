import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, CameraOff, Check, CircleAlert, DoorOpen, ScanLine, X } from 'lucide-react'
import { useGetAdminEvent } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { useListShowtimeCheckins } from '@/api/generated/endpoints/check-in/check-in'
import { useQueryMetric } from '@/api/generated/endpoints/admin-reports/admin-reports'
import type { CheckinResult, Showtime } from '@/api/generated/model'
import { ErrorNotice, Pager, Panel, QueryState } from '@/design/admin/AdminUi'
import { useCursor, useEventDirectory } from '@/design/admin/data'
import { vnDayKey, vnTime, vnWeekdayDate } from '@/design/admin/format'
import { stateLabel } from '@/design/admin/labels'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'
import CameraScanner from './CameraScanner'
import { scanErrorText, scanHints, scanLabels, scanTicket } from './scan'

export type CheckinHeaderInfo = { title: string; caption: string; actions?: ReactNode }
type Session = { eventId: string; showtimeId: string; gate: string }

const SESSION_KEY = 'vingo.checkin.session',
  GATES_KEY = 'vingo.checkin.gates',
  DEFAULT_GATES = ['Cổng A', 'Cổng B', 'Cổng C', 'Cổng VIP']
const CLOSED = ['CANCELLED', 'FINISHED', 'DRAFT']

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Không lưu được: chỉ mất ghi nhớ ca soát vé khi tải lại trang.
  }
}
const seatText = (r: Pick<CheckinResult, 'zone' | 'row' | 'number'>) =>
  [r.zone && `Khu ${r.zone}`, r.row && `Hàng ${r.row}`, r.number != null && `Ghế ${r.number}`]
    .filter(Boolean)
    .join(' · ') || 'Vé đứng'
const showText = (s?: Showtime) => (s?.starts_at ? `${vnWeekdayDate(s.starts_at)} · ${vnTime(s.starts_at)}` : '—')

/**
 * Màn soát vé dùng chung cho /admin/checkin và /checkin. Hai bước: chọn sự kiện → suất → cổng ngay trên trang,
 * rồi vào chế độ soát vé. Ca soát vé (suất + cổng) được nhớ theo trình duyệt để tải lại trang không phải chọn lại.
 */
export function CheckinConsole({ header }: { header: (info: CheckinHeaderInfo) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => read<Session | null>(SESSION_KEY, null)),
    [editing, setEditing] = useState(() => !read<Session | null>(SESSION_KEY, null))
  return editing || !session ? (
    <>
      {header({ title: 'Check-in', caption: '// BÁN VÉ · BẮT ĐẦU CA SOÁT VÉ' })}
      <CheckinSetup
        initial={session}
        onCancel={session ? () => setEditing(false) : undefined}
        onStart={(next) => {
          write(SESSION_KEY, next)
          if (next.gate)
            write(GATES_KEY, [next.gate, ...read<string[]>(GATES_KEY, []).filter((g) => g !== next.gate)].slice(0, 6))
          setSession(next)
          setEditing(false)
        }}
      />
    </>
  ) : (
    <CheckinStation key={session.showtimeId} session={session} header={header} onChange={() => setEditing(true)} />
  )
}

function CheckinSetup({
  initial,
  onStart,
  onCancel,
}: {
  initial: Session | null
  onStart: (s: Session) => void
  onCancel?: () => void
}) {
  const events = useEventDirectory(),
    published = events.data?.filter((e) => e.status === 'PUBLISHED') ?? []
  const [eventChoice, setEventChoice] = useState(initial?.eventId ?? ''),
    eventId = eventChoice || published[0]?.id || ''
  const event = useGetAdminEvent(eventId, { query: { enabled: !!eventId } })
  const shows = (event.data?.showtimes ?? [])
    .filter((s) => !CLOSED.includes(s.status ?? ''))
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
  const [showChoice, setShowChoice] = useState(initial?.showtimeId ?? '')
  const showtimeId = shows.some((s) => s.id === showChoice) ? showChoice : (shows[0]?.id ?? '')
  const recent = read<string[]>(GATES_KEY, [])
  const gates = [...new Set([...recent, ...DEFAULT_GATES])].slice(0, 6)
  const [gate, setGate] = useState(initial?.gate ?? recent[0] ?? ''),
    [custom, setCustom] = useState(!!gate && !gates.includes(gate))
  const today = vnDayKey(new Date().toISOString())
  return (
    <Panel className="admin-checkin-setup">
      <ol className="admin-checkin-steps">
        <li>
          <h2>
            <span className="wz-step-dot" data-state={eventId ? 'done' : 'active'}>
              1
            </span>
            Sự kiện
          </h2>
          <label className="admin-field">
            <span className="sr-only">Sự kiện</span>
            <select
              value={eventId}
              onChange={(e) => {
                setEventChoice(e.target.value)
                setShowChoice('')
              }}
            >
              {!published.length && (
                <option value="">{events.isPending ? 'Đang tải…' : 'Chưa có sự kiện đang bán'}</option>
              )}
              {published.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
        </li>
        <li>
          <h2>
            <span className="wz-step-dot" data-state={showtimeId ? 'done' : 'active'}>
              2
            </span>
            Suất diễn
          </h2>
          {event.isPending && eventId ? (
            <p className="admin-checkin-muted">Đang tải suất diễn…</p>
          ) : !shows.length ? (
            <p className="admin-checkin-muted">Sự kiện này không còn suất nào để soát vé.</p>
          ) : (
            <div className="admin-checkin-shows" role="radiogroup" aria-label="Suất diễn">
              {shows.map((s) => {
                const isToday = !!s.starts_at && vnDayKey(s.starts_at) === today
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={s.id === showtimeId}
                    className="admin-checkin-show"
                    onClick={() => setShowChoice(s.id!)}
                  >
                    <strong>{s.starts_at ? vnTime(s.starts_at) : '—'}</strong>
                    <span>{s.starts_at ? vnWeekdayDate(s.starts_at) : ''}</span>
                    <small>{isToday ? 'Hôm nay' : stateLabel(s.status)}</small>
                  </button>
                )
              })}
            </div>
          )}
        </li>
        <li>
          <h2>
            <span className="wz-step-dot" data-state={gate ? 'done' : 'active'}>
              3
            </span>
            Cổng soát vé
            <small>Ghi vào lịch sử quét để biết vé vào ở cổng nào</small>
          </h2>
          <div className="admin-chips" role="radiogroup" aria-label="Cổng soát vé">
            {gates.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={!custom && gate === g}
                onClick={() => {
                  setCustom(false)
                  setGate(g)
                }}
              >
                {g}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              onClick={() => {
                setCustom(true)
                setGate('')
              }}
            >
              Cổng khác…
            </button>
          </div>
          {custom && (
            <label className="admin-field mt-3">
              <span className="sr-only">Tên cổng</span>
              <input
                autoFocus
                maxLength={50}
                value={gate}
                placeholder="Ví dụ: Cổng số 3"
                onChange={(e) => setGate(e.target.value)}
              />
            </label>
          )}
        </li>
      </ol>
      <ErrorNotice error={events.error || event.error} />
      <div className="admin-checkin-setup-foot">
        {onCancel && (
          <Button type="button" variant="outline" className="wz-light" onClick={onCancel}>
            Quay lại soát vé
          </Button>
        )}
        <Button
          type="button"
          className="admin-checkin-start"
          disabled={!showtimeId || !gate.trim()}
          onClick={() => onStart({ eventId, showtimeId, gate: gate.trim() })}
        >
          <ScanLine size={18} aria-hidden />
          Bắt đầu soát vé
        </Button>
      </div>
    </Panel>
  )
}

function CheckinStation({
  session,
  header,
  onChange,
}: {
  session: Session
  header: (info: CheckinHeaderInfo) => ReactNode
  onChange: () => void
}) {
  const { eventId, showtimeId, gate } = session
  const event = useGetAdminEvent(eventId),
    show = event.data?.showtimes?.find((s) => s.id === showtimeId),
    client = useQueryClient(),
    paging = useCursor(showtimeId)
  const [qr, setQr] = useState(''),
    [camera, setCamera] = useState(false),
    [result, setResult] = useState<(CheckinResult & { at: Date }) | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const history = useListShowtimeCheckins(
    showtimeId,
    { cursor: paging.cursor, limit: 10 },
    { query: { refetchInterval: 10000 } },
  )
  const entered = useQueryMetric(
    { metric: 'checkins', group_by: 'none', showtime_id: showtimeId },
    { query: { refetchInterval: 10000 } },
  )
  const sold = useQueryMetric({ metric: 'tickets_sold', group_by: 'none', showtime_id: showtimeId })
  const mutation = useMutation({
    mutationFn: (token: string) => scanTicket({ qr_token: token, showtime_id: showtimeId, gate: gate || undefined }),
    onSuccess: (data) => setResult({ ...data, at: new Date() }),
    onError: () => setResult(null),
    // Quét nào (kể cả bị từ chối hay lỗi 404) cũng làm mới lịch sử và số đếm.
    onSettled: () => {
      setQr('')
      void client.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && /^\/admin\/(showtimes|reports)/.test(q.queryKey[0]),
      })
      if (!camera) setTimeout(() => input.current?.focus(), 0)
    },
  })
  useEffect(() => {
    if (!camera) input.current?.focus()
  }, [camera])
  function submit(value: string) {
    if (mutation.isPending || !value.trim()) return
    mutation.mutate(value.trim())
  }
  const ok = result?.result === 'OK',
    tone = mutation.error ? 'error' : result ? (ok ? 'ok' : 'error') : 'idle'
  const done = entered.data?.value ?? 0,
    total = sold.data?.value ?? 0
  const rows = history.data?.data ?? []
  return (
    <>
      {header({
        title: 'Check-in',
        caption: '// BÁN VÉ · SOÁT VÉ TẠI CỔNG',
        actions: (
          <Button type="button" variant="outline" className="wz-light" onClick={onChange}>
            Đổi suất / cổng
          </Button>
        ),
      })}
      <div className="admin-checkin-context" aria-label="Ca soát vé hiện tại">
        <div>
          <small>Sự kiện</small>
          <strong title={event.data?.title}>{event.data?.title ?? '…'}</strong>
        </div>
        <div>
          <small>Suất</small>
          <strong>{showText(show)}</strong>
        </div>
        <div>
          <small>Cổng</small>
          <strong className="admin-checkin-gate">
            <DoorOpen size={16} aria-hidden />
            {gate}
          </strong>
        </div>
        {show && CLOSED.includes(show.status ?? '') && (
          <p className="admin-checkin-warn">
            <CircleAlert size={16} aria-hidden />
            Suất này đã {stateLabel(show.status).toLowerCase()}. Đổi suất để soát vé.
          </p>
        )}
      </div>
      <div className="admin-checkin-grid">
        <section className="admin-scanner" aria-label="Quét vé">
          <output className="admin-scan-result" data-tone={tone} aria-live="assertive">
            <span className="admin-scan-icon" aria-hidden>
              {tone === 'ok' ? <Check size={28} /> : tone === 'error' ? <X size={28} /> : <ScanLine size={26} />}
            </span>
            <span className="admin-scan-text">
              {mutation.error ? (
                <strong>{scanErrorText(mutation.error)}</strong>
              ) : result?.result ? (
                <>
                  <strong>{scanLabels[result.result]}</strong>
                  <span>{scanHints[result.result]}</span>
                  <small>
                    {result.ticket_code} · {seatText(result)}
                    {result.first_used_at ? ` · Đã quét lúc ${vnTime(result.first_used_at)}` : ''}
                  </small>
                </>
              ) : (
                <>
                  <strong>{mutation.isPending ? 'Đang kiểm tra vé…' : 'Sẵn sàng quét vé'}</strong>
                  <span>Quét bằng máy đọc QR, camera, hoặc dán mã bên dưới.</span>
                </>
              )}
            </span>
            {result && <time className="admin-scan-time">{vnTime(result.at.toISOString())}</time>}
          </output>
          <div className="admin-camera-frame" data-active={camera || undefined}>
            {camera ? (
              <CameraScanner onScan={submit} />
            ) : (
              <button type="button" onClick={() => setCamera(true)}>
                <Camera size={36} aria-hidden />
                <span>Mở camera để quét QR</span>
                <small>Hoặc dùng máy đọc QR cầm tay — mã sẽ tự điền vào ô bên dưới</small>
              </button>
            )}
          </div>
          {camera && (
            <button type="button" className="admin-camera-close" onClick={() => setCamera(false)}>
              <CameraOff size={16} aria-hidden />
              Tắt camera
            </button>
          )}
          <form
            className="admin-scan-form"
            onSubmit={(e) => {
              e.preventDefault()
              submit(qr)
            }}
          >
            <label htmlFor="checkin-qr" className="sr-only">
              Mã QR trên vé
            </label>
            <input
              id="checkin-qr"
              ref={input}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Quét hoặc dán mã QR rồi nhấn Enter"
              value={qr}
              disabled={mutation.isPending}
              onChange={(e) => setQr(e.target.value)}
            />
            <Button disabled={!qr.trim() || mutation.isPending}>Kiểm tra</Button>
          </form>
          {import.meta.env.VITE_USE_MOCK === 'true' && (
            <p className="admin-scan-demo">Dữ liệu demo: DEMO-OK / DEMO-VOID. Không dùng tại cổng thật.</p>
          )}
        </section>
        <div className="admin-checkin-side">
          <Panel className="admin-checkin-progress">
            <p className="admin-caption">Đã vào cổng · cả suất</p>
            <p className="admin-checkin-count">
              <strong>{entered.data ? done.toLocaleString('vi-VN') : '—'}</strong>
              {total > 0 && <span>/ {total.toLocaleString('vi-VN')} vé đã bán</span>}
            </p>
            {total > 0 && (
              <div className="admin-checkin-bar" aria-hidden>
                <i style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
              </div>
            )}
            <p className="admin-checkin-muted">
              {total > 0
                ? `Còn ${Math.max(0, total - done).toLocaleString('vi-VN')} vé chưa vào`
                : 'Tự cập nhật mỗi 10 giây'}
            </p>
          </Panel>
          <Panel className="admin-checkin-history">
            <div className="admin-panel-head">
              <h2>Lượt quét gần đây</h2>
              <span className="admin-checkin-muted">Tự cập nhật</span>
            </div>
            <QueryState query={history}>
              {!rows.length ? (
                <p className="admin-checkin-empty">
                  <ScanLine size={22} aria-hidden />
                  Chưa có lượt quét nào cho suất này.
                </p>
              ) : (
                <ul className="admin-scan-list">
                  {rows.map((r, i) => (
                    <li key={`${r.ticket_code}-${r.scanned_at}-${i}`} data-ok={r.result === 'OK' || undefined}>
                      <span className="admin-scan-list-icon" aria-hidden>
                        {r.result === 'OK' ? <Check size={14} /> : <X size={14} />}
                      </span>
                      <span className="admin-scan-list-main">
                        <strong>{r.ticket_code}</strong>
                        <small>{seatText(r)}</small>
                      </span>
                      <span className={cn('admin-scan-list-result', r.result !== 'OK' && 'is-bad')}>
                        {stateLabel(r.result)}
                      </span>
                      <time>{r.scanned_at ? vnTime(r.scanned_at) : ''}</time>
                    </li>
                  ))}
                </ul>
              )}
              <Pager
                cursor={history.data?.next_cursor}
                previous={paging.previous}
                next={() => paging.next(history.data!.next_cursor!)}
                busy={history.isFetching}
              />
            </QueryState>
          </Panel>
        </div>
      </div>
    </>
  )
}
