import type { ChatBlock } from '@/api/generated/model'

export type BlockProps = {
  block: ChatBlock
  /** Gửi thao tác trên block về agent (POST sendMessage với block_event). */
  onBlockEvent?: (type: string, payload: Record<string, unknown>) => void
}
