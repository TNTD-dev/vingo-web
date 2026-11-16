import { ChatPage } from '@/features/chat/ChatPage'

import { CopilotHistoryPanel } from './CopilotHistoryPanel'
import { describeSession } from './copilotHistory'
import { CopilotWelcome } from './CopilotWelcome'
import { TaskPanel, TaskPill } from './TaskPanel'
import { deriveTask } from './taskView'

// Admin Copilot (Figma page 05, C1–C6): hội thoại + panel "Việc đang làm" + lịch sử có lọc. Mở từ nút mascot ở góc màn quản trị hoặc ⌘J.
export default function CopilotPage() {
  return (
    <ChatPage
      agent="admin"
      historyKey="admin"
      placeholder="Giao việc cho Copilot…"
      followUpPlaceholder="Hỏi tiếp…"
      inputNote="Thao tác ghi (void, khoá ghế, huỷ suất, resolve) luôn chờ bạn duyệt và được ghi audit."
      hideWelcomeHeader
      mascotDock={false}
      welcome={(api) => <CopilotWelcome {...api} />}
      describeHistory={describeSession}
      historyPanel={(api) => <CopilotHistoryPanel {...api} />}
      side={({ state, setOpen }) => {
        const view = deriveTask(state)
        // Việc chỉ đọc (báo cáo) đã xong thì thu gọn thành pill (Figma C2).
        if (!view) return { panel: null, pill: null }
        return {
          compact: view.kind === 'REPORT',
          panel: <TaskPanel view={view} onCollapse={() => setOpen(false)} />,
          pill: <TaskPill view={view} onExpand={() => setOpen(true)} />,
        }
      }}
    />
  )
}
