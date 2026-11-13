import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Direction = 'right' | 'up' | 'up-right'

// Icon cũ trượt ra, bản sao trượt vào từ phía đối diện.
const OUT: Record<Direction, string> = {
  right: 'motion-safe:group-hover:translate-x-[160%] motion-safe:group-focus-visible:translate-x-[160%]',
  up: 'motion-safe:group-hover:-translate-y-[160%] motion-safe:group-focus-visible:-translate-y-[160%]',
  'up-right':
    'motion-safe:group-hover:translate-x-[160%] motion-safe:group-hover:-translate-y-[160%] motion-safe:group-focus-visible:translate-x-[160%] motion-safe:group-focus-visible:-translate-y-[160%]',
}

const IN: Record<Direction, string> = {
  right: '-translate-x-[160%]',
  up: 'translate-y-[160%]',
  'up-right': '-translate-x-[160%] translate-y-[160%]',
}

const SETTLE =
  'motion-safe:group-hover:translate-x-0 motion-safe:group-hover:translate-y-0 motion-safe:group-focus-visible:translate-x-0 motion-safe:group-focus-visible:translate-y-0'

const LAYER =
  'flex size-full items-center justify-center transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]'

/**
 * Hiệu ứng mũi tên "lướt qua" khi hover/focus nút cha. Nút cha phải có class `group`.
 * `className` là khung cắt (kích thước, nền, bo góc); icon trượt bị cắt trong khung này.
 * Bật "giảm chuyển động" thì icon đứng yên.
 */
export function IconSweep({
  children,
  direction = 'right',
  className,
}: {
  children: ReactNode
  direction?: Direction
  className?: string
}) {
  return (
    <span aria-hidden className={cn('relative inline-flex shrink-0 overflow-hidden', className)}>
      <span className={cn(LAYER, OUT[direction])}>{children}</span>
      <span className={cn(LAYER, 'absolute inset-0', IN[direction], SETTLE)}>{children}</span>
    </span>
  )
}
