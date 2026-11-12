import { Loader2Icon } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <output className="flex min-h-dvh items-center justify-center" aria-label="Đang tải">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </output>
  )
}
