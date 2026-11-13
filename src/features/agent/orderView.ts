import type { ChatBlock } from '@/api/generated/model'
import {
  parseConfirmAction,
  parseEventList,
  parseOrderSummary,
  parsePaymentQr,
  parseSeatMap,
  type OrderSummaryPayload,
} from '@/blocks/payloads'
import { pendingConfirmId } from '@/features/chat/chatView'
import type { ChatState } from '@/features/chat/chatReducer'

export type StepStatus = 'done' | 'active' | 'todo'
export type PanelStep = { key: string; title: string; code: string; detail?: string; status: StepStatus }
export type PanelStage = 'search' | 'select' | 'confirm' | 'payment' | 'paid'
export type PanelStatus = 'NHÁP' | 'CHỜ XÁC NHẬN' | 'PENDING' | 'PAID'

export type PanelOrder = {
  eventTitle?: string
  subtitle?: string
  imageUrl?: string
  zone?: string
  seats: string[]
  totalAmount?: number
  fullMapUrl?: string
  expiresAt?: string
}

export type OrderPanelView = { order: PanelOrder; steps: PanelStep[]; stage: PanelStage; status: PanelStatus }

const blocksOf = (state: ChatState): ChatBlock[] => state.items.flatMap((i) => (i.kind === 'assistant' ? i.blocks : []))

function last<T>(list: T[], pick: (x: T) => boolean): T | undefined {
  for (let i = list.length - 1; i >= 0; i--) if (pick(list[i]!)) return list[i]
  return undefined
}

/**
 * Dựng panel "Đơn đang làm" (Figma M1b–M5) từ hội thoại. Contract chưa có sự kiện bước tool,
 * nên bước được suy ra từ block đã nhận (EventList, SeatMap, ConfirmAction, PaymentQR, Ticket) và sự kiện order.*.
 * Số tiền hiển thị lấy nguyên từ payload, không tự cộng.
 */
export function deriveOrderPanel(state: ChatState): OrderPanelView {
  const blocks = blocksOf(state)
  const ctxItem = state.items.find((i) => i.kind === 'context')
  const hasContext = !!ctxItem
  const ctx = ctxItem?.kind === 'context' ? ctxItem.info : undefined
  const events = last(blocks, (b) => b.type === 'EventList')
  const seatmap = last(blocks, (b) => b.type === 'SeatMap')
  const qr = last(blocks, (b) => b.type === 'PaymentQR')
  const confirmBlocks = blocks.filter((b) => b.type === 'ConfirmAction').map(parseConfirmAction)
  const confirmedKind = confirmBlocks.some((c) => c.actionId && state.actions[c.actionId] === 'confirmed')
  const pending = pendingConfirmId(state)
  const evTypes = new Set(state.orderEvents.map((e) => e.type))
  const paid = evTypes.has('order.paid') || evTypes.has('ticket.issued') || blocks.some((b) => b.type === 'Ticket')
  const held = evTypes.has('order.held') || confirmedKind || !!qr
  const qrPayload = qr ? parsePaymentQr(qr) : undefined

  // Thông tin đơn: OrderSummary mới nhất > đơn đính kèm ConfirmAction > ghế đang chọn trên sơ đồ.
  const summary = last(blocks, (b) => b.type === 'OrderSummary')
  let o: OrderSummaryPayload | undefined = summary ? parseOrderSummary(summary) : undefined
  if (!o) o = [...confirmBlocks].reverse().find((c) => c.order)?.order
  const sm = seatmap ? parseSeatMap(seatmap) : undefined
  const order: PanelOrder = {
    eventTitle: o?.eventTitle ?? ctx?.eventTitle,
    subtitle: o?.subtitle ?? ctx?.subtitle,
    imageUrl: o?.imageUrl,
    zone: o?.zone ?? sm?.zoneLabel ?? ctx?.zone,
    seats: o?.seats.length
      ? o.seats
      : sm
        ? sm.selected.map((id) => sm.rows.flat().find((s) => s.id === id)?.label ?? id)
        : (ctx?.seats ?? []),
    totalAmount: o?.totalAmount ?? qrPayload?.totalAmount,
    fullMapUrl: o?.fullMapUrl ?? sm?.fullMapUrl,
    expiresAt: qrPayload?.expiresAt ?? o?.expiresAt,
  }

  const stage: PanelStage = paid
    ? 'paid'
    : qr
      ? 'payment'
      : pending || held
        ? 'confirm'
        : seatmap
          ? 'confirm'
          : events
            ? 'select'
            : 'search'
  const status: PanelStatus = paid ? 'PAID' : qr ? 'PENDING' : pending ? 'CHỜ XÁC NHẬN' : 'NHÁP'
  const n = events ? parseEventList(events).events.length : 0
  const seatDetail = order.seats.join(', ') || undefined

  const searching = state.awaiting && !events && !seatmap && !hasContext
  const first: PanelStep = hasContext
    ? { key: 'ctx', title: 'Nhận ngữ cảnh từ trang', code: 'SHOWTIME · ZONE · GHẾ', detail: undefined, status: 'done' }
    : {
        key: 'search',
        title: events ? 'Tìm sự kiện' : searching ? 'Đang tìm sự kiện' : 'Tìm sự kiện',
        code: 'SEARCH_EVENTS',
        detail: events ? `${n} KẾT QUẢ` : undefined,
        status: events || seatmap || held ? 'done' : searching ? 'active' : 'todo',
      }
  const seatDone = held || !!pending
  const steps: PanelStep[] = [
    first,
    {
      key: 'seat',
      title: events && !seatmap && !held ? 'Chờ bạn chọn trận' : 'Chọn / xác nhận ghế',
      code: 'GET_SEATMAP',
      detail: seatmap ? sm?.zoneLabel : undefined,
      status: seatDone ? 'done' : events && !seatmap ? 'active' : seatmap ? 'active' : 'todo',
    },
    {
      key: 'hold',
      title: pending ? 'Chờ bạn đồng ý giữ ghế' : held ? 'Đã giữ ghế' : 'Giữ ghế',
      code: 'CREATE_HOLD',
      detail: held ? seatDetail : undefined,
      status: held ? 'done' : pending ? 'active' : 'todo',
    },
    {
      key: 'pay',
      title: paid ? 'Đã thanh toán' : qr ? 'Chờ bạn quét QR' : 'Tạo QR VNPay',
      code: 'CREATE_PAYMENT',
      detail: qr ? 'VNPAYQR' : undefined,
      status: paid ? 'done' : qr ? 'active' : 'todo',
    },
    { key: 'ticket', title: 'Nhận vé', code: 'TICKET.ISSUED', status: paid ? 'done' : 'todo' },
  ]
  return { order, steps, stage, status }
}
