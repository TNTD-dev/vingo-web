import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'

import { RequireAuth } from '@/auth/guards'
import { FullPageSpinner } from '@/design/FullPageSpinner'
import { ForbiddenPage, NotFoundPage } from '@/features/StatusPages'

import { AdminLayout, AuthLayout, BuyerLayout, PlainLayout } from './layouts'

function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Component />
    </Suspense>
  )
}

const L = {
  Login: lazy(() => import('@/features/auth/LoginPage')),
  Register: lazy(() => import('@/features/auth/RegisterPage')),
  VerifyOtp: lazy(() => import('@/features/auth/VerifyOtpPage')),
  ForgotPassword: lazy(() => import('@/features/auth/ForgotPasswordPage')),
  ResetPassword: lazy(() => import('@/features/auth/ResetPasswordPage')),
  GoogleCallback: lazy(() => import('@/features/auth/GoogleCallbackPage')),
  Chat: lazy(() => import('@/features/chat/ChatPage')),
  Events: lazy(() => import('@/features/buyer/EventsPage')),
  EventDetail: lazy(() => import('@/features/buyer/EventDetailPage')),
  Orders: lazy(() => import('@/features/buyer/OrdersPage')),
  OrderDetail: lazy(() => import('@/features/buyer/OrderDetailPage')),
  PaymentReturn: lazy(() => import('@/features/buyer/PaymentReturnPage')),
  Tickets: lazy(() => import('@/features/buyer/TicketsPage')),
  TicketDetail: lazy(() => import('@/features/buyer/TicketDetailPage')),
  Profile: lazy(() => import('@/features/buyer/ProfilePage')),
  Checkin: lazy(() => import('@/features/checkin/CheckinPage')),
  AdminChat: lazy(() => import('@/features/admin/AdminChatPage')),
  Reports: lazy(() => import('@/features/dashboard/ReportsPage')),
  Venues: lazy(() => import('@/features/admin/VenuesPage')),
  VenueDetail: lazy(() => import('@/features/admin/VenueDetailPage')),
  HallLayouts: lazy(() => import('@/features/admin/HallLayoutsPage')),
  AdminEvents: lazy(() => import('@/features/admin/AdminEventsPage')),
  AdminEventDetail: lazy(() => import('@/features/admin/AdminEventDetailPage')),
  AdminOrders: lazy(() => import('@/features/admin/AdminOrdersPage')),
  AdminOrderDetail: lazy(() => import('@/features/admin/AdminOrderDetailPage')),
  AdminTickets: lazy(() => import('@/features/admin/AdminTicketsPage')),
  AuditLogs: lazy(() => import('@/features/admin/AuditLogsPage')),
}

const buyer = (el: LazyExoticComponent<ComponentType>) => <RequireAuth>{page(el)}</RequireAuth>

export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: page(L.Login) },
      { path: '/register', element: page(L.Register) },
      { path: '/verify-otp', element: page(L.VerifyOtp) },
      { path: '/forgot-password', element: page(L.ForgotPassword) },
      { path: '/reset-password', element: page(L.ResetPassword) },
      { path: '/auth/google', element: page(L.GoogleCallback) },
    ],
  },
  {
    element: <BuyerLayout />,
    children: [
      // Chat và danh sách sự kiện xem được khi chưa đăng nhập; gửi tin thì phải đăng nhập.
      { path: '/', element: page(L.Chat) },
      { path: '/events', element: page(L.Events) },
      { path: '/events/:eventId', element: page(L.EventDetail) },
      { path: '/orders', element: buyer(L.Orders) },
      { path: '/orders/:orderId', element: buyer(L.OrderDetail) },
      { path: '/payment/vnpay-return', element: buyer(L.PaymentReturn) },
      { path: '/tickets', element: buyer(L.Tickets) },
      { path: '/tickets/:ticketId', element: buyer(L.TicketDetail) },
      { path: '/me', element: buyer(L.Profile) },
      { path: '/403', element: <ForbiddenPage /> },
    ],
  },
  {
    element: <PlainLayout />,
    children: [{ path: '/checkin', element: buyer(L.Checkin) }],
  },
  {
    path: '/admin',
    element: (
      <RequireAuth allow="ADMIN">
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(L.AdminChat) },
      { path: 'dashboard', element: page(L.Reports) },
      { path: 'venues', element: page(L.Venues) },
      { path: 'venues/:venueId', element: page(L.VenueDetail) },
      { path: 'halls/:hallId/layouts', element: page(L.HallLayouts) },
      { path: 'events', element: page(L.AdminEvents) },
      { path: 'events/:eventId', element: page(L.AdminEventDetail) },
      { path: 'orders', element: page(L.AdminOrders) },
      { path: 'orders/:orderId', element: page(L.AdminOrderDetail) },
      { path: 'tickets', element: page(L.AdminTickets) },
      { path: 'audit-logs', element: page(L.AuditLogs) },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
