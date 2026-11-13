import { ArrowUpRight, Check, ChevronDown, ChevronUp, Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { StatusPill, type PillTone } from '@/design/StatusPill'
import { cn } from '@/lib/cn'

import { taskStatusLabel, type TaskStatus, type TaskStep, type TaskView } from './taskView'

const TONE: Record<TaskStatus, PillTone> = {
  DRAFT: 'info',
  AWAITING: 'agent',
  DONE: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
}

/** Panel "Việc đang làm" (Figma C2–C5): tóm tắt việc, các bước tool, nút sang màn quản trị tương ứng. */
export function TaskPanel({ view, onCollapse }: { view: TaskView; onCollapse: () => void }) {
  return (
    <aside
      aria-label="Việc đang làm"
      className="absolute inset-x-3 top-[64px] z-20 max-h-[calc(100%-210px)] overflow-y-auto rounded-lg border border-line bg-surface shadow-float sm:inset-x-auto sm:right-4 sm:w-[340px]"
    >
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-mono-small text-ink-secondary uppercase">Việc đang làm</h2>
          <div className="flex items-center gap-2">
            <StatusPill label={taskStatusLabel(view.status)} tone={TONE[view.status]} />
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Thu gọn việc đang làm"
              className="flex size-8 items-center justify-center rounded-full bg-canvas"
            >
              <ChevronUp className="size-4" />
            </button>
          </div>
        </div>
        <h3 className="mt-4 type-h4">{view.title}</h3>
        {view.rows.length > 0 && (
          <dl className="mt-3 space-y-2.5 rounded-md bg-canvas p-4">
            {view.rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3">
                <dt className="type-caption text-ink-secondary">{r.label}</dt>
                <dd className="text-right type-body-m-strong">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <h3 className="mt-5 type-mono-small text-ink-secondary uppercase">Các bước</h3>
        <ol className="mt-2 space-y-1">
          {view.steps.map((s) => (
            <Step key={s.key} step={s} />
          ))}
        </ol>
      </div>
      <Link to={view.open.to} className="block bg-canvas px-5 py-4">
        <span className="flex items-center gap-2 type-body-m-strong">
          <ArrowUpRight className="size-3.5" aria-hidden /> {view.open.label}
        </span>
        <span className="mt-1 block type-caption text-ink-tertiary">{view.open.hint}</span>
      </Link>
    </aside>
  )
}

function Step({ step }: { step: TaskStep }) {
  return (
    <li
      aria-current={step.status === 'active' ? 'step' : undefined}
      className={cn('flex items-center gap-3 rounded-md px-3 py-2.5', step.status === 'active' && 'bg-agent-soft')}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full',
          step.status === 'done' && 'bg-ink text-on-ink',
          step.status === 'active' && 'bg-ink text-agent',
          step.status === 'todo' && 'bg-canvas text-ink-tertiary',
        )}
      >
        {step.status === 'done' ? (
          <Check className="size-3.5" />
        ) : step.status === 'active' ? (
          <Sparkles className="size-3" />
        ) : (
          <Clock className="size-3" />
        )}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[15px]', step.status === 'todo' ? 'text-ink-tertiary' : 'text-ink')}>
          {step.title}
        </span>
        <span className="block type-mono-small text-ink-tertiary">{step.code}</span>
      </span>
    </li>
  )
}

/** Pill trên header khi panel thu gọn (Figma C2): bấm để mở lại. */
export function TaskPill({ view, onExpand }: { view: TaskView; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Mở việc đang làm"
      className="inline-flex max-w-[60vw] items-center gap-2.5 rounded-pill border border-line bg-surface py-1.5 pr-1.5 pl-2 sm:pl-4"
    >
      <span className="hidden type-mono-small text-ink-tertiary uppercase md:inline">Việc đang làm</span>
      <span className="hidden truncate type-body-m-strong sm:inline">{view.title}</span>
      <StatusPill label={taskStatusLabel(view.status)} tone={TONE[view.status]} />
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas">
        <ChevronDown className="size-4" />
      </span>
    </button>
  )
}
