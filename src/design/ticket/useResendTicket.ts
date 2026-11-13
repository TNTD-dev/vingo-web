import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { resendMyTicket } from '@/api/generated/endpoints/tickets/tickets'

import { resendErrorMessage } from './resend'

/** Gửi lại email vé cho một hay nhiều vé (backend trả 202, email đi qua outbox). */
export function useResendTicket() {
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => resendMyTicket(id)))
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed) throw failed.reason
    },
    onSuccess: () => toast.success('Đã gửi lại vé qua email'),
    onError: (e) => toast.error(resendErrorMessage(e)),
  })
}
