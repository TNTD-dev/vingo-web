import { useMemo, useState } from 'react'
import { Link, Outlet, useMatch } from 'react-router'

import { AdminNav } from '@/design/AdminNav'
import { AppNav } from '@/design/AppNav'
import authStadium from '@/design/brand/auth-stadium.png'
import { Logo } from '@/design/Logo'
import stadium from '@/design/brand/stadium.jpg'
import { cn } from '@/lib/cn'

import { AppNav as BuyerNav } from './AppNav'
import { useCopilotShortcut } from './copilotShortcut'

// Khung buyer theo Figma (B1–B17): nền canvas, AppNav cách đỉnh 16px, lề ngang 32px (16px trên điện thoại),
// nội dung rộng tối đa 1376px, cách nav 28px.
export function BuyerLayout() {
  // B11 (vé & QR toàn màn) dùng nền tối.
  const dark = useMatch('/tickets/:ticketId') !== null
  return (
    <div className={cn('flex min-h-dvh flex-col px-4 pt-4 pb-16 sm:px-8', dark ? 'bg-ink' : 'bg-canvas')}>
      <BuyerNav />
      <main className="mx-auto mt-7 flex w-full max-w-[1376px] min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

/** Agent mode (Figma page 04): nền canvas, AppNav kiểu Figma, khung chat chiếm phần còn lại của màn hình. */
/** Trang con bật nền ảnh sân (màn chào Agent mode, Figma M1) qua `useOutletContext<AgentOutletContext>()`. */
/** Admin Copilot (Figma C1–C6): màn riêng, không có sidebar; công tắc "Quản trị | Copilot" và ⌘J để quay lại. */
export function CopilotLayout() {
  useCopilotShortcut('/admin')
  return (
    <div className="relative isolate flex h-dvh min-h-[560px] flex-col gap-3 bg-canvas sm:gap-4">
      <AdminNav mode="copilot" />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  )
}

export type AgentOutletContext = { setBackdrop: (on: boolean) => void }

export function AgentLayout() {
  const [backdrop, setBackdrop] = useState(false)
  const ctx = useMemo<AgentOutletContext>(() => ({ setBackdrop }), [])
  return (
    <div className="relative isolate flex h-dvh min-h-[560px] flex-col gap-3 bg-canvas sm:gap-4">
      {backdrop && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <img src={stadium} alt="" className="size-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-linear-to-r from-canvas/90 via-canvas/60 via-50% to-canvas/15" />
        </div>
      )}
      <AppNav mode="vingo" />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet context={ctx} />
      </main>
    </div>
  )
}

// Khung đăng nhập/đăng ký theo Figma B8, B14, B15: ảnh sân + khẩu hiệu bên trái, form trên nền trắng bên phải.
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh gap-4 bg-canvas p-4 lg:grid-cols-[772fr_620fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden rounded-[30px] p-10 lg:flex">
        <img src={authStadium} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-canvas/0 from-35% to-canvas/95" />
        <Link to="/" aria-label="Vingo" className="relative w-fit">
          <Logo />
        </Link>
        <div className="relative flex flex-col gap-3">
          <p className="type-display-l text-foreground">
            Vé thật.
            <br />
            Ghế thật.
            <br />
            Chỉ một câu chat.
          </p>
          <p className="type-body-l text-ink-secondary">Đăng nhập để giữ ghế, thanh toán và nhận vé QR.</p>
        </div>
      </aside>
      <main className="flex items-center justify-center rounded-[30px] bg-surface px-6 py-10 sm:px-12">
        <div className="flex w-full max-w-[476px] flex-col gap-8">
          <Link to="/" aria-label="Vingo" className="w-fit lg:hidden">
            <Logo />
          </Link>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function PlainLayout() {
  return (
    <main className="flex min-h-dvh flex-col">
      <Outlet />
    </main>
  )
}
