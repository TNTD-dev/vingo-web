// Máy trạng thái cho placeholder tự gõ (Figma motion spec #2):
// gõ 40ms/ký tự → giữ 1,6s → xoá 20ms/ký tự → câu kế tiếp.
export const TYPE_MS = 40
export const HOLD_MS = 1600
export const ERASE_MS = 20

export type TypewriterState = { index: number; length: number; phase: 'typing' | 'holding' | 'erasing' }

export const typewriterStart: TypewriterState = { index: 0, length: 0, phase: 'typing' }

/** Trả trạng thái kế tiếp và thời gian chờ trước bước sau. */
export function typewriterStep(
  state: TypewriterState,
  sentences: readonly string[],
): { state: TypewriterState; delay: number } {
  const full = sentences[state.index]?.length ?? 0
  if (state.phase === 'typing') {
    const length = Math.min(state.length + 1, full)
    if (length >= full) return { state: { ...state, length, phase: 'holding' }, delay: HOLD_MS }
    return { state: { ...state, length }, delay: TYPE_MS }
  }
  if (state.phase === 'holding') {
    return { state: { ...state, phase: 'erasing' }, delay: ERASE_MS }
  }
  const length = Math.max(state.length - 1, 0)
  if (length === 0) {
    return { state: { index: (state.index + 1) % sentences.length, length: 0, phase: 'typing' }, delay: TYPE_MS }
  }
  return { state: { ...state, length }, delay: ERASE_MS }
}

export function typewriterText(state: TypewriterState, sentences: readonly string[]): string {
  return (sentences[state.index] ?? '').slice(0, state.length)
}
