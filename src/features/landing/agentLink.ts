// Landing → Agent mode: truyền câu người dùng qua query param `?q=`.
// Quyết định: dùng query (không dùng router state) để link chia sẻ/refresh được và Agent mode chỉ cần đọc `q`.
export const AGENT_PATH = '/vingo'
const MAX_QUERY_LENGTH = 500

/** Đường dẫn vào Agent mode, kèm câu hỏi nếu có. */
export function agentPath(question?: string): string {
  const q = question?.trim().slice(0, MAX_QUERY_LENGTH)
  return q ? `${AGENT_PATH}?q=${encodeURIComponent(q)}` : AGENT_PATH
}
