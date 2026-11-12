import { Link } from 'react-router'

import { Button } from '@/design/ui/button'

function StatusPage({ code, message }: { code: string; message: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-semibold">{code}</p>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return <StatusPage code="404" message="Không tìm thấy trang." />
}

export function ForbiddenPage() {
  return <StatusPage code="403" message="Bạn không có quyền vào trang này." />
}
