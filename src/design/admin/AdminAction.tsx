import type { ComponentProps } from 'react'
import { icons } from '@/design/icons'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'

/** Figma Button Primary / Secondary: 54px, ô icon 48×44, khoảng cách 20px. */
export function AdminAction({
  secondary = false,
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & { secondary?: boolean }) {
  return (
    <Button {...props} className={cn('admin-action', secondary && 'admin-action-secondary', className)}>
      <span className="admin-action-icon">
        <img src={secondary ? icons.chevronsRight : icons.chevronsRightDark} alt="" width={20} height={20} />
      </span>
      <span>{children}</span>
    </Button>
  )
}
