/** 4 câu ví dụ cho ô chat (placeholder tự gõ ở Hero và CTA). */
export const EXAMPLE_PROMPTS = [
  '2 vé HAGL cuối tuần, khán đài B',
  'Cuối tuần này Sài Gòn có gì vui?',
  '2 vé concert gần sân khấu dưới 2 triệu',
  'Trận HAGL kế tiếp còn ghế có mái không?',
] as const

/** Chip gợi ý dưới ô chat Hero (3 câu cuối). */
export const HERO_CHIPS = EXAMPLE_PROMPTS.slice(1)
