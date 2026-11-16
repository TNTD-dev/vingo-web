import { useQuery } from '@tanstack/react-query'

import { isApiError } from '@/api/problem'
import { getTicketQr } from '@/api/generated/endpoints/tickets/tickets'

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Tải ảnh QR của vé (cần Bearer nên không dùng thẻ img trỏ thẳng URL) và trả về data URL. */
export function useTicketQr(ticketId: string | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ['ticket-qr', ticketId],
    queryFn: async () => toDataUrl(await getTicketQr(ticketId!)),
    enabled: enabled && !!ticketId,
    staleTime: 60_000,
    // Lỗi API (vd. 501 chưa làm, 404) không tự khỏi nhờ thử lại; chỉ thử lại lỗi mạng.
    retry: (count, error) => !isApiError(error) && count < 2,
  })
  return {
    url: query.data,
    isPending: query.isPending && query.fetchStatus !== 'idle',
    isError: query.isError,
    error: query.error,
  }
}
