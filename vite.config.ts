import path from 'node:path'

import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend Spring Boot chạy ở :8080, base path /api/v1 giữ nguyên (không rewrite).
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:8080'
  // Có token (CI) thì sinh source map, upload lên Sentry rồi xoá khỏi dist; không có thì bỏ qua.
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN

  return {
    plugins: [
      react(),
      tailwindcss(),
      sentryVitePlugin({
        org: 'vingo-pv',
        project: 'vingo-web',
        authToken: sentryAuthToken,
        disable: !sentryAuthToken,
        telemetry: false,
        release: { name: env.SENTRY_RELEASE || undefined },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      }),
    ],
    build: {
      // hidden: không gắn sourceMappingURL vào bundle, map chỉ để upload.
      sourcemap: sentryAuthToken ? 'hidden' : false,
    },
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: {
      // Khớp AUTH_FRONTEND_RETURN_URL mặc định của backend: http://localhost:3000/auth/google
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
  }
})
