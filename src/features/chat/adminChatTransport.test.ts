import { expect, it } from 'vitest'

import { adminBlock, readFrame } from './adminChatTransport'

it('đọc thẻ xác nhận từ SSE và từ lịch sử lưu trực tiếp', () => {
  const payload = { action_id: 'demo', version: 1, confirm_phrase: 'Demo Concert' }
  const frame = readFrame(
    JSON.stringify({
      turn_id: 'turn',
      seq: 2,
      type: 'block',
      payload: {
        type: 'ConfirmAction',
        payload,
      },
    }),
  )
  expect(adminBlock(frame.payload, 'turn-2')).toEqual({ id: 'turn-2', type: 'ConfirmAction', payload })
  expect(adminBlock({ type: 'ConfirmAction', ...payload }, 'history')?.payload).toEqual(payload)
})
