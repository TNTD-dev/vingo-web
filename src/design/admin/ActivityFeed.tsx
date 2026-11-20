import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '@/api/generated/endpoints/admin-operations/admin-operations'
import { QueryState } from '@/design/admin/AdminUi'
import { dateText } from '@/design/admin/data'

const operationNames: Record<string, string> = {
  createVenue: 'Thêm sân',
  updateVenue: 'Cập nhật sân',
  deleteVenue: 'Ngừng sử dụng sân',
  createEvent: 'Tạo sự kiện',
  updateEvent: 'Cập nhật sự kiện',
  publishEvent: 'Công bố sự kiện',
  cancelEvent: 'Hủy sự kiện',
  createShowtime: 'Tạo suất diễn',
  updateShowtime: 'Cập nhật suất diễn',
  publishSeatLayout: 'Công bố sơ đồ',
  adminUpdateUser: 'Cập nhật tài khoản',
  blockSeats: 'Khóa ghế',
  unblockSeats: 'Mở khóa ghế',
  voidTicket: 'Vô hiệu vé',
  reissueTicketQr: 'Cấp lại QR',
  adminResendTicket: 'Yêu cầu gửi lại vé',
  checkIn: 'Soát vé',
  putPriceTiers: 'Cập nhật hạng giá',
  putZonePrices: 'Gán giá theo khu',
  completeVenueImport: 'Hoàn tất nhập sơ đồ',
}

export function ActivityFeed() {
  const query = useQuery({
    queryKey: ['admin-activity-feed'],
    queryFn: ({ signal }) => listAuditLogs({ activity_only: true, limit: 8 }, { signal }),
    staleTime: 30000,
  })
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2>Hoạt động quản trị</h2>
        <Link to="/admin/audit-logs">Xem tất cả</Link>
      </div>
      <QueryState query={query} empty={!query.data?.data?.length}>
        {query.data?.data?.map((row) => {
          const details = row.after as Record<string, unknown> | undefined
          const operation = typeof details?.operation === 'string' ? details.operation : (row.action ?? '')
          const ids =
            details?.target_ids && typeof details.target_ids === 'object' ? Object.values(details.target_ids) : []
          if (!ids.length && details?.result_ids && typeof details.result_ids === 'object')
            ids.push(...Object.values(details.result_ids))
          return (
            <div key={row.id} className="border-b border-line py-3">
              <p>
                <strong>{row.actor_name || row.actor_id}</strong> · {operationNames[operation] || operation}
              </p>
              {ids.length > 0 && (
                <p className="truncate text-xs text-muted">
                  Đối tượng: {typeof details?.result_label === 'string' ? details.result_label + ' · ' : ''}
                  {ids.join(', ')}
                </p>
              )}
              <p className="text-xs text-muted">{dateText(row.at)}</p>
            </div>
          )
        })}
      </QueryState>
    </>
  )
}
