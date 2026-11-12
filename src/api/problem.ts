import type { Problem, ProblemCode } from '@/api/generated/model'

/** Lỗi HTTP từ backend, giữ nguyên ProblemDetail (RFC 9457) kèm `code`. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null

  constructor(status: number, problem: Problem | null) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  get code(): ProblemCode | undefined {
    return this.problem?.code
  }
}

export function isApiError(error: unknown, code?: ProblemCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}
