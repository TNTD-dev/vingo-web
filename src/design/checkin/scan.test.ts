import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/problem'

const checkIn = vi.fn()
vi.mock('@/api/generated/endpoints/check-in/check-in', () => ({ checkIn: (...a: unknown[]) => checkIn(...a) }))

import { resultFromConflict, scanErrorText, scanTicket } from './scan'

const request = { qr_token: 'abc', showtime_id: 's1' }
const conflict = (body: unknown) => new ApiError(409, body as never)

describe('scanTicket', () => {
  it('trả kết quả khi quét hợp lệ', async () => {
    checkIn.mockResolvedValueOnce({ result: 'OK', ticket_code: 'T1' })
    expect(await scanTicket(request)).toEqual({ result: 'OK', ticket_code: 'T1' })
  })

  it('coi 409 mang CheckinResult là kết quả từ chối, không ném lỗi', async () => {
    checkIn.mockRejectedValueOnce(conflict({ result: 'ALREADY_USED', ticket_code: 'T1' }))
    expect((await scanTicket(request)).result).toBe('ALREADY_USED')
  })

  it('ném tiếp lỗi 404 và 409 không có result', async () => {
    checkIn.mockRejectedValueOnce(new ApiError(404, null))
    await expect(scanTicket(request)).rejects.toBeInstanceOf(ApiError)
    checkIn.mockRejectedValueOnce(conflict({ title: 'x' }))
    await expect(scanTicket(request)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('resultFromConflict', () => {
  it('bỏ qua lỗi không phải 409', () => {
    expect(resultFromConflict(new ApiError(404, null))).toBeNull()
    expect(resultFromConflict(new Error('x'))).toBeNull()
  })
})

describe('scanErrorText', () => {
  it('nêu rõ từng loại lỗi bằng tiếng Việt', () => {
    expect(scanErrorText(new ApiError(404, null))).toContain('KHÔNG TỒN TẠI')
    expect(scanErrorText(new ApiError(403, null))).toContain('KHÔNG CÓ QUYỀN')
    expect(scanErrorText(new Error('net'))).toContain('KHÔNG KẾT NỐI')
  })
})
