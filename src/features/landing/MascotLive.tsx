import { cn } from '@/lib/cn'

export type MascotMood = 'rest' | 'wave' | 'listening' | 'celebrate'

/**
 * Mascot Vingo "Live" (Figma page 07): rig nhiều lớp, chuyển động bằng CSS transform (xem landing.css, `.mv-*`).
 * Hình vẽ lấy từ bộ SVG mascot trong `design/brand` (viewBox 230×220), tách lớp để tay, mắt, tia sáng cử động riêng.
 * - rest: thở + chớp mắt 2,4s (chớp mắt chạy cả khi bật giảm chuyển động)
 * - wave: vẫy tay phải. listening: nghiêng người lắng nghe. celebrate: nhảy, giơ hai tay, pháo giấy.
 */
export function MascotLive({ mood = 'rest', className }: { mood?: MascotMood; className?: string }) {
  return (
    <svg viewBox="0 0 230 220" aria-hidden data-mood={mood} className={cn('mv overflow-visible', className)}>
      <g className="mv-confetti">
        <rect x="26" y="52" width="10" height="18" rx="3" transform="rotate(-20 31 61)" className="fill-mascot-cheek" />
        <rect
          x="196"
          y="44"
          width="10"
          height="18"
          rx="3"
          transform="rotate(25 201 53)"
          fill="color-mix(in srgb, var(--vg-status-info) 45%, white)"
        />
        <rect x="172" y="24" width="8" height="14" rx="3" transform="rotate(-10 176 31)" className="fill-agent" />
        <rect x="50" y="26" width="8" height="14" rx="3" transform="rotate(15 54 33)" className="fill-ink" />
      </g>
      <g className="mv-rig">
        <g className="mv-arm-l">
          <path
            d="M57 141C47.7 150.3 44.3 160.3 47 171"
            className="fill-none stroke-ink"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>
        <g className="mv-arm-r">
          <path
            d="M173 141C182.3 150.3 185.7 160.3 183 171"
            className="fill-none stroke-ink"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <g className="mv-wave-lines">
            <path
              d="M203 81C208.3 85 210.3 90.3 209 97"
              className="fill-none stroke-ink"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M211 73C217.7 79.7 220 87.7 218 97"
              className="fill-none stroke-ink"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </g>
        <rect x="87" y="189" width="16" height="22" rx="8" className="fill-ink" />
        <rect x="127" y="189" width="16" height="22" rx="8" className="fill-ink" />
        <path
          d="M89 55H141C150 55 158.7 58.6 165 65C171.4 71.3 175 80 175 89V123C171.8 123 168.8 124.3 166.5 126.5C164.3 128.8 163 131.8 163 135C163 138.2 164.3 141.2 166.5 143.5C168.8 145.7 171.8 147 175 147V161C175 170 171.4 178.7 165 185C158.7 191.4 150 195 141 195H89C80 195 71.3 191.4 65 185C58.6 178.7 55 170 55 161V147C58.2 147 61.2 145.7 63.5 143.5C65.7 141.2 67 138.2 67 135C67 131.8 65.7 128.8 63.5 126.5C61.2 124.3 58.2 123 55 123V89C55 80 58.6 71.3 65 65C71.3 58.6 80 55 89 55Z"
          className="fill-agent stroke-ink"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path
          d="M73 69C78.3 63.7 85.7 61 95 61"
          className="fill-none stroke-white"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M73 165H157"
          className="fill-none stroke-ink"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="0.1 9"
          opacity="0.45"
        />
        <ellipse cx="79" cy="133" rx="9" ry="5" className="fill-mascot-cheek" opacity="0.6" />
        <ellipse cx="151" cy="133" rx="9" ry="5" className="fill-mascot-cheek" opacity="0.6" />
        <g className="mv-eyes">
          <g className="mv-eye" style={{ transformOrigin: '95px 113px' }}>
            <ellipse cx="95" cy="113" rx="9" ry="12" className="fill-ink" />
            <circle cx="98" cy="108" r="3" className="fill-white" />
            <circle cx="92" cy="118" r="1.5" className="fill-white" />
          </g>
          <g className="mv-eye" style={{ transformOrigin: '135px 113px' }}>
            <ellipse cx="135" cy="113" rx="9" ry="12" className="fill-ink" />
            <circle cx="138" cy="108" r="3" className="fill-white" />
            <circle cx="132" cy="118" r="1.5" className="fill-white" />
          </g>
        </g>
        <g className="mv-happy-eyes">
          <path
            d="M87 115C92.3 108.3 97.7 108.3 103 115"
            className="fill-none stroke-ink"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M127 115C132.3 108.3 137.7 108.3 143 115"
            className="fill-none stroke-ink"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>
        <path
          className="mv-smile fill-none stroke-ink"
          d="M103 129C111 138.3 119 138.3 127 129"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <g className="mv-open-mouth">
          <path
            d="M101 127C110.3 141.7 119.7 141.7 129 127H101Z"
            className="fill-ink stroke-ink"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <ellipse cx="115" cy="137" rx="6" ry="4" className="fill-mascot-cheek" />
        </g>
        <path
          d="M115 55C113.7 48.3 115 42.3 119 37"
          className="fill-none stroke-ink"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          className="mv-spark fill-agent stroke-ink"
          d="M119.9 21.4C122.1 27.3 127.1 30.6 133.4 30.2C127.5 32.3 124.2 37.4 124.7 43.7C122.5 37.7 117.4 34.4 111.1 34.9C117.1 32.8 120.4 27.7 119.9 21.4Z"
          strokeWidth="2.4"
          strokeLinejoin="round"
          style={{ transformOrigin: '122px 32px' }}
        />
      </g>
    </svg>
  )
}
