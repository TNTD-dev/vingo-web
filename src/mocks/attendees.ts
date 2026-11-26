import { http, HttpResponse } from 'msw'

import { API_BASE } from '@/api/config'
import type { AttendeeProfile, AttendeeRequest } from '@/api/generated/model'
import { normalizeAttendeeDetails, validateAttendee } from '@/lib/attendeeDetails'
import { mockSignedIn, unauthorized } from './auth'

const profiles = new Map<string, AttendeeProfile>()
const path = `*${API_BASE}/me/attendees`
const missing = () => HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 })

async function save(request: Request, id?: string) {
  if (!mockSignedIn()) return unauthorized()
  const input = (await request.json()) as AttendeeRequest
  const details = normalizeAttendeeDetails({ ...input, full_name: input.full_name ?? '' })
  const errors = Object.keys(validateAttendee(details)).map((field) => ({ field }))
  if (errors.length) return HttpResponse.json({ code: 'VALIDATION_ERROR', errors }, { status: 400 })
  const existing = id ? profiles.get(id) : undefined
  if (id && !existing) return missing()
  if (!id && profiles.size >= 20) return HttpResponse.json({ code: 'ACTION_STATE_INVALID' }, { status: 409 })
  const now = new Date().toISOString()
  const profile: AttendeeProfile = {
    ...details,
    id: id ?? crypto.randomUUID(),
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
  profiles.set(profile.id, profile)
  return HttpResponse.json(profile, { status: existing ? 200 : 201 })
}

export const attendeeHandlers = [
  http.get(path, () => (mockSignedIn() ? HttpResponse.json([...profiles.values()]) : unauthorized())),
  http.post(path, ({ request }) => save(request)),
  http.get(`${path}/:id`, ({ params }) => {
    if (!mockSignedIn()) return unauthorized()
    const profile = profiles.get(String(params.id))
    return profile ? HttpResponse.json(profile) : missing()
  }),
  http.put(`${path}/:id`, ({ request, params }) => save(request, String(params.id))),
  http.delete(`${path}/:id`, ({ params }) => {
    if (!mockSignedIn()) return unauthorized()
    return profiles.delete(String(params.id)) ? new HttpResponse(null, { status: 204 }) : missing()
  }),
]
