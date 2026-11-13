// Icon xuất từ Figma (page 01 · Design System và các màn B*). Đổi ở Figma trước rồi xuất lại SVG.
// Màu nét nằm sẵn trong file: icon nét trắng chỉ dùng trên nền tối (bg-ink / ảnh bìa).
import arrowRight from './arrow-right.svg'
import arrowUpRight from './arrow-up-right.svg'
import bank from './bank.svg'
import bell from './bell.svg'
import calendarLight from './calendar-light.svg'
import calendarSm from './calendar-sm.svg'
import calendar from './calendar.svg'
import card from './card.svg'
import checkSm from './check-sm.svg'
import check from './check.svg'
import chevronDown from './chevron-down.svg'
import chevronLeft from './chevron-left.svg'
import chevronRightLight from './chevron-right-light.svg'
import chevronsRightDark from './chevrons-right-dark.svg'
import chevronsRight from './chevrons-right.svg'
import filter from './filter.svg'
import gate from './gate.svg'
import heart from './heart.svg'
import lock from './lock.svg'
import pinLight from './pin-light.svg'
import pin from './pin.svg'
import qr from './qr.svg'
import search from './search.svg'
import share from './share.svg'
import sparkAgentSm from './spark-agent-sm.svg'
import sparkAgent from './spark-agent.svg'
import spark from './spark.svg'

export const icons = {
  /** 14px, nét đen. */
  arrowRight,
  /** 18px, nét trắng. */
  arrowUpRight,
  /** 20px. */
  bank,
  bell,
  /** 20px. */
  card,
  /** 16px. */
  calendar,
  /** 18px, nét trắng — trên ảnh bìa. */
  calendarLight,
  /** 14px — dòng ngày giờ trên thẻ sự kiện. */
  calendarSm,
  /** 13px, nét trắng — ô checkbox đã chọn. */
  check,
  /** 12px, nét trắng — dấu tích bước đã xong. */
  checkSm,
  chevronDown,
  /** 18px, nét đen — nút quay lại. */
  chevronLeft,
  /** 18px, nét trắng — nút tròn đen. */
  chevronRightLight,
  /** 20px, nét trắng — ô icon của Button Secondary (nền đen). */
  chevronsRight,
  /** 20px, nét đen — ô icon của Button Primary (nền trắng). */
  chevronsRightDark,
  filter,
  /** 16px — biểu tượng cổng vào. */
  gate,
  /** 20px. */
  heart,
  /** 16px, nét đen — trên nền lime. */
  lock,
  /** 14px. */
  pin,
  /** 18px, nét trắng — trên ảnh bìa. */
  pinLight,
  /** 20px, nét lime — trên nền đen. */
  qr,
  search,
  /** 20px. */
  share,
  /** Tia sáng Agent, nét đen — dùng trên nền sáng. */
  spark,
  /** Tia sáng Agent, nét lime — dùng trên nền tối. */
  sparkAgent,
  /** 11px, nét lime — chip "Nhờ Vingo". */
  sparkAgentSm,
} as const
