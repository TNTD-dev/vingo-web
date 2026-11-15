import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/design/ui/button'
import { cn } from '@/lib/cn'
import './wizard.css'

/** Figma `WizardStep`: thanh các bước ở đầu trang wizard. */
export type StepState = 'done' | 'active' | 'todo'
export type StepItem = { label: string; hint: string; state: StepState }

export function Stepper({ steps, onSelect }: { steps: StepItem[]; onSelect?: (index: number) => void }) {
  return (
    <ol className="wz-stepper" aria-label="Các bước">
      {steps.map((step, i) => {
        const clickable = !!onSelect && step.state === 'done'
        const body = (
          <>
            <span className="wz-step-dot" data-state={step.state}>
              {step.state === 'done' ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className="wz-step-text">
              <strong>{step.label}</strong>
              <small>{step.hint}</small>
            </span>
          </>
        )
        return (
          <li key={step.label} data-state={step.state} aria-current={step.state === 'active' ? 'step' : undefined}>
            {clickable ? (
              <button type="button" className="wz-step" onClick={() => onSelect(i)}>
                {body}
              </button>
            ) : (
              <div className="wz-step">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Figma `ChecklistRow`: một dòng trong checklist “sẵn sàng”. `warn` là chưa đạt nhưng không bắt buộc. */
export type CheckStatus = 'ok' | 'todo' | 'warn'
export function ChecklistRow({
  status,
  title,
  hint,
  action,
}: {
  status: CheckStatus
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="wz-check" data-status={status}>
      <span className="wz-check-icon" aria-hidden>
        {status === 'ok' ? <Check size={14} strokeWidth={3} /> : status === 'warn' ? <AlertTriangle size={14} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {action && <span className="wz-check-action">{action}</span>}
      <span className="sr-only">{status === 'ok' ? 'Đã xong' : status === 'warn' ? 'Cần lưu ý' : 'Chưa xong'}</span>
    </div>
  )
}

/** Figma `ChoiceCard`: thẻ chọn một trong nhiều (radio). */
export function ChoiceCard({
  title,
  hint,
  selected,
  disabled,
  onSelect,
  badge,
}: {
  title: string
  hint?: ReactNode
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      className="wz-choice"
      onClick={onSelect}
    >
      <span className="wz-choice-icon" aria-hidden />
      <span className="wz-choice-radio" aria-hidden />
      <strong>{title}</strong>
      {hint && <small>{hint}</small>}
      {badge}
    </button>
  )
}
export function ChoiceGroup({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('wz-choices', className)}>
      {children}
    </div>
  )
}

/** Nhóm nút chọn một (thành phố, độ tuổi, kiểu đóng bán…). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  variant = 'track',
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  variant?: 'track' | 'pills'
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('wz-seg', variant === 'pills' && 'wz-seg-pills')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Nút nhẹ (Small Light) cho “Lưu nháp” và “Quay lại”. Không dùng icon » vì gợi ý đi tiếp. */
export function LightButton({
  back,
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & { back?: boolean }) {
  return (
    <Button variant="outline" {...props} className={cn('wz-light', className)}>
      {back && <ArrowLeft size={16} aria-hidden />}
      {children}
    </Button>
  )
}

export function LightLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('wz-light inline-flex items-center justify-center', className)}>
      {children}
    </Link>
  )
}
