import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminListUsers,
  adminUserStatistics,
  adminUserLoginHistory,
  adminUpdateUser,
  exportAdminUsers,
} from '@/api/generated/endpoints/admin-accounts/admin-accounts'
import { listAuditLogs } from '@/api/generated/endpoints/admin-operations/admin-operations'
import type { AdminAccount, AdminListUsersParams } from '@/api/generated/model'
import { AdminPage, Panel, Field, Table, QueryState, ErrorNotice } from '@/design/admin/AdminUi'
import { Button } from '@/design/ui/button'
import { dateText, download } from '@/design/admin/data'

const statusNames = { ACTIVE: 'Đang hoạt động', UNVERIFIED: 'Chờ xác minh', LOCKED: 'Bị khóa', DELETED: 'Đã xóa' }

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<AdminListUsersParams>({ sort: 'newest' })
  const [selected, setSelected] = useState<AdminAccount>()
  const statistics = useQuery({ queryKey: ['admin-user-statistics'], queryFn: () => adminUserStatistics() })
  const users = useInfiniteQuery({
    queryKey: ['admin-users', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => adminListUsers({ ...filters, cursor: pageParam, limit: 20 }, { signal }),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
  })
  const csv = useMutation({
    mutationFn: async () => {
      const text = await exportAdminUsers({ q: filters.q, role: filters.role, status: filters.status })
      download(text, 'vingo-users.csv')
    },
  })
  return (
    <AdminPage
      title="Quản lý người dùng"
      caption="Tài khoản, quyền và lịch sử quản trị"
      actions={
        <Button onClick={() => csv.mutate()} disabled={csv.isPending}>
          Xuất danh sách
        </Button>
      }
    >
      <ErrorNotice error={csv.error} />
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Tìm người dùng">
            <input
              value={filters.q ?? ''}
              placeholder="Tên, email hoặc số điện thoại"
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </Field>
          <Field label="Vai trò">
            <select
              value={filters.role ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, role: (e.target.value || undefined) as AdminListUsersParams['role'] })
              }
            >
              <option value="">Tất cả</option>
              <option value="BUYER">Khách hàng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, status: (e.target.value || undefined) as AdminListUsersParams['status'] })
              }
            >
              <option value="">Tất cả</option>
              {Object.entries(statusNames).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sắp xếp">
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as AdminListUsersParams['sort'] })}
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name">Tên A–Z</option>
            </select>
          </Field>
        </div>
        <QueryState query={statistics}>
          {statistics.data && (
            <p className="mt-4 text-sm">
              Toàn hệ thống: {statistics.data.total} · Hoạt động: {statistics.data.active} · Chờ xác minh:{' '}
              {statistics.data.unverified} · Bị khóa: {statistics.data.locked} · Đã xóa: {statistics.data.deleted}
            </p>
          )}
        </QueryState>
      </Panel>
      <Panel>
        <QueryState query={users} empty={!users.data?.pages.some((p) => p.data.length)}>
          <Table label="Người dùng" headings={['Người dùng', 'Email', 'Vai trò', 'Trạng thái', '']}>
            {users.data?.pages
              .flatMap((p) => p.data)
              .map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="size-9 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="flex size-9 items-center justify-center rounded-full bg-canvas">
                          {user.full_name.slice(0, 1)}
                        </span>
                      )}
                      <span>{user.full_name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}</td>
                  <td>{statusNames[user.status]}</td>
                  <td>
                    <Button variant="outline" onClick={() => setSelected(user)}>
                      Quản lý
                    </Button>
                  </td>
                </tr>
              ))}
          </Table>
          {users.hasNextPage && (
            <Button disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
              Tải thêm
            </Button>
          )}
        </QueryState>
      </Panel>
      {selected && (
        <UserDetails key={selected.id} user={selected} close={() => setSelected(undefined)} update={setSelected} />
      )}
    </AdminPage>
  )
}

