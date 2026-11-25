import { Button } from '@/design/ui/button'

import { useAuth } from './auth-context'

export function SessionError() {
  const { retry } = useAuth()
  return (
    <div className="grid place-content-center gap-4 p-6 text-center">
      <p role="alert">Chưa kiểm tra được phiên đăng nhập. Vui lòng thử lại.</p>
      <Button onClick={retry}>Thử lại</Button>
    </div>
  )
}
