import { describe, expect, it } from 'vitest'

import { chatReducer, initialChatState, type ChatAction, type ChatState } from '@/features/chat/chatReducer'

import { deriveTask } from './taskView'

const run = (actions: ChatAction[], from: ChatState = initialChatState) => actions.reduce(chatReducer, from)
const block = (id: string, type: string, payload: Record<string, unknown>): ChatAction => ({
  type: 'event',
  event: { type: 'chat.block', data: { message_id: 'm', block: { id, type, payload } } },
})
const confirm = (kind: string, extra: Record<string, unknown> = {}) =>
  block('c', 'ConfirmAction', {
    action_id: 'act',
    kind,
    title: 'Tiêu đề',
    rows: [{ label: 'A', value: '1' }],
    ...extra,
  })

describe('panel Việc đang làm', () => {
  it('chưa có block nào thì không có việc', () => {
    expect(deriveTask(initialChatState)).toBeUndefined()
  })

  it('báo cáo (chỉ đọc) hiện XONG, tên việc lấy từ block, nút mở màn Báo cáo', () => {
    const t = deriveTask(
      run([
        block('s', 'StatCards', { task_title: 'Báo cáo doanh thu tuần', cards: [] }),
        block('ch', 'Chart', { categories: [] }),
      ]),
    )
    expect(t).toMatchObject({ kind: 'REPORT', status: 'DONE', title: 'Báo cáo doanh thu tuần' })
    expect(t?.open.to).toBe('/admin/reports')
    expect(t?.steps.every((s) => s.status === 'done')).toBe(true)
  })

  it('đề xuất đang chờ: bước chờ duyệt đang chạy, các bước sau chưa làm', () => {
    const t = deriveTask(run([confirm('RESOLVE_REVIEW')]))
    expect(t?.status).toBe('AWAITING')
    expect(t?.steps.map((s) => s.status)).toEqual(['done', 'done', 'active', 'todo'])
  })

  it('tạo suất đang chờ hiện NHÁP; duyệt xong thì XONG và mọi bước hoàn tất', () => {
    expect(deriveTask(run([confirm('CREATE_SHOWTIME')]))?.status).toBe('DRAFT')
    const done = deriveTask(
      run([confirm('CREATE_SHOWTIME'), { type: 'actionState', actionId: 'act', state: 'confirmed' }]),
    )
    expect(done?.status).toBe('DONE')
    expect(done?.steps.every((s) => s.status === 'done')).toBe(true)
  })

  it('từ chối thì bước chờ duyệt và sau đó không chạy', () => {
    const t = deriveTask(run([confirm('BLOCK_SEATS'), { type: 'actionState', actionId: 'act', state: 'rejected' }]))
    expect(t?.status).toBe('REJECTED')
    expect(t?.steps.map((s) => s.status)).toEqual(['done', 'done', 'todo', 'todo'])
  })

  it('chỉ nhận link nội bộ /admin, chặn URL ngoài', () => {
    expect(deriveTask(run([confirm('BLOCK_SEATS', { admin_url: '/admin/showtimes/s1/seats' })]))?.open.to).toBe(
      '/admin/showtimes/s1/seats',
    )
    expect(deriveTask(run([confirm('BLOCK_SEATS', { admin_url: 'https://evil.test/admin' })]))?.open.to).toBe(
      '/admin/events',
    )
    expect(deriveTask(run([confirm('BLOCK_SEATS', { admin_url: '//evil.test' })]))?.open.to).toBe('/admin/events')
  })

  it('lấy ConfirmAction mới nhất khi có nhiều đề xuất', () => {
    const t = deriveTask(
      run([
        confirm('RESOLVE_REVIEW', { title: 'Cũ' }),
        block('c2', 'ConfirmAction', { action_id: 'act2', kind: 'RESOLVE_REVIEW', title: 'Mới' }),
      ]),
    )
    expect(t?.title).toBe('Mới')
  })
})
