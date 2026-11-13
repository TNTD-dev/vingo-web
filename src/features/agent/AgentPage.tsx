import { ChatPage } from '@/features/chat/ChatPage'

// Agent mode của buyer (Figma page 04, M1–M6): hội thoại + pop-up "Đơn đang làm" + lịch sử.
export default function AgentPage() {
  return <ChatPage agent="buyer" />
}
