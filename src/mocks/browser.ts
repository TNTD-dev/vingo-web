import { http, passthrough } from 'msw'
import { setupWorker } from 'msw/browser'

import { getAdminCatalogMock } from '@/api/generated/endpoints/admin-catalog/admin-catalog.msw'
import { getAdminOperationsMock } from '@/api/generated/endpoints/admin-operations/admin-operations.msw'
import { getAdminReportsMock } from '@/api/generated/endpoints/admin-reports/admin-reports.msw'
import { getAuthMock } from '@/api/generated/endpoints/auth/auth.msw'
import { getBookingMock } from '@/api/generated/endpoints/booking/booking.msw'
import { getChatMock } from '@/api/generated/endpoints/chat/chat.msw'
import { getCheckInMock } from '@/api/generated/endpoints/check-in/check-in.msw'
import { getMeMock } from '@/api/generated/endpoints/me/me.msw'
import { getPaymentMock } from '@/api/generated/endpoints/payment/payment.msw'
import { getSearchMock } from '@/api/generated/endpoints/search/search.msw'
import { getTicketsMock } from '@/api/generated/endpoints/tickets/tickets.msw'

import { adminCatalogHandlers } from './adminCatalog'
import { adminOperationsHandlers } from './adminOperations'
import { agentHandlers } from './agent'
import { authHandlers } from './auth'
import { meStreamHandler } from './sse'

// Handler Orval sinh khớp mọi origin + path (vd. "*" + "/events") nên cũng bắt cả điều hướng trình duyệt tới route SPA cùng tên.
// Cho mọi request tải trang (navigate) đi thẳng tới Vite.
const navigationPassthrough = http.all('*', ({ request }) => (request.mode === 'navigate' ? passthrough() : undefined))

/** Handler viết tay đứng trước để đè handler Orval sinh. */
export const worker = setupWorker(
  navigationPassthrough,
  meStreamHandler,
  ...authHandlers,
  ...adminCatalogHandlers,
  ...adminOperationsHandlers,
  ...agentHandlers,
  ...getAuthMock(),
  ...getMeMock(),
  ...getSearchMock(),
  ...getBookingMock(),
  ...getPaymentMock(),
  ...getTicketsMock(),
  ...getCheckInMock(),
  ...getChatMock(),
  ...getAdminCatalogMock(),
  ...getAdminOperationsMock(),
  ...getAdminReportsMock(),
)
