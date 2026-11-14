import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createVenue } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import type { VenueCreateInput } from '@/api/generated/model'
import { AdminPage, QueryState, Tabs } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { icons } from '@/design/icons'
import more from '@/design/admin/icons/more.svg'
import stadium from '@/design/admin/assets/stadium.png'
import theater from '@/design/admin/assets/theater.png'
import concert from '@/design/admin/assets/concert.png'
import stands from '@/design/admin/assets/stands.png'
import garden from '@/design/admin/assets/garden.png'
import { FormDialog, VenueForm } from './CatalogForms'
import { cities, useVenueDirectory } from './catalog'
import { toast } from 'sonner'

const photos: Record<string, string> = {
  '0193c100-0000-7000-8000-000000000001': stadium,
  '0193c100-0000-7000-8000-000000000002': theater,
  '0193c100-0000-7000-8000-000000000003': concert,
  '0193c100-0000-7000-8000-000000000004': stands,
  '0193c100-0000-7000-8000-000000000005': garden,
  '0193c100-0000-7000-8000-000000000006': stadium,
}
export default function VenuesPage() {
  const query = useVenueDirectory(),
    client = useQueryClient(),
    navigate = useNavigate()
  const [create, setCreate] = useState(false),
    [city, setCity] = useState('')
  const mutation = useMutation({
    mutationFn: (data: VenueCreateInput) => createVenue(data),
    onSuccess: async (v) => {
      setCreate(false)
      toast.success('Đã tạo sân')
      await client.invalidateQueries()
      if (v.id) navigate(`/admin/venues/${v.id}`)
    },
  })
  const venues = query.data?.filter((v) => !city || v.city === city)
  return (
    <AdminPage
      title="Sân & địa điểm"
      caption={`// CATALOG · ${query.data?.length ?? '—'} SÂN`}
      actions={
        <AdminAction
          onClick={() => {
            mutation.reset()
            setCreate(true)
          }}
        >
          Thêm sân
        </AdminAction>
      }
    >
      <Tabs
        value={city}
        onChange={setCity}
        items={[
          { value: '', label: `Tất cả · ${query.data?.length ?? 0}` },
          ...Object.entries(cities).map(([value, label]) => ({
            value,
            label: `${label} · ${query.data?.filter((v) => v.city === value).length ?? 0}`,
          })),
        ]}
      />
      <QueryState query={query} empty={!venues?.length}>
        <div className="admin-venues">
          {venues?.map((v, i) => (
            <article className="admin-venue-card" key={v.id}>
              <Link to={`/admin/venues/${v.id}`} aria-label={`Quản lý ${v.name}`} className="admin-venue-photo">
                {import.meta.env.VITE_USE_MOCK === 'true' && photos[v.id ?? ''] ? (
                  <img src={photos[v.id ?? '']} alt="" />
                ) : (
                  <span className="admin-venue-placeholder">{v.name}</span>
                )}
                <span className="admin-venue-type">
                  <i />
                  {v.type}
                </span>
              </Link>
              <div className="admin-venue-info">
                <Link to={`/admin/venues/${v.id}`}>
                  <h2>{v.name}</h2>
                </Link>
                <p>
                  <img src={icons.pin} alt="" width={14} height={14} />
                  {v.city ? cities[v.city] : v.city_name}
                  {v.district ? ` · ${v.district}` : ''}
                </p>
                <div className="admin-venue-footer">
                  <span>{v.halls?.length ?? 0} HALL</span>
                  <Link to={`/admin/venues/${v.id}`} className="admin-more" aria-label={`Chi tiết ${v.name ?? i}`}>
                    <img src={more} alt="" width={18} height={18} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </QueryState>
      {create && (
        <FormDialog
          title="Sân mới"
          caption="// THÊM SÂN"
          side
          pending={mutation.isPending}
          onClose={() => setCreate(false)}
        >
          <VenueForm
            compact
            pending={mutation.isPending}
            error={mutation.error}
            onCancel={() => setCreate(false)}
            onSubmit={(d) => mutation.mutate(d)}
          />
        </FormDialog>
      )}
    </AdminPage>
  )
}
