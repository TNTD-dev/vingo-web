import type { Problem, ProblemCode } from '@/api/generated/model'

/** Lỗi HTTP từ backend, giữ nguyên ProblemDetail (RFC 9457) kèm `code`. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null
  /** Số giây chờ theo header Retry-After (429), nếu có. */
  readonly retryAfter?: number

  constructor(status: number, problem: Problem | null, retryAfter?: number) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.retryAfter = retryAfter
  }

  get code(): ProblemCode | undefined {
    return this.problem?.code
  }
}

export function isApiError(error: unknown, code?: ProblemCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

/** Backend trả 501 cho API chưa làm xong. */
export function isNotImplemented(error: unknown): boolean {
  return error instanceof ApiError && error.status === 501
}

export const NOT_IMPLEMENTED_MESSAGE = 'Tính năng đang được hoàn thiện, vui lòng quay lại sau.'
