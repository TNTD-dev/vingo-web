import { http, HttpResponse } from 'msw'
import { API_BASE } from '@/api/config'
import type {
  VenueImportCreate,
  VenueImportPatch,
  VenueImportSession,
  VenueImportPreview,
  VenueImportIssue,
} from '@/api/generated/model'
import { sanitizeSvg } from '@/seatmap/svg'
import { layouts, makeLayout, venues } from './adminStore'
import { problem } from './adminCatalog'

const root = `*${API_BASE}/admin/venue-imports`
const storageKey = 'vingo-mock-venue-imports-v2'
function restoreSessions(): VenueImportSession[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as VenueImportSession[]
  } catch {
    return []
  }
}
const sessions = new Map<string, VenueImportSession>(restoreSessions().map((s) => [s.id!, s]))
function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...sessions.values()]))
  } catch {
    /* Nháp mock vượt quota trình duyệt; backend thật không dùng storage này. */
  }
}
const hashes = new Map<string, string>()
function conflict(session: VenueImportSession, revision: number) {
  return session.status !== 'DRAFT' || session.revision !== revision
}
function touch(session: VenueImportSession) {
  session.revision = (session.revision ?? 0) + 3
  session.expires_at = new Date(Date.now() + 30 * 86400000).toISOString()
  persist()
  return HttpResponse.json(session)
}

function preview(session: VenueImportSession): VenueImportPreview {
  const files = session.files ?? []
  const issues: VenueImportIssue[] = files.flatMap((f) => f.issues ?? [])
  const overview = files.find((f) => f.role === 'OVERVIEW')
  const details = files.filter((f) => f.role === 'SEAT_LAYOUT')
  if (!overview || !details.length)
    issues.push({ reason: 'MISSING_LAYER', message: 'Cần đúng một SVG nền và ít nhất một SVG chi tiết.' })
  if (files.filter((f) => f.role === 'OVERVIEW').length > 1)
    issues.push({ reason: 'MULTIPLE_OVERVIEWS', message: 'Chỉ dùng một SVG nền.' })
  const parser = new DOMParser()
  const base = parser.parseFromString(overview?.sanitized_svg ?? '<svg/>', 'image/svg+xml')
  const detail = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml')
  detail.documentElement.setAttribute('viewBox', base.documentElement.getAttribute('viewBox') ?? '0 0 100 100')
  const codes = new Set<string>()
  for (const file of details) {
    const doc = parser.parseFromString(file.sanitized_svg ?? '<svg/>', 'image/svg+xml')
    if (doc.documentElement.getAttribute('viewBox') !== base.documentElement.getAttribute('viewBox'))
      issues.push({ reason: 'VIEWBOX_MISMATCH', message: 'Các tệp phải dùng cùng viewBox.' })
    for (const node of Array.from(doc.querySelectorAll('[id^="ZONE__"], [id^="SEAT__"]'))) {
      if (codes.has(node.id)) issues.push({ reason: 'DUPLICATE_CODE', message: `Trùng mã ${node.id}` })
      codes.add(node.id)
    }
    for (const node of Array.from(doc.documentElement.children))
      detail.documentElement.appendChild(detail.importNode(node, true))
  }
  const areas = Array.from(base.querySelectorAll('[id^="AREA__"]')).map((el) => ({
    code: el.id.split('__')[1],
    svg_id: el.id,
    name: el.id.split('__')[1],
  }))
  const gates = Array.from(base.querySelectorAll('[id^="GATE__"]')).map((el) => ({
    code: el.id.split('__')[1],
    name: el.id.split('__')[1],
    svg_id: el.id,
    direction: 'BOTH' as const,
  }))
  if (overview && !gates.length) issues.push({ reason: 'MISSING_GATE', message: 'SVG nền cần ít nhất một cổng.' })
  const zones = Array.from(detail.querySelectorAll('[id^="ZONE__"]')).map((el) => {
    const [, code, kind, capacity] = el.id.split('__')
    const seats = detail.querySelectorAll(`[id^="SEAT__${code}__"]`).length
    return {
      code,
      label: code,
      kind: kind === 'STANDING' ? ('STANDING' as const) : ('SEATED' as const),
      capacity: kind === 'STANDING' ? Number(capacity) : seats,
      seat_count: seats,
      svg_id: el.id,
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    }
  })
  const zone_areas = { ...session.draft_data?.zone_areas }
  for (const z of zones) {
    if (areas.length === 1 && !zone_areas[z.code]) zone_areas[z.code] = areas[0].code
    if (areas.length && !areas.some((a) => a.code === zone_areas[z.code]))
      issues.push({ reason: 'MAPPING_REQUIRED', message: `Chọn vùng nền cho ${z.code}`, zone_id: z.code })
  }
  return {
    session_id: session.id,
    revision: session.revision,
    valid: !issues.length,
    issues,
    overview_svg: overview?.sanitized_svg,
    detail_svg: new XMLSerializer().serializeToString(detail),
    gates,
    areas,
    zones,
    zone_areas,
  }
}

