import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createHall, updateVenue, deleteVenue } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { Venue, VenueCreateInput } from '@/api/generated/model'
import { Panel, Field, ErrorNotice, ConfirmDialog } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { FormDialog, VenueForm } from './CatalogForms'
import { toast } from 'sonner'
export default function VenueHalls({ venue, hallId }: { venue?: Venue; hallId: string }) {
  const client = useQueryClient(),
    navigate = useNavigate(),
    [mode, setMode] = useState<'hall' | 'edit' | 'delete' | null>(null),
    [name, setName] = useState('')
  const hall = useMutation({
    mutationFn: () => createHall(venue!.id!, { name: name.trim() }),
    onSuccess: async (h) => {
      setMode(null)
      setName('')
      await client.invalidateQueries()
      navigate(`/admin/halls/${h.id}/layouts?venueId=${venue!.id}`)
      toast.success('Đã thêm hall')
    },
  })
  const save = useMutation({
    mutationFn: (d: VenueCreateInput) => updateVenue(venue!.id!, d),
    onSuccess: async () => {
      setMode(null)
      await client.invalidateQueries()
      toast.success('Đã lưu địa điểm')
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteVenue(venue!.id!),
    onSuccess: async () => {
      await client.invalidateQueries()
      navigate('/admin/venues')
      toast.success('Đã xóa địa điểm')
    },
  })
  return (
    <>
      <Panel>
        <h2>Hall / khu vực</h2>
        <div className="mb-4">
          {venue?.halls?.map((h) => (
            <Link
              key={h.id}
              to={`/admin/halls/${h.id}/layouts?venueId=${venue.id}`}
              className="admin-hall-link"
              aria-current={hallId === h.id ? 'page' : undefined}
            >
              {h.name}
              <small>Quản lý phiên bản sơ đồ</small>
            </Link>
          ))}
        </div>
        <Button
          variant="outline"
          className="admin-small-button w-full"
          disabled={!venue?.id}
          onClick={() => {
            hall.reset()
            setMode('hall')
          }}
        >
          + Thêm hall
        </Button>
        <div className="mt-5 space-y-3">
          <p className="text-xs leading-relaxed text-ink-secondary">{venue?.address}</p>
          <button
            className="text-xs underline"
            onClick={() => {
              save.reset()
              setMode('edit')
            }}
          >
            Sửa thông tin sân
          </button>
          <button
            className="ml-4 text-xs text-danger underline"
            onClick={() => {
              remove.reset()
              setMode('delete')
            }}
          >
            Xóa sân
          </button>
        </div>
      </Panel>
      {mode === 'hall' && (
        <FormDialog title="Thêm hall" pending={hall.isPending} onClose={() => setMode(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              hall.mutate()
            }}
          >
            <Field label="Tên hall *">
              <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <ErrorNotice error={hall.error} />
            <Button disabled={hall.isPending || !name.trim()}>Thêm hall</Button>
          </form>
        </FormDialog>
      )}
      {mode === 'edit' && venue && (
        <FormDialog title="Thông tin sân" pending={save.isPending} onClose={() => setMode(null)}>
          <VenueForm initial={venue} pending={save.isPending} error={save.error} onSubmit={(d) => save.mutate(d)} />
        </FormDialog>
      )}
      {mode === 'delete' && (
        <ConfirmDialog
          open
          title="Xóa sân?"
          description="Chỉ xóa được địa điểm chưa được sử dụng. Dữ liệu đã xóa không thể khôi phục."
          requireReason={false}
          pending={remove.isPending}
          error={remove.error}
          onClose={() => setMode(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  )
}
