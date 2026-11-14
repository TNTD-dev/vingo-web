import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'

import { icons } from '@/design/icons'
import { cn } from '@/lib/cn'

type Common = { variant?: 'primary' | 'secondary'; icon?: string; className?: string; children: ReactNode }
type LinkProps = Common & { to: string } & Omit<ComponentProps<typeof Link>, 'to' | 'className' | 'children'>
type ButtonProps = Common & { to?: undefined } & Omit<ComponentProps<'button'>, 'className' | 'children'>

/**
 * Nút có ô icon ở trái (Figma: Design System › Button). primary = nền đen, secondary = nền trắng viền nhạt.
 * Truyền `to` để render link, không thì là button.
 */
export function ArrowButton(props: LinkProps | ButtonProps) {
  const { variant = 'secondary', icon, className, children } = props
  const primary = variant === 'primary'
  const cls = cn(
    'flex items-center gap-5 rounded-[14px] py-[5px] pr-6 pl-[5px] transition-transform active:scale-[0.98] disabled:opacity-50',
    primary ? 'bg-ink text-on-ink' : 'border border-line bg-surface text-foreground',
    className,
  )
  const inner = (
    <>
      <span
        className={cn(
          'flex h-11 w-12 shrink-0 items-center justify-center rounded-[10px]',
          primary ? 'bg-surface' : 'bg-ink',
        )}
      >
        <img src={icon ?? (primary ? icons.chevronsRightDark : icons.chevronsRight)} alt="" className="size-5" />
      </span>
      <span className="type-body-m-strong whitespace-nowrap">{children}</span>
    </>
  )
  if (props.to !== undefined) {
    const { variant: _v, icon: _i, className: _c, children: _ch, ...rest } = props
    return (
      <Link className={cls} {...rest}>
        {inner}
      </Link>
    )
  }
  const { variant: _v, icon: _i, className: _c, children: _ch, to: _t, ...rest } = props
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  )
}
