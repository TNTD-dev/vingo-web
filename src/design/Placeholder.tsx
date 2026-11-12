import type { ReactNode } from 'react'

/**
 * Khung tạm cho màn chưa thiết kế: tên màn + các operationId sẽ dùng.
 * Thay bằng UI thật khi thiết kế xong; không dùng ở production.
 */
export function Placeholder({
  title,
  operations = [],
  children,
}: {
  title: string
  operations?: string[]
  children?: ReactNode
}) {
  return (
    <section className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      {operations.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          API:{' '}
          {operations.map((op) => (
            <code key={op} className="mr-1 rounded bg-muted px-1 py-0.5">
              {op}
            </code>
          ))}
        </p>
      )}
      <div className="mt-4 rounded-lg border border-dashed p-4 text-sm">{children ?? 'Chưa thiết kế'}</div>
    </section>
  )
}
