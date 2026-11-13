import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'

import { RequireAuth } from '@/auth/guards'
import { FullPageSpinner } from '@/design/FullPageSpinner'
import { ForbiddenPage, NotFoundPage } from '@/features/StatusPages'

import { AdminLayout, AgentLayout, AuthLayout, BuyerLayout, CopilotLayout, PlainLayout } from './layouts'

function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Component />
    </Suspense>
  )
}

const L = {
  // auth
  Login: lazy(() => import('@/features/auth/LoginPage')),
  Register: lazy(() => import('@/features/auth/RegisterPage')),
  VerifyOtp: lazy(() => import('@/features/auth/VerifyOtpPage')),
  ForgotPassword: lazy(() => import('@/features/auth/ForgotPasswordPage')),
  ResetPassword: lazy(() => import('@/features/auth/ResetPasswordPage')),
  GoogleCallback: lazy(() => import('@/features/auth/GoogleCallbackPage')),
  // landing
  Landing: lazy(() => import('@/features/landing/LandingPage')),
  // agent (Agent mode của buyer)
  Agent: lazy(() => import('@/features/agent/AgentPage')),
  // booking (Tự đặt)
  Events: lazy(() => import('@/features/booking/EventsPage')),
  EventDetail: lazy(() => import('@/features/booking/EventDetailPage')),
  SeatSelection: lazy(() => import('@/features/booking/SeatSelectionPage')),
  Checkout: lazy(() => import('@/features/booking/CheckoutPage')),
  PaymentReturn: lazy(() => import('@/features/booking/PaymentReturnPage')),
  // account
  Orders: lazy(() => import('@/features/account/OrdersPage')),
  OrderDetail: lazy(() => import('@/features/account/OrderDetailPage')),
  Tickets: lazy(() => import('@/features/account/TicketsPage')),
  TicketDetail: lazy(() => import('@/features/account/TicketDetailPage')),
  Profile: lazy(() => import('@/features/account/ProfilePage')),
  AccountSecurity: lazy(() => import('@/features/account/AccountSecurityPage')),
  // checkin
  Checkin: lazy(() => import('@/features/checkin/CheckinPage')),
  // admin-dashboard
  Overview: lazy(() => import('@/features/admin-dashboard/OverviewPage')),
  Reports: lazy(() => import('@/features/admin-dashboard/ReportsPage')),
  // copilot
  Copilot: lazy(() => import('@/features/copilot/CopilotPage')),
  // admin-catalog
  Venues: lazy(() => import('@/features/admin-catalog/VenuesPage')),
  VenueDetail: lazy(() => import('@/features/admin-catalog/VenueDetailPage')),
  HallLayouts: lazy(() => import('@/features/admin-catalog/HallLayoutsPage')),
  AdminEvents: lazy(() => import('@/features/admin-catalog/AdminEventsPage')),
  AdminEventDetail: lazy(() => import('@/features/admin-catalog/AdminEventDetailPage')),
  ShowtimeSeats: lazy(() => import('@/features/admin-catalog/ShowtimeSeatsPage')),
  // admin-ops
  AdminOrders: lazy(() => import('@/features/admin-ops/AdminOrdersPage')),
  AdminOrderDetail: lazy(() => import('@/features/admin-ops/AdminOrderDetailPage')),
  AdminTickets: lazy(() => import('@/features/admin-ops/AdminTicketsPage')),
  AuditLogs: lazy(() => import('@/features/admin-ops/AuditLogsPage')),
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
    element: <PlainLayout />,
    children: [{ path: '/', element: page(L.Landing) }],
  },
  {
    // Agent mode xem được khi chưa đăng nhập; gửi tin, giữ ghế thì phải đăng nhập (xử lý trong ChatPage).
    element: <AgentLayout />,
    children: [{ path: '/vingo', element: page(L.Agent) }],
  },
  {
    element: <BuyerLayout />,
    children: [
      // Danh sách sự kiện xem được khi chưa đăng nhập; giữ ghế thì phải đăng nhập.
      { path: '/events', element: page(L.Events) },
      { path: '/events/:eventId', element: page(L.EventDetail) },
      { path: '/events/:eventId/showtimes/:showtimeId/seats', element: page(L.SeatSelection) },
      { path: '/orders', element: buyer(L.Orders) },
      { path: '/orders/:orderId', element: buyer(L.OrderDetail) },
      { path: '/orders/:orderId/checkout', element: buyer(L.Checkout) },
      { path: '/payment/vnpay-return', element: buyer(L.PaymentReturn) },
      { path: '/tickets', element: buyer(L.Tickets) },
      { path: '/tickets/:ticketId', element: buyer(L.TicketDetail) },
      { path: '/me', element: buyer(L.Profile) },
      { path: '/me/security', element: buyer(L.AccountSecurity) },
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
      { index: true, element: page(L.Overview) },
      { path: 'reports', element: page(L.Reports) },
      { path: 'venues', element: page(L.Venues) },
      { path: 'venues/:venueId', element: page(L.VenueDetail) },
      { path: 'halls/:hallId/layouts', element: page(L.HallLayouts) },
      { path: 'events', element: page(L.AdminEvents) },
      { path: 'events/:eventId', element: page(L.AdminEventDetail) },
      { path: 'showtimes/:showtimeId/seats', element: page(L.ShowtimeSeats) },
      { path: 'orders', element: page(L.AdminOrders) },
      { path: 'orders/:orderId', element: page(L.AdminOrderDetail) },
      { path: 'tickets', element: page(L.AdminTickets) },
      { path: 'audit-logs', element: page(L.AuditLogs) },
    ],
  },
  {
    // Admin Copilot: màn riêng, ngoài AdminLayout (không sidebar), vẫn chỉ cho ADMIN.
    path: '/admin/copilot',
    element: (
      <RequireAuth allow="ADMIN">
        <CopilotLayout />
      </RequireAuth>
    ),
    children: [{ index: true, element: page(L.Copilot) }],
  },
  { path: '*', element: <NotFoundPage /> },
]

export const router = createBrowserRouter(routes)
