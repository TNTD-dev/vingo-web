import { useGetMe } from '@/api/generated/endpoints/me/me'
import { QueryDump } from '@/design/QueryState'
import { Placeholder } from '@/design/Placeholder'

export default function ProfilePage() {
  const query = useGetMe()
  return (
    <Placeholder title="Tài khoản" operations={['getMe', 'updateMe', 'getBuyerProfile', 'putBuyerProfile', 'deleteMe']}>
      <QueryDump query={query} />
    </Placeholder>
  )
}
