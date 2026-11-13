import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/api/config'
import type {
  EventCreateInput,
  EventInput,
  PriceTierInput,
  ShowtimeInput,
  VenueCreateInput,
  VenueInput,
  ZonePriceInput,
  BlockSeatsBody,
  UnblockSeatsBody,
} from '@/api/generated/model'
import { sanitizeSvg } from '@/seatmap/svg'
import { csvText } from '@/design/admin/data'
import {
  audit,
  events,
  findShow,
  layouts,
  makeLayout,
  mapOf,
  page,
  stamp,
  statusOverrides,
  venues,
  zonePrices,
} from './adminStore'

const root = `*${API_BASE}`
export const problem = (status = 404, code = 'NOT_FOUND') =>
  HttpResponse.json({ status, code, title: code }, { status })
const done = () => new HttpResponse(null, { status: 204 })
export const adminCatalogHandlers = [
  http.get(`${root}/admin/venues`, ({ request }) => HttpResponse.json(page(venues, new URL(request.url)))),
  http.post(`${root}/admin/venues`, async ({ request }) => {
    const d = (await request.json()) as VenueCreateInput
    const v = { ...d, id: crypto.randomUUID(), halls: [] }
    venues.unshift(v)
    return HttpResponse.json(v, { status: 201 })
  }),
  http.patch(`${root}/admin/venues/:id`, async ({ params, request }) => {
    const v = venues.find((v) => v.id === params.id)
    if (!v) return problem()
    Object.assign(v, (await request.json()) as VenueInput)
    return HttpResponse.json(v)
  }),
  http.delete(`${root}/admin/venues/:id`, ({ params }) => {
    const i = venues.findIndex((v) => v.id === params.id)
    if (i < 0) return problem()
    if (venues[i].halls?.length) return problem(409, 'VENUE_IN_USE')
    venues.splice(i, 1)
    return done()
  }),
  http.post(`${root}/admin/venues/:id/halls`, async ({ params, request }) => {
    const v = venues.find((v) => v.id === params.id)
    if (!v) return problem()
    const body = (await request.json()) as { name: string }
    const h = { id: crypto.randomUUID(), venue_id: v.id, name: body.name }
    v.halls ??= []
    v.halls.push(h)
    return HttpResponse.json(h, { status: 201 })
  }),
  http.get(`${root}/admin/halls/:id/seat-layouts`, ({ params, request }) =>
    HttpResponse.json(
      page(
        [...layouts.values()]
          .map((l) => l.overview)
          .filter((l) => l.hall_id === params.id)
          .reverse(),
        new URL(request.url),
      ),
    ),
  ),
  http.post(`${root}/admin/halls/:id/seat-layouts/import`, async ({ params, request }) => {
    const form = await request.formData(),
      file = form.get('file')
    if (!(file instanceof File) || file.size > 10 * 1024 * 1024) return problem(400, 'VALIDATION_ERROR')
    const svg = sanitizeSvg(await file.text())
    if (!svg) return problem(400, 'VALIDATION_ERROR')
    const layout = makeLayout(
      String(params.id),
      String(form.get('name') ?? ''),
      svg,
      [...layouts.values()].filter((l) => l.overview.hall_id === params.id).length + 1,
    )
    return HttpResponse.json(layout.overview, { status: 201 })
  }),
  http.get(`${root}/admin/seat-layouts/:id`, ({ params }) => {
    const l = layouts.get(String(params.id))
    return l ? HttpResponse.json(l.overview) : problem()
  }),
  http.patch(`${root}/admin/seat-layouts/:id`, async ({ params, request }) => {
    const l = layouts.get(String(params.id))
    if (!l) return problem()
    const d = (await request.json()) as { name: string }
    l.overview.name = d.name
    return HttpResponse.json(l.overview)
  }),
  http.get(`${root}/admin/seat-layouts/:id/svg`, ({ params }) => {
    const l = layouts.get(String(params.id))
    return l ? new HttpResponse(l.svg, { headers: { 'Content-Type': 'image/svg+xml' } }) : problem()
  }),
  http.get(`${root}/admin/seat-layouts/:id/zones/:zone`, ({ params }) => {
    const z = layouts.get(String(params.id))?.zones.find((z) => z.id === params.zone)
    return z ? HttpResponse.json(z) : problem()
  }),
  http.get(`${root}/admin/seat-layouts/:id/zones.csv`, ({ params }) => {
    const l = layouts.get(String(params.id))
    return l
      ? new HttpResponse(
          csvText([
            ['zone_code', 'label', 'stand_code', 'level', 'kind', 'capacity', 'svg_id'],
            ...l.zones.map((z) => [z.code, z.label, z.stand_code, z.level, z.kind, z.capacity, z.svg_id]),
          ]),
          { headers: { 'Content-Type': 'text/csv' } },
        )
      : problem()
  }),
  http.get(`${root}/admin/seat-layouts/:id/seats.csv`, ({ params }) => {
    const l = layouts.get(String(params.id))
    return l
      ? new HttpResponse(
          csvText([
            ['zone_code', 'row', 'number', 'x', 'y'],
            ...l.zones.flatMap(
              (z) => z.rows?.flatMap((r) => r.seats.map((s) => [z.code, r.row_label, s.number, s.x, s.y])) ?? [],
            ),
          ]),
          { headers: { 'Content-Type': 'text/csv' } },
        )
      : problem()
  }),
  http.post(`${root}/admin/seat-layouts/:id/publish`, ({ params }) => {
    const l = layouts.get(String(params.id))
    if (!l) return problem()
    l.overview.status = 'PUBLISHED'
    l.overview.published_at = stamp()
    return HttpResponse.json(l.overview)
  }),
  http.get(`${root}/admin/events`, ({ request }) => {
    const u = new URL(request.url),
      q = u.searchParams.get('q')?.toLowerCase(),
      status = u.searchParams.get('status')
    return HttpResponse.json(
      page(
        events
          .filter((e) => (!q || e.title?.toLowerCase().includes(q)) && (!status || e.status === status))
          .map((e) => ({ ...e, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-11-13T02:00:00Z' })),
        u,
      ),
    )
  }),
  http.post(`${root}/admin/events`, async ({ request }) => {
    const d = (await request.json()) as EventCreateInput
    const e = { ...d, id: crypto.randomUUID(), status: 'DRAFT' as const, price_tiers: [], showtimes: [] }
    events.unshift(e)
    return HttpResponse.json(e, { status: 201 })
  }),
  http.get(`${root}/admin/events/:id`, ({ params }) => {
    const e = events.find((e) => e.id === params.id)
    return e ? HttpResponse.json(e) : problem()
  }),
  http.patch(`${root}/admin/events/:id`, async ({ params, request }) => {
    const e = events.find((e) => e.id === params.id)
    if (!e) return problem()
    Object.assign(e, (await request.json()) as EventInput)
    return HttpResponse.json(e)
  }),
  http.put(`${root}/admin/events/:id/price-tiers`, async ({ params, request }) => {
    const e = events.find((e) => e.id === params.id)
    if (!e) return problem()
    const data = (await request.json()) as PriceTierInput[]
    e.price_tiers = data.map((t) => ({
      ...t,
      id: t.id ?? e.price_tiers?.find((old) => old.name === t.name)?.id ?? crypto.randomUUID(),
    }))
    return done()
  }),
  http.put(`${root}/admin/events/:id/zone-prices`, async ({ params, request }) => {
    if (!events.some((e) => e.id === params.id)) return problem()
    const d = (await request.json()) as ZonePriceInput[]
    const current = zonePrices.get(String(params.id)) ?? new Map<string, string>()
    d.forEach((z) => current.set(z.zone_id, z.price_tier_id))
    zonePrices.set(String(params.id), current)
    return done()
  }),
  http.post(`${root}/admin/events/:id/publish`, ({ params }) => {
    const e = events.find((e) => e.id === params.id)
    if (!e) return problem()
    if (!e.showtimes?.length || !e.price_tiers?.length) return problem(409, 'EVENT_NOT_READY')
    e.status = 'PUBLISHED'
    return HttpResponse.json(e)
  }),
  http.post(`${root}/admin/events/:id/cancel`, async ({ params, request }) => {
    const e = events.find((e) => e.id === params.id)
    if (!e) return problem()
    const d = (await request.json()) as { reason: string }
    const before = e.status
    e.status = 'CANCELLED'
    e.showtimes?.forEach((s) => {
      s.status = 'CANCELLED'
    })
    audit('CANCEL_EVENT', 'event', e.id!, d.reason, { status: before }, { status: e.status })
    return done()
  }),
  http.post(`${root}/admin/events/:id/showtimes`, async ({ params, request }) => {
    const e = events.find((e) => e.id === params.id)
    if (!e) return problem()
    const d = (await request.json()) as ShowtimeInput
    const s = { ...d, id: crypto.randomUUID(), event_id: e.id, status: 'SCHEDULED' as const }
    e.showtimes ??= []
    e.showtimes.push(s)
    return HttpResponse.json(s, { status: 201 })
  }),
  http.patch(`${root}/admin/showtimes/:id`, async ({ params, request }) => {
    const s = findShow(String(params.id))
    if (!s) return problem()
    Object.assign(s, (await request.json()) as ShowtimeInput)
    return HttpResponse.json(s)
  }),
  http.post(`${root}/admin/showtimes/:id/cancel`, async ({ params, request }) => {
    const s = findShow(String(params.id))
    if (!s) return problem()
    const d = (await request.json()) as { reason: string }
    const before = s.status
    s.status = 'CANCELLED'
    audit('CANCEL_SHOWTIME', 'showtime', s.id!, d.reason, { status: before }, { status: s.status })
    return done()
  }),
  http.get(`${root}/showtimes/:id/seatmap`, ({ params, request }) => {
    if (!location.pathname.startsWith('/admin')) return
    const data = mapOf(String(params.id))
    if (!data) return problem()
    const zone = new URL(request.url).searchParams.get('zone_id')
    if (zone) data.zones = data.zones?.filter((z) => z.zone_id === zone)
    return HttpResponse.json(data)
  }),
  http.post(`${root}/admin/showtimes/:id/seats/block`, async ({ params, request }) => {
    const id = String(params.id),
      data = (await request.json()) as BlockSeatsBody,
      map = mapOf(id)
    if (!map) return problem()
    const seats = map.zones?.flatMap((z) => z.seats ?? []) ?? []
    if (
      !data.seat_ids.length ||
      data.seat_ids.some((id) => seats.find((s) => s.seat_id === id)?.status !== 'AVAILABLE')
    )
      return problem(409, 'SEAT_TAKEN')
    const state = statusOverrides.get(id) ?? new Map()
    data.seat_ids.forEach((id) => state.set(id, 'BLOCKED'))
    statusOverrides.set(id, state)
    audit('BLOCK_SEATS', 'showtime', id, data.reason, { count: 0 }, { count: data.seat_ids.length })
    return done()
  }),
  http.post(`${root}/admin/showtimes/:id/seats/unblock`, async ({ params, request }) => {
    const id = String(params.id),
      data = (await request.json()) as UnblockSeatsBody,
      map = mapOf(id)
    if (!map) return problem()
    const seats = map.zones?.flatMap((z) => z.seats ?? []) ?? []
    if (!data.seat_ids.length || data.seat_ids.some((id) => seats.find((s) => s.seat_id === id)?.status !== 'BLOCKED'))
      return problem(409, 'SEAT_TAKEN')
    const state = statusOverrides.get(id) ?? new Map()
    data.seat_ids.forEach((id) => state.set(id, 'AVAILABLE'))
    statusOverrides.set(id, state)
    return done()
  }),
]
