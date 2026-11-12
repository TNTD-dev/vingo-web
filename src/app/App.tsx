import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'

import { isApiError } from '@/api/problem'
import { AuthProvider } from '@/auth/AuthProvider'
import { Toaster } from '@/design/ui/sonner'

import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Không retry lỗi 4xx (sai quyền, không tồn tại…); chỉ retry lỗi mạng/5xx.
      retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  )
}
