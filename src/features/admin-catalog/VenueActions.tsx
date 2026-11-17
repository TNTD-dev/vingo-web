import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ellipsis } from 'lucide-react'
import type { Venue } from '@/api/generated/model'
import { deleteVenue } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { Button } from '@/design/ui/button'
import { ConfirmDialog } from '@/design/admin/AdminUi'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/design/ui/dropdown-menu'

export function VenueActions({ venue }: { venue: Venue }) {
  const [mode, setMode] = useState<'delete' | null>(null)
  const client = useQueryClient(),
    navigate = useNavigate()
  const remove = useMutation({
    mutationFn: () => deleteVenue(venue.id!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin-venue-directory'] })
      navigate('/admin/venues')
      toast.success('Đã xóa sân')
    },
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Thao tác sân">
            <Ellipsis size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              remove.reset()
              setMode('delete')
            }}
          >
            Xóa sân
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {mode === 'delete' && (
        <ConfirmDialog
          open
          title="Xóa sân?"
          description="Chỉ xóa được sân chưa được sử dụng. Dữ liệu đã xóa không thể khôi phục."
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
