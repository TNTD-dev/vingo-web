import { mascot, type MascotState } from '@/design/brand'
import { cn } from '@/lib/cn'

/** Mascot Vingo kèm chuyển động nhẹ theo trạng thái (chào, nghĩ, xin lỗi, ăn mừng…). Chỉ trang trí nên không có alt. */
export function Mascot({ state, className }: { state: MascotState; className?: string }) {
  return <img src={mascot[state]} alt="" data-state={state} className={cn('vg-mascot', className)} />
}
