import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/api/config'
import type { CheckInBody, CheckinResult, MetricResult, ResolveReviewBody } from '@/api/generated/model'
import { audit, audits, findShow, orders, page, stamp, tickets } from './adminStore'
import { problem } from './adminCatalog'

const root = `*${API_BASE}`,
  done = () => new HttpResponse(null, { status: 204 })
const attempts = new Map<string, { fingerprint: string; response: (typeof orders)[number] }>()
const checkins = new Map<string, CheckinResult[]>()
export const adminOperationsHandlers = [
  http.get(`${root}/admin/orders`, ({ request }) => {
    const u = new URL(request.url),
      s = u.searchParams.get('status'),
      q = u.searchParams.get('q')?.trim().toLowerCase(),
      e = u.searchParams.get('event_id'),
      show = u.searchParams.get('showtime_id')
    return HttpResponse.json(
      page(
        orders.filter(
          (o) =>
            (!s || o.status === s) &&
            (!e || o.event?.id === e) &&
            (!show || o.showtime?.id === show) &&
            (!q || [o.code, o.buyer?.email, o.buyer?.phone].some((v) => v?.toLowerCase() === q)),
        ),
        u,
      ),
    )
  }),
  http.get(`${root}/admin/orders/:id`, ({ params }) => {
    const o = orders.find((o) => o.id === params.id)
    return o ? HttpResponse.json(o) : problem()
  }),
  http.post(`${root}/admin/orders/:id/resolve-review`, async ({ params, request }) => {
    const key = request.headers.get('Idempotency-Key')
    if (!key) return problem(400, 'VALIDATION_ERROR')
    const body = (await request.json()) as ResolveReviewBody,
      fingerprint = JSON.stringify([params.id, body]),
      previous = attempts.get(key)
    if (previous)
      return previous.fingerprint === fingerprint
        ? HttpResponse.json(previous.response)
        : problem(409, 'IDEMPOTENCY_CONFLICT')
    const o = orders.find((o) => o.id === params.id)
    if (!o) return problem()
    if (o.status !== 'NEEDS_REVIEW') return problem(409, 'ORDER_STATE_INVALID')
    const before = o.status
    o.status = body.action === 'ISSUE_TICKETS' ? 'PAID' : 'REFUNDED'
    o.history?.push({ status: o.status, at: stamp() })
    if (body.action === 'ISSUE_TICKETS')
      tickets.unshift({
        id: crypto.randomUUID(),
        code: `VT-${String(tickets.length + 1).padStart(6, '0')}`,
        order_code: o.code,
        event: o.event,
        showtime: o.showtime,
        status: 'ISSUED',
        zone: o.items?.[0]?.zone,
        row: o.items?.[0]?.row,
        number: o.items?.[0]?.number,
        tier: o.items?.[0]?.tier,
      })
    audit('RESOLVE_REVIEW', 'order', o.id!, body.reason, { status: before }, { status: o.status })
    attempts.set(key, { fingerprint, response: structuredClone(o) })
    return HttpResponse.json(o)
  }),
  http.post(`${root}/admin/orders/:id/reconcile`, ({ params }) => {
    const o = orders.find((o) => o.id === params.id)
    return o?.payments?.[0] ? HttpResponse.json(o.payments[0]) : problem()
  }),
  http.get(`${root}/admin/tickets`, ({ request }) => {
    const u = new URL(request.url),
      s = u.searchParams.get('status'),
      code = u.searchParams.get('code'),
      order = u.searchParams.get('order_id'),
      show = u.searchParams.get('showtime_id')
    return HttpResponse.json(
      page(
        tickets.filter(
          (t) =>
            (!s || t.status === s) &&
            (!code || t.code?.toLowerCase() === code.toLowerCase()) &&
            (!order || t.order_code === orders.find((o) => o.id === order)?.code) &&
            (!show || t.showtime?.id === show),
        ),
        u,
      ),
    )
  }),
  http.post(`${root}/admin/tickets/:id/void`, async ({ params, request }) => {
    const t = tickets.find((t) => t.id === params.id)
    if (!t) return problem()
    if (t.status !== 'ISSUED') return problem(409, 'TICKET_STATE_INVALID')
    const d = (await request.json()) as { reason: string }
    t.status = 'VOID'
    audit('VOID_TICKET', 'ticket', t.id!, d.reason, { status: 'ISSUED' }, { status: 'VOID' })
    return HttpResponse.json(t)
  }),
  http.post(`${root}/admin/tickets/:id/reissue-qr`, async ({ params, request }) => {
    const t = tickets.find((t) => t.id === params.id)
    if (!t) return problem()
    if (t.status !== 'ISSUED') return problem(409, 'TICKET_STATE_INVALID')
    const d = (await request.json()) as { reason: string }
    audit('REISSUE_QR', 'ticket', t.id!, d.reason)
    return HttpResponse.json(t)
  }),
  http.post(`${root}/admin/tickets/:id/resend`, ({ params }) => {
    const t = tickets.find((t) => t.id === params.id)
    if (!t) return problem()
    if (t.status !== 'ISSUED') return problem(409, 'TICKET_STATE_INVALID')
    audit('RESEND_TICKET', 'ticket', t.id!, 'Gửi lại email vé')
    return done()
  }),
  http.get(`${root}/admin/audit-logs`, ({ request }) => {
    const u = new URL(request.url),
      entity = u.searchParams.get('entity'),
      id = u.searchParams.get('entity_id')
    return HttpResponse.json(
      page(
        audits.filter((a) => (!entity || a.entity === entity) && (!id || a.entity_id === id)),
        u,
      ),
    )
  }),
  http.get(`${root}/admin/reports/metrics`, ({ request }) => {
    const u = new URL(request.url),
      metric = u.searchParams.get('metric') ?? 'revenue',
      group = u.searchParams.get('group_by') ?? 'none',
      event = u.searchParams.get('event_id'),
      show = u.searchParams.get('showtime_id'),
      from = Date.parse(u.searchParams.get('from') ?? ''),
      to = Date.parse(u.searchParams.get('to') ?? '')
    const paid = orders.filter(
      (o) =>
        o.status === 'PAID' &&
        (!event || o.event?.id === event) &&
        (!show || o.showtime?.id === show) &&
        (!Number.isFinite(from) || Date.parse(o.created_at!) >= from) &&
        (!Number.isFinite(to) || Date.parse(o.created_at!) < to),
    )
    const value =
      metric === 'revenue'
        ? paid.reduce((n, o) => n + (o.total_amount ?? 0), 0)
        : metric === 'tickets_sold'
          ? paid.length
          : metric === 'fill_rate'
            ? 68.4
            : [...checkins.values()].flat().filter((c) => c.result === 'OK').length
    let series: MetricResult['series'] = []
    if (group === 'day' || group === 'hour') {
      const length = group === 'hour' ? 24 : Math.min(31, Math.max(1, Math.ceil((to - from) / 86400000) || 14))
      series = Array.from({ length }, (_, i) => ({
        key: new Date(
          (Number.isFinite(from) ? from : Date.now() - length * 86400000) + i * (group === 'hour' ? 3600000 : 86400000),
        )
          .toISOString()
          .slice(0, group === 'hour' ? 24 : 10),
        value:
          metric === 'fill_rate'
            ? Math.round((55 + (i % 8) * 4) * 10) / 10
            : Math.round((value / length) * (0.5 + (i % 5) * 0.25)),
      }))
    } else if (group === 'zone' || group === 'tier') {
      series = (
        group === 'zone' ? ['A1-T1', 'A2L-T1', 'A2R-T1', 'B1-T1', 'C1-T1'] : ['Hạng 1', 'Hạng 2', 'Hạng 3', 'Khu đứng']
      ).map((key, i) => ({
        key,
        value: metric === 'fill_rate' ? [86, 72, 64, 58, 42][i] : Math.round(value / (i + 2)),
      }))
    }
    return HttpResponse.json<MetricResult>({
      metric,
      value,
      unit:
        metric === 'revenue'
          ? 'VND'
          : metric === 'fill_rate'
            ? 'percent'
            : metric === 'checkins'
              ? 'checkins'
              : 'tickets',
      computed_at: stamp(),
      series,
      definition: 'Dữ liệu minh họa trong phiên xem thử. Báo cáo thật được tính bởi hệ thống khi kết nối backend.',
    })
  }),
  http.post(`${root}/checkins`, async ({ request }) => {
    if (!location.pathname.startsWith('/admin')) return
    const d = (await request.json()) as CheckInBody
    if (!findShow(d.showtime_id)) return problem()
    if (!['DEMO-OK', 'DEMO-VOID', 'DEMO-WRONG'].includes(d.qr_token)) return problem(404, 'NOT_FOUND')
    const history = checkins.get(d.showtime_id) ?? [],
      previous = history.find((r) => r.result === 'OK')
    const result: CheckinResult = {
      result:
        d.qr_token === 'DEMO-VOID'
          ? 'TICKET_VOID'
          : d.qr_token === 'DEMO-WRONG'
            ? 'WRONG_SHOWTIME'
            : previous
              ? 'ALREADY_USED'
              : 'OK',
      ticket_code: 'VT-DEMO-001',
      zone: 'A1-T1',
      row: 'A',
      number: 1,
      scanned_at: stamp(),
      first_used_at: previous?.scanned_at,
    }
    history.unshift(result)
    checkins.set(d.showtime_id, history)
    return HttpResponse.json(result)
  }),
  http.get(`${root}/admin/showtimes/:id/checkins`, ({ params, request }) =>
    HttpResponse.json(page(checkins.get(String(params.id)) ?? [], new URL(request.url))),
  ),
]