function UserDetails({
  user,
  close,
  update,
}: {
  user: AdminAccount
  close: () => void
  update: (u: AdminAccount) => void
}) {
  const [tab, setTab] = useState('account')
  const [role, setRole] = useState(user.role)
  const [locked, setLocked] = useState(user.admin_locked)
  const [reason, setReason] = useState('')
  const cache = useQueryClient()
  const save = useMutation({
    mutationFn: () => adminUpdateUser(user.id, { role, locked, reason }),
    onSuccess: async (data) => {
      update(data)
      setReason('')
      await cache.invalidateQueries({ queryKey: ['admin-users'] })
      await cache.invalidateQueries({ queryKey: ['admin-user-statistics'] })
      await cache.invalidateQueries({ queryKey: ['user-admin-history', user.id] })
    },
  })
  const logins = useInfiniteQuery({
    queryKey: ['user-login-history', user.id],
    enabled: tab === 'logins',
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => adminUserLoginHistory(user.id, { cursor: pageParam, limit: 20 }, { signal }),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
  })
  const history = useInfiniteQuery({
    queryKey: ['user-admin-history', user.id],
    enabled: tab === 'history',
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listAuditLogs({ entity: 'users', entity_id: user.id, cursor: pageParam, limit: 20 }, { signal }),
    getNextPageParam: (p) => p.next_cursor ?? undefined,
  })
  return (
    <Panel className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2>{user.full_name}</h2>
        <Button variant="outline" onClick={close}>
          Đóng chi tiết
        </Button>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Chi tiết người dùng">
        {[
          ['account', 'Thông tin & quyền'],
          ['logins', 'Lịch sử đăng nhập'],
          ['history', 'Lịch sử quản trị'],
        ].map(([key, label]) => (
          <Button key={key} variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </nav>
      {tab === 'account' && (
        <>
          <p>Mã người dùng: {user.id}</p>
          <p>
            {user.email} · {user.phone || 'Chưa có số điện thoại'} · Tạo {dateText(user.created_at)}
          </p>
          <Field label="Vai trò">
            <select value={role} onChange={(e) => setRole(e.target.value as AdminAccount['role'])}>
              <option value="BUYER">Khách hàng</option>
              <option value="ADMIN" disabled={!user.has_password}>
                Quản trị viên
              </option>
            </select>
          </Field>
          <label className="flex gap-2">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            Khóa bởi quản trị viên
          </label>
          <Field label="Lý do thay đổi (bắt buộc)">
            <textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <ErrorNotice error={save.error} />
          <Button
            disabled={!reason.trim() || save.isPending || !['ACTIVE', 'LOCKED'].includes(user.status)}
            onClick={() => save.mutate()}
          >
            Lưu thay đổi
          </Button>
        </>
      )}
      {tab === 'logins' && (
        <QueryState query={logins} empty={!logins.data?.pages.some((p) => p.data.length)}>
          <Table label="Đăng nhập" headings={['Thời gian Việt Nam', 'Kết quả']}>
            {logins.data?.pages
              .flatMap((p) => p.data)
              .map((row) => (
                <tr key={row.id}>
                  <td>{dateText(row.at)}</td>
                  <td>{row.success ? 'Thành công' : 'Thất bại'}</td>
                </tr>
              ))}
          </Table>
          {logins.hasNextPage && (
            <Button onClick={() => void logins.fetchNextPage()} disabled={logins.isFetchingNextPage}>
              Tải thêm
            </Button>
          )}
        </QueryState>
      )}
      {tab === 'history' && (
        <QueryState query={history} empty={!history.data?.pages.some((p) => p.data?.length)}>
          <Table label="Lịch sử quản trị" headings={['Thời gian', 'Người thực hiện', 'Thao tác', 'Lý do']}>
            {history.data?.pages
              .flatMap((p) => p.data ?? [])
              .map((row) => (
                <tr key={row.id}>
                  <td>{dateText(row.at)}</td>
                  <td>{row.actor_name || row.actor_id}</td>
                  <td>{row.action}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
          </Table>
          {history.hasNextPage && (
            <Button onClick={() => void history.fetchNextPage()} disabled={history.isFetchingNextPage}>
              Tải thêm
            </Button>
          )}
        </QueryState>
      )}
    </Panel>
  )
}
