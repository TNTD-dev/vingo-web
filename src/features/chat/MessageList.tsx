import { Check } from 'lucide-react'
import { Fragment, useEffect, useRef } from 'react'

import type { ChatBlock } from '@/api/generated/model'
import { BlockView } from '@/blocks/registry'
import type { BlockProps } from '@/blocks/types'
import { MascotAvatar } from '@/design/MascotAvatar'
import { StatusPill } from '@/design/StatusPill'
import { usePrefersReducedMotion } from '@/lib/hooks'

import type { ChatItem, ChatState } from './chatReducer'
import { dedupePills, eventPill, stepLines } from './chatView'

type Props = {
  state: ChatState
  readOnly: boolean
  onBlockEvent: (blockId: string | undefined, type: string, payload: Record<string, unknown>, label?: string) => void
  onDecide: NonNullable<BlockProps['onDecide']>
  onQuickReply: (text: string) => void
}

/** Dòng hội thoại: tin người dùng, bước tool, tin Vingo + block, pill mốc đơn. */
export function MessageList({ state, readOnly, onBlockEvent, onDecide, onQuickReply }: Props) {
  const endRef = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()
  const lastAssistantId = [...state.items].reverse().find((i) => i.kind === 'assistant')?.id

  // Tự cuộn xuống cuối khi có nội dung mới.
  const size = state.items.length
  const tail = state.items.at(-1)
  const tailLen =
    tail?.kind === 'assistant' ? tail.text.length + tail.blocks.length + (tail.quickReplies?.length ?? 0) : 0
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: reduced ? 'auto' : 'smooth' })
  }, [size, tailLen, reduced])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[750px] flex-col justify-end gap-4 px-4 pt-6 pb-4">
      {dedupePills(state.items).map((item) => (
        <Row
          key={item.id}
          item={item}
          state={state}
          isLast={item.id === lastAssistantId}
          readOnly={readOnly}
          onBlockEvent={onBlockEvent}
          onDecide={onDecide}
          onQuickReply={onQuickReply}
        />
      ))}
      {state.awaiting && <TypingDots />}
      {state.error && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 type-body-m text-danger">
          {state.error}
        </p>
      )}
      <div ref={endRef} />
    </div>
  )
}

function Row({
  item,
  state,
  isLast,
  readOnly,
  onBlockEvent,
  onDecide,
  onQuickReply,
}: Props & { item: ChatItem; isLast: boolean }) {
  if (item.kind === 'context') {
    return (
      <div className="self-center rounded-pill border border-line bg-surface/70 px-4 py-2 type-caption text-ink-secondary">
        {item.label}
      </div>
    )
  }
  if (item.kind === 'event') {
    const pill = eventPill(item.type, item.data)
    return pill ? (
      <div className="self-center">
        <StatusPill
          label={pill.label}
          tone={
            pill.tone === 'warning'
              ? 'warning'
              : pill.tone === 'agent'
                ? 'agent'
                : pill.tone === 'success'
                  ? 'success'
                  : 'neutral'
          }
        />
      </div>
    ) : null
  }
  if (item.kind === 'user') {
    return (
      <div className="max-w-[min(360px,85%)] self-end rounded-lg bg-ink px-5 py-3.5 type-body-m text-[15px] text-on-ink">
        {item.text}
      </div>
    )
  }

  const steps = stepLines(item, state.actions)
  const orderPaid = state.orderEvents.some((e) => e.type === 'order.paid' || e.type === 'ticket.issued')
  const blockProps = (b: ChatBlock) => ({
    block: b,
    readOnly,
    orderPaid,
    actionState: state.actions,
    onDecide,
    onBlockEvent: (type: string, payload: Record<string, unknown>, label?: string) =>
      onBlockEvent(b.id, type, payload, label),
  })
  // Vé xếp cạnh nhau (Figma M5), block khác xếp dọc.
  const groups: ChatBlock[][] = []
  for (const b of item.blocks) {
    const prev = groups.at(-1)
    if (b.type === 'Ticket' && prev?.[0]?.type === 'Ticket') prev.push(b)
    else groups.push([b])
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.length > 0 && (
        <ul className="space-y-2" aria-label="Các bước Vingo đã làm">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 type-mono-small text-ink-tertiary">
              <span className="flex size-[18px] items-center justify-center rounded-full bg-ink text-on-ink">
                <Check className="size-3" aria-hidden />
              </span>
              {s.label}
              {s.detail ? ` · ${s.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
      {item.text && (
        <div className="max-w-[min(420px,100%)] rounded-lg bg-muted px-5 py-4">
          <div className="mb-2 flex items-center gap-2 type-mono-small text-ink-tertiary">
            <MascotAvatar className="size-[30px]" />
            Vingo
          </div>
          <p className="type-body-m text-[15px] whitespace-pre-wrap text-ink">{item.text}</p>
        </div>
      )}
      {groups.map((g, i) => (
        <div key={i} className={g[0]?.type === 'Ticket' ? 'flex flex-wrap gap-4' : undefined}>
          {g.map((b, j) => (
            <Fragment key={b.id ?? `${i}-${j}`}>
              <BlockView {...blockProps(b)} />
            </Fragment>
          ))}
        </div>
      ))}
      {isLast && item.done && item.quickReplies && !readOnly && (
        <div className="flex flex-wrap gap-2">
          {item.quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuickReply(q)}
              className="rounded-pill border border-line bg-surface px-4 py-2.5 type-body-m hover:border-ink"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div role="status" aria-label="Vingo đang trả lời" className="flex gap-1.5 px-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="vg-dot size-2 rounded-full bg-ink-tertiary"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
