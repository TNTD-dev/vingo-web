import type { ReactNode } from 'react'
import { AdminPage } from '@/design/admin/AdminUi'
import type { SearchScope } from '@/design/admin/AdminSearch'
import { Stepper, type StepItem } from '@/design/admin/wizard'
import './event-wizard.css'

/** Khung wizard sự kiện: nội dung chính và thanh bước nhỏ, bám bên phải khi cuộn. */
export function WizardShell({
  title,
  caption,
  steps,
  onSelectStep,
  actions,
  search,
  children,
}: {
  title: string
  caption: string
  steps: StepItem[]
  onSelectStep?: (index: number) => void
  actions?: ReactNode
  search?: SearchScope
  children: ReactNode
}) {
  return (
    <AdminPage title={title} caption={caption} actions={actions} search={search}>
      <div className="event-wizard">
        <div className="event-wizard-content">{children}</div>
        <nav className="event-wizard-steps" aria-label="Tiến trình tạo sự kiện">
          <p className="event-wizard-progress">
            Bước{' '}
            {Math.max(
              0,
              steps.findIndex((step) => step.state === 'active'),
            ) + 1}
            /{steps.length}
          </p>
          <Stepper steps={steps} onSelect={onSelectStep} />
        </nav>
      </div>
    </AdminPage>
  )
}

/** Ghép trạng thái từng bước từ bước hiện tại (đếm từ 0) và các gợi ý ngắn của mỗi bước. */
export function stepItems(
  labels: { label: string; hint: string; doneHint?: string }[],
  current: number,
  allDone = false,
) {
  return labels.map((s, i): StepItem => ({
    label: s.label,
    hint: i < current || allDone ? (s.doneHint ?? s.hint) : s.hint,
    state: allDone || i < current ? 'done' : i === current ? 'active' : 'todo',
  }))
}
