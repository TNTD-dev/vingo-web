import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/problem'
import { ErrorNotice } from './AdminUi'

const err = (status: number, code?: string) =>
  new ApiError(status, code ? ({ status, code, title: 't' } as never) : null)

describe('ErrorNotice (admin)', () => {
  it.each([
    [409, 'HALL_NAME_TAKEN', 'trùng tên'],
    [409, 'SEAT_LAYOUT_LOCKED', 'đã công bố'],
    [422, 'INVALID_SEAT_LAYOUT', 'quy ước sơ đồ'],
    [422, 'EVENT_INCOMPLETE', 'chưa đủ cấu hình'],
    [415, 'UNSUPPORTED_MEDIA_TYPE', 'SVG'],
    [413, 'VALIDATION_ERROR', '10 MiB'],
    [501, undefined, 'chưa được hỗ trợ'],
  ])('hiện câu tiếng Việt cho %i %s', (status, code, text) => {
    render(<ErrorNotice error={err(status, code)} />)
    expect(screen.getByRole('alert').textContent).toContain(text)
  })
})
