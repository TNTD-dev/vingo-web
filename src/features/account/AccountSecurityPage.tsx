import { useMutation } from '@tanstack/react-query'
import { Laptop } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { deleteMe, updateMe, useGetMe } from '@/api/generated/endpoints/me/me'
import { useListMyTickets } from '@/api/generated/endpoints/tickets/tickets'
import { isApiError } from '@/api/problem'
import { useAuth } from '@/auth/auth-context'
import { Mascot } from '@/design/Mascot'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { MIN_PASSWORD } from '@/lib/validate'

import { AccountShell } from './AccountShell'

const pill =
  'type-body-m-strong rounded-pill border border-line bg-surface px-4 py-2 text-foreground disabled:opacity-50'

// B17 · Tài khoản & bảo mật (Figma 03 · Buyer): đăng nhập, phiên hiện tại, xoá tài khoản.
export default function AccountSecurityPage() {
  const me = useGetMe()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [changing, setChanging] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-8 pt-1">
      <header className="flex flex-col gap-3 pt-6">
        <p className="type-mono-label text-ink-secondary uppercase">{'// Tài khoản'}</p>
        <h1 className="type-display-l text-foreground max-sm:!text-[40px]">Tài khoản & bảo mật</h1>
      </header>

      <AccountShell>
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-[20px] bg-surface p-6 sm:p-8">
            <h2 className="type-h3 text-foreground">Đăng nhập</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="type-mono-small text-ink-tertiary uppercase">Email</span>
                <span className="type-body-m-strong text-foreground">{me.data?.email ?? '—'}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="type-mono-small text-ink-tertiary uppercase">Mật khẩu</span>
                <span className="type-body-m-strong text-foreground">••••••••</span>
              </div>
              <button type="button" className={pill} onClick={() => setChanging((v) => !v)} aria-expanded={changing}>
                Đổi mật khẩu
              </button>
            </div>
            {changing && <ChangePassword onDone={() => setChanging(false)} />}
          </section>

          <section className="flex flex-col gap-4 rounded-[20px] bg-surface p-6 sm:p-8">
            <h2 className="type-h3 text-foreground">Phiên đăng nhập</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-canvas">
                  <Laptop className="size-4" aria-hidden />
                </span>
                <div className="flex flex-col">
                  <span className="type-body-m-strong text-foreground">Thiết bị này</span>
                  <span className="type-caption text-ink-tertiary">Đang đăng nhập</span>
                </div>
              </div>
              <button
                type="button"
                className={pill}
                onClick={() => {
                  void logout().then(() => navigate('/login', { replace: true }))
                }}
              >
                Đăng xuất
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[20px] border border-danger p-6 sm:p-8">
            <h2 className="type-h3 text-danger">Xoá tài khoản</h2>
            <p className="max-w-[520px] type-body-m text-ink-secondary">
              Xoá vĩnh viễn hồ sơ và lịch sử chat. Vé đã mua cho sự kiện sắp diễn ra vẫn còn hiệu lực đến khi sự kiện
              kết thúc; Vingo không hoàn tiền.
            </p>
            <button type="button" className={`${pill} w-fit`} onClick={() => setConfirmOpen(true)}>
              Xoá tài khoản…
            </button>
          </section>
        </div>
      </AccountShell>

      <DeleteDialog open={confirmOpen} onOpenChange={setConfirmOpen} />
    </div>
  )
}

function ChangePassword({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const save = useMutation({
    mutationFn: () => updateMe({ current_password: current, new_password: next }),
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu')
      onDone()
    },
    onError: (e) =>
      setError(
        isApiError(e) && (e.status === 400 || e.status === 401 || e.status === 403)
          ? 'Mật khẩu hiện tại chưa đúng.'
          : 'Chưa đổi được mật khẩu. Vui lòng thử lại.',
      ),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < MIN_PASSWORD) return setError(`Mật khẩu mới tối thiểu ${MIN_PASSWORD} ký tự.`)
    if (next !== confirm) return setError('Mật khẩu nhập lại chưa khớp.')
    setError(undefined)
    save.mutate()
  }

  const input =
    'type-body-m h-[46px] rounded-[14px] border border-line bg-surface px-4 outline-none focus:border-foreground'
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[16px] bg-canvas p-4">
      <input
        className={input}
        type="password"
        placeholder="Mật khẩu hiện tại"
        aria-label="Mật khẩu hiện tại"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <input
        className={input}
        type="password"
        placeholder="Mật khẩu mới"
        aria-label="Mật khẩu mới"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        required
      />
      <input
        className={input}
        type="password"
        placeholder="Nhập lại mật khẩu mới"
        aria-label="Nhập lại mật khẩu mới"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      {error && (
        <p role="alert" className="type-caption text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={save.isPending}
        className="w-fit rounded-pill bg-ink px-5 py-2.5 type-body-m-strong text-on-ink disabled:opacity-50"
      >
        {save.isPending ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
      </button>
    </form>
  )
}

const CONFIRM_WORD = 'XOÁ'

function DeleteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [text, setText] = useState('')
  const upcoming = useListMyTickets({ when: 'upcoming', limit: 50 }, { query: { enabled: open } })
  const count = (upcoming.data?.data ?? []).filter((t) => t.status === 'ISSUED').length
  const del = useMutation({
    mutationFn: () => deleteMe(),
    onSuccess: async () => {
      toast.success('Đã xoá tài khoản')
      await logout().catch(() => undefined)
      navigate('/', { replace: true })
    },
    onError: () => toast.error('Chưa xoá được tài khoản. Vui lòng thử lại.'),
  })
  const ready = text.trim().toLocaleUpperCase('vi') === CONFIRM_WORD

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setText('')
      }}
    >
      <DialogContent showCloseButton={false} className="max-w-[420px] gap-0 rounded-[28px] p-8 text-center">
        <Mascot state="sorry" className="mx-auto h-[88px] w-auto" />
        <DialogTitle className="mt-5 type-h2 text-foreground">Xoá tài khoản vĩnh viễn?</DialogTitle>
        <DialogDescription className="mt-3 type-caption text-ink-secondary">
          {count > 0
            ? `Bạn còn ${count} vé sắp diễn ra. Vé vẫn dùng được, nhưng bạn sẽ không đăng nhập để xem lại chúng nữa — hãy lưu lại mã QR trước.`
            : 'Hồ sơ và lịch sử chat sẽ bị xoá vĩnh viễn.'}
        </DialogDescription>
        <label className="mt-5 flex flex-col gap-2 text-left">
          <span className="type-mono-small text-ink-secondary uppercase">Gõ {CONFIRM_WORD} để xác nhận</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="h-[46px] rounded-[14px] border border-line px-4 type-body-m outline-none focus:border-foreground"
          />
        </label>
        <div className="mt-5 flex justify-center gap-3">
          <button type="button" className={pill} onClick={() => onOpenChange(false)}>
            Giữ tài khoản
          </button>
          <button
            type="button"
            disabled={!ready || del.isPending}
            onClick={() => del.mutate()}
            className="rounded-pill bg-danger px-5 py-2 type-body-m-strong text-on-ink disabled:opacity-50"
          >
            {del.isPending ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
