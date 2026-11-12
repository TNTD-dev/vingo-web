/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_USE_MOCK?: 'true' | 'false'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_MOCK_ROLE?: 'BUYER' | 'ADMIN'
}
