/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEOAPIFY_TILE_KEY?: string
  readonly VITE_API_BASE?: string
  readonly VITE_USE_MOCK?: 'true' | 'false'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_MOCK_ROLE?: 'BUYER' | 'ADMIN'
}
