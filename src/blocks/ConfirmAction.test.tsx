import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ConfirmAction } from './ConfirmAction'

it('chỉ gửi xác nhận khi cụm từ khớp và giữ đúng version của thẻ', async () => {
  const onDecide = vi.fn()
  const user = userEvent.setup()
  render(
    <ConfirmAction
      block={{
        type: 'ConfirmAction',
        payload: {
          action_id: 'action-demo',
          version: 2,
          confirm_phrase: 'Demo Concert',
        },
      }}
      onDecide={onDecide}
    />,
  )
  const input = screen.getByRole('textbox', { name: 'Cụm xác nhận' })
  const confirm = screen.getByRole('button', { name: 'Đồng ý' })
  expect(confirm).toBeDisabled()
  await user.type(input, 'demo concert')
  expect(confirm).toBeDisabled()
  expect(onDecide).not.toHaveBeenCalled()
  await user.clear(input)
  await user.type(input, 'Demo Concert')
  await user.click(confirm)
  expect(onDecide).toHaveBeenCalledWith('action-demo', 'confirm', { version: 2, confirmPhrase: 'Demo Concert' })
})
