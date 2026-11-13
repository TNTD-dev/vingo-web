import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Backend Spring Boot chạy ở :8080, base path /api/v1 giữ nguyên (không rewrite).
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react(), tailwindcss()],
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
