import type { ComponentProps } from 'react'

import { cn } from '@/lib/cn'

/**
 * Vùng cuộn nằm trong khung của trang: thanh cuộn mảnh nằm trong vùng này, không phải của cửa sổ.
 * Cha phải có chiều cao xác định (vd. `h-full min-h-0` trong flex) thì vùng mới cuộn.
 */
export function ScrollPane({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={cn('vg-scroll min-h-0 overflow-y-auto overscroll-contain', className)} />
}
