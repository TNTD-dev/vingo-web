import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import {
  createAttendee,
  deleteAttendee,
  getListAttendeesQueryKey,
  replaceAttendee,
  useListAttendees,
} from '@/api/generated/endpoints/attendees/attendees'
import type { AttendeeProfile, AttendeeRequest } from '@/api/generated/model'
import { isApiError } from '@/api/problem'
import { Button } from '@/design/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/design/ui/dialog'
import { Input } from '@/design/ui/input'
import { normalizeAttendeeDetails, validateAttendee } from '@/lib/attendeeDetails'
import { profileFieldErrors, type ProfileFieldErrors } from '@/lib/profileErrors'

type Action = { kind: 'create' } | { kind: 'edit' | 'delete'; profile: AttendeeProfile }

const fields = [
  ['full_name', 'Họ và tên', 'text'],
  ['email', 'Email', 'email'],
  ['phone', 'Số điện thoại', 'tel'],
] as const

export function AttendeesSection() {
  const list = useListAttendees()
  const [action, setAction] = useState<Action>()
  const heading = useId()

  return (
    <section aria-labelledby={heading} className="mt-6 flex flex-col gap-4 rounded-[20px] bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={heading} className="type-h3">
          Người đi xem
        </h2>
        {list.isSuccess && <Button onClick={() => setAction({ kind: 'create' })}>Thêm người đi xem</Button>}
      </div>
      {list.isPending && <p role="status">Đang tải danh sách người đi xem…</p>}
      {list.isError && (
        <div role="alert">
          <p>Chưa tải được danh sách người đi xem.</p>
          <Button variant="outline" onClick={() => void list.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {list.isSuccess &&
        (list.data.length ? (
          <ul className="divide-y divide-line">
            {list.data.map((profile) => (
              <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 break-words">
                  <p className="type-body-m-strong">{profile.full_name}</p>
                  <p className="type-caption break-all text-ink-secondary">
                    {[profile.email, profile.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    aria-label={`Sửa ${profile.full_name}`}
                    onClick={() => setAction({ kind: 'edit', profile })}
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Xoá ${profile.full_name}`}
                    onClick={() => setAction({ kind: 'delete', profile })}
                  >
                    Xoá
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Chưa có người đi xem đã lưu.</p>
        ))}
      {action && <AttendeeDialog action={action} onClose={() => setAction(undefined)} />}
    </section>
  )
}

function AttendeeDialog({ action, onClose }: { action: Action; onClose: () => void }) {
  const profile = action.kind === 'create' ? undefined : action.profile
  const removing = action.kind === 'delete'
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: getListAttendeesQueryKey() })
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [message, setMessage] = useState('')
  const change = useMutation({
    mutationFn: async (details: AttendeeRequest) => {
      if (action.kind === 'delete') await deleteAttendee(action.profile.id)
      else if (action.kind === 'edit') await replaceAttendee(action.profile.id, details)
      else await createAttendee(details)
    },
    onSuccess: async () => {
      await refresh()
      onClose()
    },
    onError: async (error) => {
      if (isApiError(error) && error.status === 404) {
        toast.info('Hồ sơ người đi xem không còn tồn tại.')
        await refresh()
        onClose()
        return
      }
      setErrors(profileFieldErrors(error))
      setMessage(
        isApiError(error) && error.status === 409
          ? 'Bạn đã lưu đủ 20 người đi xem. Hãy xoá một hồ sơ trước khi thêm.'
          : 'Chưa cập nhật được hồ sơ. Vui lòng kiểm tra lại và thử lại.',
      )
    },
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (change.isPending) return
    const form = new FormData(e.currentTarget)
    const details = normalizeAttendeeDetails({
      full_name: String(form.get('full_name') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
    })
    const found = removing ? {} : validateAttendee(details)
    setErrors(found)
    setMessage('')
    if (!Object.keys(found).length) change.mutate(details)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !change.isPending) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogTitle>{removing ? 'Xoá người đi xem?' : profile ? 'Sửa người đi xem' : 'Thêm người đi xem'}</DialogTitle>
        <DialogDescription>
          {removing
            ? `Xoá hồ sơ của ${profile?.full_name} khỏi danh sách đã lưu?`
            : 'Họ và tên là bắt buộc. Email và số điện thoại là tuỳ chọn.'}
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={change.isPending} className="grid min-w-0 gap-4">
            {!removing &&
              fields.map(([key, label, type]) => (
                <label key={key} className="grid gap-1.5 type-caption">
                  {label}
                  <Input
                    name={key}
                    type={type}
                    defaultValue={profile?.[key] ?? ''}
                    required={key === 'full_name'}
                    aria-invalid={!!errors[key]}
                  />
                  {errors[key] && <span className="text-danger">{errors[key]}</span>}
                </label>
              ))}
            {message && (
              <p role="alert" className="type-caption text-danger">
                {message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" variant={removing ? 'destructive' : 'default'}>
                {removing ? 'Xác nhận xoá' : 'Lưu hồ sơ'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
