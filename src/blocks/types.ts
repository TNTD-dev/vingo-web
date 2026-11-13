import type { ChatBlock } from '@/api/generated/model'

/** Trạng thái một ConfirmAction sau khi người dùng quyết định. */
export type ActionState = 'confirming' | 'confirmed' | 'rejected' | 'expired' | 'failed'

export type BlockProps = {
  block: ChatBlock
  /**
   * Gửi thao tác trên block về agent (POST sendMessage với block_event).
   * `label` (nếu có) hiện như một tin của người dùng trong hội thoại.
   */
  onBlockEvent?: (type: string, payload: Record<string, unknown>, label?: string) => void
  /** Trạng thái các ConfirmAction đã bấm, theo action_id. */
  actionState?: Record<string, ActionState>
  /** Người dùng bấm Đồng ý / Từ chối trên ConfirmAction. */
  onDecide?: (actionId: string, decision: 'confirm' | 'reject') => void
  /** Đơn đã thanh toán (nhận order.paid / ticket.issued): QR hết tác dụng. */
  orderPaid?: boolean
  /** Chưa đăng nhập: xem được nhưng không bấm được thao tác ghi. */
  readOnly?: boolean
}
