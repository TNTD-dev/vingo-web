import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useAdminListOrders, adminListOrders } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { OrderStatus, type Order } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, Table, StateBadge, Tabs, Pager, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { useCursor, csvText, download } from '@/design/admin/data'
import { formatVnd } from '@/lib/money'
import OrderReviewPanel from './OrderReviewPanel'

export default function AdminOrdersPage() {
  const [params, setParams] = useSearchParams(),
    { orderId } = useParams(),
    [selection, setSelection] = useState<string | null | undefined>()
  const status = Object.values(OrderStatus).find(
    (s) => s === (params.get('status') ?? (params.get('q') || orderId ? '' : 'NEEDS_REVIEW')),
  )
  const filters = { status, q: params.get('q') || undefined, event_id: params.get('event_id') || undefined },
    paging = useCursor(JSON.stringify(filters))
  const query = useAdminListOrders({ ...filters, cursor: paging.cursor, limit: 20 })
  const selected = orderId ?? (selection === undefined ? query.data?.data?.[0]?.id : selection)
  const csv = useMutation({
    mutationFn: async () => {
      const all: Order[] = []
      let cursor: string | undefined
      do {
        const page = await adminListOrders({ ...filters, cursor, limit: 100 })
        all.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      download(
        csvText([
          ['Mã đơn', 'Người mua', 'Sự kiện', 'Trạng thái', 'Lý do', 'Số tiền'],
          ...all.map((o) => [o.code, o.buyer?.full_name, o.event?.title, o.status, o.review_reason, o.total_amount]),
        ]),
        'vingo-orders.csv',
      )
    },
  })
  return (
    <AdminPage
      title="Đơn hàng"
      caption="// BÁN VÉ · ĐƠN HÀNG"
      actions={
        <AdminAction secondary disabled={csv.isPending} onClick={() => csv.mutate()}>
          {csv.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </AdminAction>
      }
    >
      <ErrorNotice error={csv.error} />
      <div className={selected ? 'admin-orders-grid' : ''}>
        <div>
          <Tabs
            value={status ?? ''}
            onChange={(v) => {
              setSelection(undefined)
              setParams((p) => {
                p.set('status', v)
                return p
              })
            }}
            items={[
              { value: '', label: 'Tất cả' },
              ...Object.values(OrderStatus).map((value) => ({ value, label: value })),
            ]}
          />
          {params.get('q') && (
            <p className="mb-4 text-sm">
              Kết quả cho “{params.get('q')}”{' '}
              <button
                className="ml-2 underline"
                onClick={() =>
                  setParams((p) => {
                    p.delete('q')
                    return p
                  })
                }
              >
                Bỏ lọc
              </button>
            </p>
          )}
          <Panel className="admin-table-panel">
            <QueryState query={query} empty={!query.data?.data?.length}>
              <Table
                label="Danh sách đơn hàng"
                headings={[
                  'Mã',
                  'Người mua · sự kiện',
                  status === 'NEEDS_REVIEW' ? 'Lý do' : 'Trạng thái',
                  'Số tiền',
                  '',
                ]}
              >
                {query.data?.data?.map((o) => (
                  <tr key={o.id} className={selected === o.id ? 'admin-row-selected' : ''}>
                    <td className="font-mono text-[11px] whitespace-nowrap">#{o.code}</td>
                    <td>
                      <strong className="text-sm">{o.buyer?.full_name ?? '—'}</strong>
                      <p className="mt-1 max-w-48 truncate text-xs text-ink-tertiary" title={o.event?.title}>
                        {o.event?.title} · {o.items?.reduce((sum, v) => sum + (v.quantity ?? 1), 0) ?? 0} vé
                      </p>
                    </td>
                    <td>
                      <StateBadge value={status === 'NEEDS_REVIEW' ? o.review_reason : o.status} />
                    </td>
                    <td className="whitespace-nowrap">{formatVnd(o.total_amount ?? 0)}</td>
                    <td>
                      {orderId ? (
                        <Link to={`/admin/orders/${o.id}`} aria-label={`Xử lý ${o.code}`}>
                          ›
                        </Link>
                      ) : (
                        <button
                          className="admin-more"
                          aria-label={`Xử lý ${o.code}`}
                          onClick={() => setSelection(o.id)}
                        >
                          ›
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
              <Pager
                cursor={query.data?.next_cursor}
                previous={paging.previous}
                next={() => paging.next(query.data!.next_cursor!)}
                busy={query.isFetching}
              />
            </QueryState>
          </Panel>
        </div>
        {selected && <OrderReviewPanel key={selected} orderId={selected} onClose={() => setSelection(null)} />}
      </div>
    </AdminPage>
  )
}
