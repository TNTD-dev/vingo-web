import { isApiError } from '@/api/problem'

/** In dữ liệu thô của một query để kiểm tra dây nối API. Thay bằng UI thật sau. */
export function QueryDump({ query }: { query: { isPending: boolean; error: unknown; data: unknown } }) {
  if (query.isPending) return <p className="text-muted-foreground">Đang tải…</p>
  if (query.error) {
    const msg = isApiError(query.error)
      ? `${query.error.status} ${query.error.code ?? ''} — ${query.error.message}`
      : String(query.error)
    return <p className="text-destructive">Lỗi: {msg}</p>
  }
  return (
    <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(query.data, null, 2)}</pre>
  )
}
