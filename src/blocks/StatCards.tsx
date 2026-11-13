import type { BlockProps } from './types'

/** Block `StatCards` trong khung chat. Chưa thiết kế: in payload thô. */
export function StatCards({ block }: BlockProps) {
  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="mb-1 font-medium">StatCards</div>
      <pre className="overflow-auto">{JSON.stringify(block.payload, null, 2)}</pre>
    </div>
  )
}
