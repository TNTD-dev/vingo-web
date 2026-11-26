import { setupServer } from 'msw/node'
import { afterAll, beforeAll, expect, it } from 'vitest'

import type { AttendeeProfile, AttendeeRequest } from '@/api/generated/model'
import { attendeeHandlers } from './attendees'

const server = setupServer(...attendeeHandlers)
const url = new URL('/api/v1/me/attendees', location.href)
const write = (method: 'POST' | 'PUT', body: AttendeeRequest, id?: string) =>
  fetch(id ? url + '/' + id : url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())

it('mock giữ danh sách qua các lần gọi, giới hạn 20 và trả 404 cho hồ sơ đã xoá', async () => {
  expect(await (await fetch(url)).json()).toEqual([])
  expect((await write('POST', { full_name: ' ' })).status).toBe(400)
  const created = await write('POST', { full_name: '  Ánh ', phone: '0901 234 567', email: 'anh@example.test' })
  expect(created.status).toBe(201)
  const profile = (await created.json()) as AttendeeProfile
  expect(profile).toMatchObject({ full_name: 'Ánh', phone: '+84901234567', email: 'anh@example.test' })
  const replacement = await write('PUT', { full_name: 'Mai' }, profile.id)
  expect(replacement.status).toBe(200)
  const saved = await replacement.json()
  expect(saved).toMatchObject({ id: profile.id, full_name: 'Mai', created_at: profile.created_at })
  expect(saved.email).toBeUndefined()
  expect(saved.phone).toBeUndefined()
  expect(await (await fetch(url + '/' + profile.id)).json()).toEqual(saved)
  for (let i = 1; i < 20; i++) expect((await write('POST', { full_name: 'Khách ' + i })).status).toBe(201)
  expect((await write('POST', { full_name: 'Khách thứ 21' })).status).toBe(409)
  const list = await (await fetch(url)).json()
  expect(list).toHaveLength(20)
  expect(list[0]).toEqual(saved)
  const detail = url + '/' + profile.id
  expect((await fetch(detail, { method: 'DELETE' })).status).toBe(204)
  expect((await fetch(detail)).status).toBe(404)
  expect((await write('PUT', { full_name: 'Mai' }, profile.id)).status).toBe(404)
  expect((await fetch(detail, { method: 'DELETE' })).status).toBe(404)
  expect((await write('POST', { full_name: 'Khách mới' })).status).toBe(201)
})
