import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useListAuditLogs, listAuditLogs } from '@/api/generated/endpoints/admin-operations/admin-operations'
import type { AuditLog } from '@/api/generated/model'
import { AdminPage, Panel, QueryState, Table, Pager, ErrorNotice } from '@/design/admin/AdminUi'
import { AdminAction } from '@/design/admin/AdminAction'
import { useCursor, dateText, csvText, download } from '@/design/admin/data'
import { safeAuditJson } from './audit'
export default function AuditLogsPage() {
  const [params, setParams] = useSearchParams(),
    [selectedId, setSelectedId] = useState(''),
    paging = useCursor(params.toString())
  const filters = { entity: params.get('entity') || undefined, entity_id: params.get('entity_id') || undefined },
    query = useListAuditLogs({ ...filters, cursor: paging.cursor, limit: 20 })
  const selected = query.data?.data?.find((a) => a.id === selectedId) ?? query.data?.data?.[0]
  const csv = useMutation({
    mutationFn: async () => {
      const all: AuditLog[] = []
      let cursor: string | undefined
      do {
        const page = await listAuditLogs({ ...filters, cursor, limit: 100 })
        all.push(...(page.data ?? []))
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      download(
        csvText([
          ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'ID', 'Nguồn', 'Trước', 'Sau'],
          ...all.map((a) => [
            a.at,
            a.actor_id,
            a.action,
            a.entity,
            a.entity_id,
            a.via_agent ? 'Agent' : 'Admin',
            safeAuditJson(a.before),
            safeAuditJson(a.after),
          ]),
        ]),
        'vingo-audit.csv',
      )
    },
  })
  return (
    <AdminPage
      title="Nhật ký audit"
      caption="// HỆ THỐNG · CHỈ ĐỌC"
      actions={
        <AdminAction secondary disabled={csv.isPending} onClick={() => csv.mutate()}>
          {csv.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </AdminAction>
      }
    >
      <ErrorNotice error={csv.error} />
      {filters.entity && (
        <p className="mb-4 text-xs">
          Đối tượng: {filters.entity}{' '}
          <button className="ml-2 underline" onClick={() => setParams({})}>
            Bỏ lọc
          </button>
        </p>
      )}
      <div className="admin-audit-grid">
        <Panel className="admin-table-panel">
          <QueryState query={query} empty={!query.data?.data?.length}>
            <Table
              label="Nhật ký quản trị"
              headings={['Thời gian', 'Người thực hiện', 'Hành động · đối tượng', 'Mã nhật ký']}
            >
              {query.data?.data?.map((a) => (
                <tr key={a.id} className={selected?.id === a.id ? 'admin-row-selected' : ''}>
                  <td className="font-mono text-[11px] whitespace-nowrap">{dateText(a.at)}</td>
                  <td>
                    <span className="block max-w-24 truncate text-xs" title={a.actor_id}>
                      {a.via_agent ? 'Tác nhân tự động' : (a.actor_id ?? 'Hệ thống')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="flex items-center gap-2 text-left"
                      onClick={() => setSelectedId(a.id ?? '')}
                      aria-label={`Xem ${a.action} ${a.id}`}
                    >
                      <span
                        className={`admin-audit-badge ${a.via_agent ? 'is-agent' : selected?.id === a.id ? 'is-selected' : ''}`}
                      >
                        ● {a.action}
                      </span>
                      <span className="max-w-32 truncate text-xs" title={a.entity_id}>
                        {a.entity} · {a.entity_id}
                      </span>
                    </button>
                  </td>
                  <td className="text-right">
                    <button
                      className="max-w-24 truncate font-mono text-[11px]"
                      title={a.id}
                      onClick={() => setSelectedId(a.id ?? '')}
                    >
                      {a.id}
                    </button>
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
        {selected && (
          <aside className="admin-audit-detail">
            <p className="admin-caption">// CHI TIẾT</p>
            <h2>{selected.action}</h2>
            <p className="mb-4 text-xs break-all text-white/50">
              {selected.entity} · {selected.entity_id}
            </p>
            <pre>{safeAuditJson({ before: selected.before, after: selected.after })}</pre>
            {selected.reason && <p className="mt-4 text-xs leading-relaxed text-white/60">{selected.reason}</p>}
          </aside>
        )}
      </div>
    </AdminPage>
  )
}
