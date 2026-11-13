import type { MascotState } from '@/design/brand'

import { parseConfirmAction, parseEventList, parseSeatMap } from '@/blocks/payloads'

import type { ActionState, ChatItem, ChatState } from './chatReducer'

type AssistantItem = Extract<ChatItem, { kind: 'assistant' }>

/** Một dòng "tool đã chạy" hiện trước câu trả lời của agent (Figma AgentStep, dạng gọn). */
export type StepLine = { key: string; label: string; detail?: string }

/**
 * Dựng các dòng tool từ block đã nhận. Contract chưa có sự kiện riêng cho bước tool,
 * nên suy ra từ loại block: danh sách sự kiện → SEARCH_EVENTS, sơ đồ ghế → GET_SEATMAP,
 * mã QR → CREATE_PAYMENT, ConfirmAction đã đồng ý → tên thao tác (vd CREATE_HOLD).
 */
export function stepLines(item: AssistantItem, actions: Record<string, ActionState>): StepLine[] {
  const lines: StepLine[] = []
  item.blocks.forEach((b, i) => {
    const key = `${item.id}:${b.id ?? i}`
    if (b.type === 'EventList') {
      const n = parseEventList(b).events.length
      lines.push({ key, label: 'SEARCH_EVENTS', detail: `${n} KẾT QUẢ` })
    } else if (b.type === 'SeatMap') {
      lines.push({ key, label: 'GET_SEATMAP', detail: parseSeatMap(b).zoneLabel })
    } else if (b.type === 'PaymentQR') {
      lines.push({ key, label: 'CREATE_PAYMENT', detail: 'VNPAYQR' })
    } else if (b.type === 'ConfirmAction') {
      const c = parseConfirmAction(b)
      if (c.actionId && actions[c.actionId] === 'confirmed') {
        lines.push({ key, label: c.kind ?? 'ACTION', detail: 'OK' })
      }
    }
  })
  return lines
}

/** Block ConfirmAction đang chờ người dùng quyết định (mới nhất). */
export function pendingConfirmId(state: ChatState): string | undefined {
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i]
    if (it?.kind !== 'assistant') continue
    for (let j = it.blocks.length - 1; j >= 0; j--) {
      const b = it.blocks[j]
      if (b?.type !== 'ConfirmAction') continue
      const id = parseConfirmAction(b).actionId
      const st = id ? state.actions[id] : undefined
      if (id && (st === undefined || st === 'failed')) return id
    }
  }
  return undefined
}

export type MascotView = { state: MascotState; bubble?: string }

/** Chọn trạng thái mascot theo bước agent (Figma page 07). */
export function mascotView(state: ChatState, opts: { typing: boolean; handoff?: boolean }): MascotView {
  if (state.error) return { state: 'sorry', bubble: 'Xin lỗi, mình gặp trục trặc' }
  const last = state.orderEvents.at(-1)
  if (last?.type === 'ticket.issued' || last?.type === 'order.paid') {
    return { state: 'celebrate', bubble: 'Có vé rồi! 🎉' }
  }
  if (pendingConfirmId(state)) return { state: 'asking', bubble: 'Bạn đồng ý không?' }
  const lastAssistant = [...state.items].reverse().find((i): i is AssistantItem => i.kind === 'assistant')
  if (state.awaiting) {
    const hasContent =
      !!lastAssistant && !lastAssistant.done && (lastAssistant.text !== '' || lastAssistant.blocks.length > 0)
    return hasContent ? { state: 'working' } : { state: 'thinking', bubble: 'Để mình tìm xem…' }
  }
  if (lastAssistant?.blocks.some((b) => b.type === 'PaymentQR')) {
    return { state: 'working', bubble: 'Chờ bạn quét QR nha' }
  }
  if (opts.typing) return { state: 'listening' }
  if (opts.handoff) return { state: 'wave', bubble: 'Mình sang đây cùng bạn nè!' }
  return { state: 'wave' }
}

export type EventPill = { label: string; tone: 'success' | 'agent' | 'warning' | 'neutral' }

/** Pill mốc đơn/vé trong hội thoại (Figma M4: "ĐÃ GIỮ D-14, D-15 · ĐƠN #VG-24117"; M5: "ORDER.PAID · TICKET.ISSUED"). */
export function eventPill(type: string, data: Record<string, unknown>): EventPill | undefined {
  const seats = Array.isArray(data.seats) ? data.seats.filter((s): s is string => typeof s === 'string') : []
  const code = typeof data.order_code === 'string' ? data.order_code : undefined
  switch (type) {
    case 'order.held':
      return {
        label: ['ĐÃ GIỮ', seats.join(', ') || undefined, code ? `ĐƠN #${code}` : undefined]
          .filter(Boolean)
          .join(' · ')
          .replace('ĐÃ GIỮ · ', 'ĐÃ GIỮ '),
        tone: 'success',
      }
    case 'order.paid':
    case 'ticket.issued':
      return { label: 'ORDER.PAID · TICKET.ISSUED', tone: 'agent' }
    case 'order.expired':
      return { label: 'ĐƠN HẾT HẠN', tone: 'neutral' }
    case 'order.needs_review':
      return { label: 'ĐƠN CẦN XEM LẠI', tone: 'warning' }
    case 'payment.failed':
      return { label: 'THANH TOÁN THẤT BẠI', tone: 'warning' }
    default:
      return undefined
  }
}

/** order.paid và ticket.issued cùng hiện một pill: bỏ pill trùng liền kề. */
export function dedupePills(items: ChatItem[]): ChatItem[] {
  return items.filter((it, i) => {
    if (it.kind !== 'event') return true
    const label = eventPill(it.type, it.data)?.label
    const prev = items[i - 1]
    return !(prev?.kind === 'event' && eventPill(prev.type, prev.data)?.label === label)
  })
}
