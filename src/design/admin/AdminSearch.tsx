import { useState } from 'react'
import { Link } from 'react-router'
import { useAdminListOrders, useAdminListTickets } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useListAdminEvents } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/design/ui/dialog'
import { icons } from '@/design/icons'
export function AdminSearch() {
  const [draft, setDraft] = useState(''),
    [q, setQ] = useState(''),
    [open, setOpen] = useState(false),
    enabled = open && q.length >= 3
  const orders = useAdminListOrders({ q, limit: 5 }, { query: { enabled } }),
    tickets = useAdminListTickets({ code: q, limit: 5 }, { query: { enabled } }),
    events = useListAdminEvents({ q, limit: 5 }, { query: { enabled } })
  return (
    <>
      <form
        className="admin-search"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(draft.trim())
          setOpen(true)
        }}
      >
        <img src={icons.search} alt="" width={16} height={16} />
        <input
          id="admin-search"
          aria-label="Tìm đơn, vé, sự kiện"
          minLength={3}
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tìm đơn, vé, sự kiện… ⌘K"
        />
      </form>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="admin admin-dialog">
          <DialogTitle>Kết quả tìm kiếm</DialogTitle>
          <DialogDescription>“{q}” · Đơn và vé được tra cứu theo mã chính xác.</DialogDescription>
          <div className="mt-5 space-y-5">
            {[
              {
                title: 'Đơn hàng',
                query: orders,
                items: orders.data?.data?.map((o) => ({
                  id: o.id,
                  label: `${o.code} · ${o.buyer?.full_name ?? ''}`,
                  to: `/admin/orders/${o.id}`,
                })),
              },
              {
                title: 'Vé',
                query: tickets,
                items: tickets.data?.data?.map((t) => ({
                  id: t.id,
                  label: `${t.code} · ${t.event?.title ?? ''}`,
                  to: `/admin/tickets?code=${encodeURIComponent(t.code ?? '')}`,
                })),
              },
              {
                title: 'Sự kiện',
                query: events,
                items: events.data?.data?.map((e) => ({ id: e.id, label: e.title, to: `/admin/events/${e.id}` })),
              },
            ].map((group) => (
              <section key={group.title}>
                <h2 className="admin-caption mb-2">{group.title}</h2>
                {group.query.isPending ? (
                  <p className="text-xs text-ink-tertiary">Đang tìm…</p>
                ) : group.query.isError ? (
                  <button className="text-xs underline" onClick={() => void group.query.refetch()}>
                    Không tải được. Thử lại
                  </button>
                ) : group.items?.length ? (
                  group.items.map((v) => (
                    <Link
                      key={v.id}
                      className="block rounded-xl px-3 py-3 hover:bg-canvas"
                      to={v.to}
                      onClick={() => setOpen(false)}
                    >
                      {v.label} ↗
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-ink-tertiary">Không tìm thấy kết quả.</p>
                )}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
