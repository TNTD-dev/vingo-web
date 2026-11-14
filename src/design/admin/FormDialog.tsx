import type { ReactNode } from 'react'
import { Dialog as Primitive } from 'radix-ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/design/ui/dialog'

export function FormDialog({
  title,
  children,
  onClose,
  pending,
  side = false,
  caption,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  pending: boolean
  side?: boolean
  caption?: string
}) {
  if (side)
    return (
      <Dialog
        open
        modal={false}
        onOpenChange={(v) => {
          if (!v && !pending) onClose()
        }}
      >
        <Primitive.Portal>
          <Primitive.Content
            className="admin admin-dialog admin-form-dialog admin-side-dialog"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <p className="admin-caption">{caption}</p>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">Các trường có dấu * là bắt buộc.</DialogDescription>
            <Primitive.Close className="admin-dialog-close" disabled={pending} aria-label="Đóng">
              ×
            </Primitive.Close>
            <div className="admin-dialog-scroll">{children}</div>
          </Primitive.Content>
        </Primitive.Portal>
      </Dialog>
    )
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !pending) onClose()
      }}
    >
      <DialogContent className="admin admin-dialog admin-form-dialog w-[calc(100vw-2rem)] max-w-2xl bg-surface p-6">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Các trường có dấu * là bắt buộc.</DialogDescription>
        </DialogHeader>
        <div className="admin-dialog-scroll">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
