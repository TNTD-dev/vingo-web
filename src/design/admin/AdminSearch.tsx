import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router'
import { useAdminListOrders, useAdminListTickets } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { useListAdminEvents } from '@/api/generated/endpoints/admin-catalog/admin-catalog'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/design/ui/dialog'
import { icons } from '@/design/icons'
/** Phạm vi tìm trong một danh sách: chip “Trong: …”; xoá chip hoặc ⌘K thì tìm toàn hệ thống. */
export type SearchScope = { label: string; placeholder: string; value: string; onChange: (value: string) => void }

export function AdminSearch({ scope }: { scope?: SearchScope }) {
  const [scoped, setScoped] = useState(!!scope),
    input = useRef<HTMLInputElement>(null),
    inScope = scoped && !!scope
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        scope?.onChange('')
        setScoped(false)
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scope])
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
        className={inScope ? 'admin-search wz-scoped' : 'admin-search'}
        onSubmit={(e) => {
          e.preventDefault()
          if (inScope) return
          setQ(draft.trim())
          setOpen(true)
        }}
      >
        <img src={icons.search} alt="" width={16} height={16} />
        {inScope && (
          <span className="wz-scope-chip">
            Trong: {scope.label}
            <button
              type="button"
              aria-label={`Bỏ phạm vi ${scope.label}, tìm toàn hệ thống`}
              onClick={() => {
                scope.onChange('')
                setScoped(false)
                input.current?.focus()
              }}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        )}
        <input
          ref={input}
          id="admin-search"
          aria-label={inScope ? `Tìm trong ${scope.label}` : 'Tìm đơn, vé, sự kiện'}
          minLength={inScope ? undefined : 3}
          required={!inScope}
          value={inScope ? scope.value : draft}
          onChange={(e) => (inScope ? scope.onChange(e.target.value) : setDraft(e.target.value))}
          placeholder={inScope ? scope.placeholder : 'Tìm đơn, vé, sự kiện… ⌘K'}
        />
        {inScope && <kbd>⌘K</kbd>}
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
