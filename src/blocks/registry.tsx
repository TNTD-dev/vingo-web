import type { ComponentType } from 'react'

import type { ChatBlockType } from '@/api/generated/model'

import { blockView } from './adminPayloads'
import { Chart } from './Chart'
import { ConfirmAction } from './ConfirmAction'
import { EventList } from './EventList'
import { OrderSummary } from './OrderSummary'
import { PaymentQR } from './PaymentQR'
import { ReviewTable } from './ReviewTable'
import { SeatLock } from './SeatLock'
import { SeatMap } from './SeatMap'
import { ShowtimeForm } from './ShowtimeForm'
import { StatCards } from './StatCards'
import { Ticket } from './Ticket'
import type { BlockProps } from './types'

/** Mỗi ChatBlockType trong contract có đúng một component. Thêm type mới → TS báo thiếu ở đây. */
const registry: Record<ChatBlockType, ComponentType<BlockProps>> = {
  SeatMap,
  OrderSummary,
  PaymentQR,
  Ticket,
  ConfirmAction,
  StatCards,
  Chart,
  EventList,
}

/**
 * Dạng hiển thị mở rộng của Admin Copilot, chọn bằng `payload.view` trên block có sẵn
 * (contract chưa có block type riêng cho bảng duyệt, form suất, khoá ghế).
 */
const views = {
  review_table: ReviewTable,
  showtime_form: ShowtimeForm,
  seat_lock: SeatLock,
} as const

export function BlockView(props: BlockProps) {
  const view = blockView(props.block)
  const Component = view ? views[view] : props.block.type ? registry[props.block.type] : undefined
  if (!Component) return <div className="text-xs text-muted-foreground">Block không hỗ trợ: {props.block.type}</div>
  return <Component {...props} />
}
