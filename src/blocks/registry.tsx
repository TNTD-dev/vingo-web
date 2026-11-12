import type { ComponentType } from 'react'

import type { ChatBlockType } from '@/api/generated/model'

import { Chart } from './Chart'
import { ConfirmAction } from './ConfirmAction'
import { EventList } from './EventList'
import { OrderSummary } from './OrderSummary'
import { PaymentQR } from './PaymentQR'
import { SeatMap } from './SeatMap'
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

export function BlockView(props: BlockProps) {
  const Component = props.block.type ? registry[props.block.type] : undefined
  if (!Component) return <div className="text-xs text-muted-foreground">Block không hỗ trợ: {props.block.type}</div>
  return <Component {...props} />
}