/** Mock kiểm tra luồng/revision; kiểm tra collision hình học do backend thực hiện. */
export const venueImportHandlers = [
  http.get(root, () =>
    HttpResponse.json({ data: [...sessions.values()].filter((s) => s.status === 'DRAFT'), next_cursor: null }),
  ),
  http.post(root, async ({ request }) => {
    const body = (await request.json()) as VenueImportCreate
    const s: VenueImportSession = {
      id: crypto.randomUUID(),
      target_venue_id: body.target_venue_id,
      status: 'DRAFT',
      step: 'OVERVIEW',
      revision: 0,
      files: [],
      draft_data: {
        overview_name: 'Nền sân',
        layout_name: '',
        layout_type: 'FOOTBALL',
        zone_areas: {},
        venue: { name: '', address: '', city: 'HN' },
      },
    }
    sessions.set(s.id!, s)
    return touch(s)
  }),
  http.get(`${root}/:id`, ({ params }) => {
    const s = sessions.get(String(params.id))
    return s ? HttpResponse.json(s) : problem()
  }),
  http.patch(`${root}/:id`, async ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    const body = (await request.json()) as VenueImportPatch
    if (conflict(s, body.revision)) return problem(409, 'ACTION_STATE_INVALID')
    s.draft_data = body.draft_data ?? s.draft_data
    s.step = body.step ?? s.step
    return touch(s)
  }),
  http.post(`${root}/:id/files`, async ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    const form = await request.formData()
    if (conflict(s, Number(form.get('revision')))) return problem(409, 'ACTION_STATE_INVALID')
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (
      files.length > 32 ||
      files.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024 ||
      (s.files?.length ?? 0) + files.length > 32
    )
      return problem(413, 'PAYLOAD_TOO_LARGE')
    for (const f of files) {
      const text = await f.text()
      if ([...hashes].some(([id, source]) => s.files?.some((item) => item.id === id) && source === text)) continue
      const clean = sanitizeSvg(text)
      const doc = new DOMParser().parseFromString(clean ?? '<svg/>', 'image/svg+xml')
      const hasZone = !!doc.querySelector('[id^="ZONE__"]'),
        hasGate = !!doc.querySelector('[id^="GATE__"]')
      const role = hasZone && hasGate ? 'COMBINED_V1' : hasZone ? 'SEAT_LAYOUT' : hasGate ? 'OVERVIEW' : 'UNKNOWN'
      const valid = !!clean && (role === 'OVERVIEW' || role === 'SEAT_LAYOUT')
      const id = crypto.randomUUID()
      hashes.set(id, text)
      s.files ??= []
      s.files.push({
        id,
        original_filename: f.name,
        role,
        size_bytes: f.size,
        validation_status: valid ? 'VALIDATED' : 'INVALID',
        sanitized_svg: clean,
        issues: valid
          ? []
          : [
              {
                reason: role === 'COMBINED_V1' ? 'COMBINED_REQUIRES_SPLIT' : 'INVALID_SVG',
                message: 'Xuất riêng tệp nền và tệp zone/ghế theo quy ước SVG v2.',
              },
            ],
      })
    }
    return touch(s)
  }),
  http.delete(`${root}/:id/files/:file`, ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    if (conflict(s, Number(new URL(request.url).searchParams.get('revision'))))
      return problem(409, 'ACTION_STATE_INVALID')
    s.files = s.files?.filter((f) => f.id !== params.file)
    return touch(s)
  }),
  http.post(`${root}/:id/preview`, async ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    const { revision } = (await request.json()) as { revision: number }
    return conflict(s, revision) ? problem(409, 'ACTION_STATE_INVALID') : HttpResponse.json(preview(s))
  }),
  http.post(`${root}/:id/complete`, async ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    if (s.result) return HttpResponse.json(s.result)
    const { revision } = (await request.json()) as { revision: number }
    if (conflict(s, revision)) return problem(409, 'ACTION_STATE_INVALID')
    const p = preview(s),
      d = s.draft_data
    if (!p.valid) return problem(422, 'INVALID_SEAT_LAYOUT')
    if (!d?.layout_name || (!s.target_venue_id && (!d.venue?.name || !d.venue.address)))
      return problem(400, 'VALIDATION_ERROR')
    const venueId = s.target_venue_id ?? crypto.randomUUID()
    if (!s.target_venue_id) venues.push({ ...d.venue, id: venueId })
    const l = makeLayout(
      venueId,
      d.layout_name,
      p.detail_svg!,
      [...layouts.values()].filter((l) => l.overview.venue_id === venueId).length + 1,
    )
    l.overview.layout_type = d.layout_type
    l.overview.overview_id = crypto.randomUUID()
    s.result = { venue_id: venueId, overview_id: l.overview.overview_id, layout_id: l.overview.id! }
    s.status = 'COMPLETED'
    persist()
    return HttpResponse.json(s.result)
  }),
  http.post(`${root}/:id/cancel`, async ({ params, request }) => {
    const s = sessions.get(String(params.id))
    if (!s) return problem()
    const { revision } = (await request.json()) as { revision: number }
    if (s.status === 'CANCELLED') return HttpResponse.json(s)
    if (conflict(s, revision)) return problem(409, 'ACTION_STATE_INVALID')
    s.status = 'CANCELLED'
    return touch(s)
  }),
  http.get(`*${API_BASE}/admin/venue-overviews/:id`, ({ params }) => {
    const s = [...sessions.values()].find((s) => s.result?.overview_id === params.id)
    if (!s) return problem()
    const p = preview(s)
    return HttpResponse.json({
      id: params.id,
      venue_id: s.result?.venue_id,
      name: s.draft_data?.overview_name,
      version: 1,
      status: 'PUBLISHED',
      svg_content: p.overview_svg,
      gates: p.gates,
      areas: p.areas,
    })
  }),
]
