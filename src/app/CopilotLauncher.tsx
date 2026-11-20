import { MessageSquareText, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { MascotLive } from '@/design/MascotLive'
import { cn } from '@/lib/cn'

type Position = { x: number; y: number }
type Placement = { left: number; top: number; travelX: number; travelY: number }
type Drag = Placement & { id: number; startX: number; startY: number; baseTop: number; moved: boolean }

const POSITION_KEY = 'vingo.admin.copilot-position'
const LABEL_KEY = 'vingo.admin.copilot-label-hidden'
const INSET = 12
const DRAG_THRESHOLD = 6
const keyOffsets = new Map<string, [number, number]>([
  ['ArrowLeft', [-24, 0]],
  ['ArrowRight', [24, 0]],
  ['ArrowUp', [0, -24]],
  ['ArrowDown', [0, 24]],
])

function readPosition(): Position | null {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as Position | null
    if (saved && [saved.x, saved.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return saved
  } catch {
    // The default position also works when storage is unavailable.
  }
  return null
}

function readLabelHidden() {
  try {
    return localStorage.getItem(LABEL_KEY) === '1'
  } catch {
    return false
  }
}

function measurePlacement(element: HTMLElement): Placement {
  const rect = element.getBoundingClientRect()
  const width = document.documentElement.clientWidth || window.innerWidth
  const height = document.documentElement.clientHeight || window.innerHeight
  return {
    left: rect.left,
    top: rect.top,
    travelX: Math.max(0, width - rect.width - 2 * INSET),
    travelY: Math.max(0, height - rect.height - 2 * INSET),
  }
}

function clampPosition(placement: Placement, dx: number, dy: number): Position {
  return {
    x: Math.max(0, Math.min(placement.travelX, placement.left + dx - INSET)),
    y: Math.max(0, Math.min(placement.travelY, placement.top + dy - INSET)),
  }
}

// Percentages keep the same relative placement when the window or launcher changes size.
const insetPosition = (fraction: number) => `calc(${fraction * 100}% + ${INSET}px - ${2 * fraction * INSET}px)`

export function CopilotLauncher({ compact = false }: { compact?: boolean }) {
  const [position, setPosition] = useState(readPosition)
  const [labelHidden, setLabelHidden] = useState(readLabelHidden)
  const elementRef = useRef<HTMLDivElement>(null)
  const falling = useRef<Animation | null>(null)
  const fallDistance = useRef(0)
  const drag = useRef<Drag | null>(null)
  const ignoreClick = useRef(false)

  useLayoutEffect(() => {
    const distance = fallDistance.current
    fallDistance.current = 0
    const element = elementRef.current
    if (!element?.animate || distance < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    const fallMs = Math.sqrt((2 * distance) / 2800) * 1000
    const bounce = Math.min(14, distance * 0.09)
    const duration = fallMs + 140
    const animation = element.animate(
      [
        { transform: `translateY(${-distance}px)`, offset: 0, easing: 'cubic-bezier(0.45, 0, 0.85, 0.5)' },
        { transform: 'translateY(0)', offset: fallMs / duration, easing: 'ease-out' },
        { transform: `translateY(${-bounce}px)`, offset: (fallMs + 70) / duration, easing: 'ease-in' },
        { transform: 'translateY(0)', offset: 1 },
      ],
      duration,
    )
    falling.current = animation
    animation.onfinish = () => {
      if (falling.current === animation) falling.current = null
    }
  }, [position])

  useLayoutEffect(() => () => falling.current?.cancel(), [])

  function savePosition(next: Position | null) {
    setPosition(next)
    try {
      if (next) localStorage.setItem(POSITION_KEY, JSON.stringify(next))
      else localStorage.removeItem(POSITION_KEY)
    } catch {
      // The launcher still moves for the current visit.
    }
  }

  function place(placement: Placement, dx: number, dy: number, drop = false) {
    const { x, y } = clampPosition(placement, dx, dy)
    fallDistance.current = drop ? placement.travelY - y : 0
    savePosition({
      x: placement.travelX ? x / placement.travelX : 0,
      y: drop ? 1 : placement.travelY ? y / placement.travelY : 0,
    })
  }

  function startDrag(event: PointerEvent<HTMLAnchorElement>) {
    const element = elementRef.current
    if (!element || event.button !== 0 || drag.current) return
    const placement = measurePlacement(element)
    let baseTop = placement.top
    if (falling.current) {
      falling.current.cancel()
      falling.current = null
      baseTop = element.getBoundingClientRect().top
      element.style.transform = `translateY(${placement.top - baseTop}px)`
    }
    ignoreClick.current = false
    drag.current = {
      ...placement,
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseTop,
      moved: false,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture can be unavailable after an interrupted gesture.
    }
  }

  function moveDrag(event: PointerEvent<HTMLAnchorElement>) {
    const active = drag.current
    const element = elementRef.current
    if (!element || !active || active.id !== event.pointerId) return
    const dx = event.clientX - active.startX
    const dy = event.clientY - active.startY
    if (!active.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    active.moved = true
    ignoreClick.current = true
    const { x, y } = clampPosition(active, dx, dy)
    element.style.transform = `translate3d(${x + INSET - active.left}px, ${y + INSET - active.baseTop}px, 0)`
  }

  function finishDrag(event: PointerEvent<HTMLAnchorElement>, drop = false) {
    const active = drag.current
    if (!active || active.id !== event.pointerId) return
    drag.current = null
    if (elementRef.current) elementRef.current.style.transform = ''
    if (drop && active.moved) place(active, event.clientX - active.startX, event.clientY - active.startY, true)
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLAnchorElement>) {
    const element = elementRef.current
    if (!element || drag.current) return
    const offset = keyOffsets.get(event.key)
    if (!offset && event.key !== 'Home') return
    event.preventDefault()
    const placement = measurePlacement(element)
    falling.current?.cancel()
    falling.current = null
    if (event.key === 'Home') {
      savePosition(null)
    } else if (offset) {
      place(placement, ...offset)
    }
  }

  function toggleLabel() {
    const hidden = !labelHidden
    setLabelHidden(hidden)
    try {
      localStorage.setItem(LABEL_KEY, hidden ? '1' : '0')
    } catch {
      // The preference still applies for the current visit.
    }
  }

  const labelAction = labelHidden ? 'Hiện ô Mở Copilot' : 'Ẩn ô Mở Copilot'
  return (
    <div
      ref={elementRef}
      className={cn('group fixed z-40 w-max', compact ? 'right-4 bottom-3' : 'right-3 bottom-3 sm:right-5 sm:bottom-5')}
      style={
        position
          ? {
              left: insetPosition(position.x),
              top: insetPosition(position.y),
              right: 'auto',
              bottom: 'auto',
              translate: `${-position.x * 100}% ${-position.y * 100}%`,
            }
          : undefined
      }
    >
      <Link
        to="/admin/copilot"
        aria-label="Mở Copilot (⌘J)"
        aria-description="Kéo hoặc dùng phím mũi tên để di chuyển. Nhấn Home để về góc mặc định."
        className={cn(
          'flex cursor-grab touch-none items-center rounded-lg select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
          compact && !labelHidden && 'rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-float',
        )}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={(event) => finishDrag(event, true)}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={(event) => {
          if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) finishDrag(event)
        }}
        onKeyDown={moveWithKeyboard}
        onClick={(event) => {
          if (event.detail && ignoreClick.current) event.preventDefault()
          ignoreClick.current = false
        }}
      >
        {compact && !labelHidden ? (
          'Mở Copilot ⌘J'
        ) : (
          <>
            {!labelHidden && (
              <span className="mr-1 hidden items-center gap-2 rounded-[16px] border border-line bg-surface py-2.5 pr-2.5 pl-3.5 shadow-float sm:flex">
                <span className="type-body-m-strong">Mở Copilot</span>
                <kbd className="rounded-[6px] bg-canvas px-1.5 py-0.5 type-mono-small text-ink-tertiary">⌘J</kbd>
              </span>
            )}
            <MascotLive
              mood="rest"
              className={compact ? 'size-12 drop-shadow-md' : 'size-[72px] drop-shadow-md sm:size-[91px]'}
            />
          </>
        )}
      </Link>
      <button
        type="button"
        onClick={toggleLabel}
        aria-label={labelAction}
        title={labelAction}
        className={cn(
          'absolute -top-2 right-0 size-7 place-items-center rounded-full border border-line bg-surface text-ink-secondary opacity-0 shadow-float group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100',
          compact ? 'grid' : 'hidden sm:grid',
        )}
      >
        {labelHidden ? <MessageSquareText size={14} aria-hidden /> : <X size={14} aria-hidden />}
      </button>
    </div>
  )
}
