import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'

import './index.css'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // App mới, traffic thấp: trace 100% page load / điều hướng / request.
    tracesSampleRate: 1.0,
    // Gắn header sentry-trace + baggage vào request /api để nối trace sang backend (cùng domain).
    tracePropagationTargets: [/^\/api\//],
    // Chỉ ghi lại replay khi có lỗi; replay mặc định che chữ và chặn media.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return
  const { worker } = await import('@/mocks/browser')
  await worker.start()
}

void enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
