// Logo và mascot Vingo, xuất từ Figma (page 06 · Logo, 07 · Mascot Vingo). Đổi ở Figma trước rồi xuất lại SVG.
import logoMarkDark from './logo-mark-dark.svg'
import logoMarkLight from './logo-mark-light.svg'
import mascotAsking from './mascot-asking.svg'
import mascotCelebrate from './mascot-celebrate.svg'
import mascotListening from './mascot-listening.svg'
import mascotSorry from './mascot-sorry.svg'
import mascotThinking from './mascot-thinking.svg'
import mascotWave from './mascot-wave.svg'
import mascotWorking from './mascot-working.svg'

export const logoMark = { light: logoMarkLight, dark: logoMarkDark } as const

/** Trạng thái mascot, khớp component "Mascot/Vingo" trong Figma. */
export type MascotState = 'wave' | 'listening' | 'thinking' | 'working' | 'asking' | 'celebrate' | 'sorry'

export const mascot: Record<MascotState, string> = {
  wave: mascotWave, // Chào
  listening: mascotListening, // Lắng nghe
  thinking: mascotThinking, // Suy nghĩ
  working: mascotWorking, // Đang làm
  asking: mascotAsking, // Hỏi xác nhận
  celebrate: mascotCelebrate, // Ăn mừng
  sorry: mascotSorry, // Xin lỗi
}
