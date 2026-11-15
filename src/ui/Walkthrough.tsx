import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A spotlight walkthrough for judges: the page dims, one part of it stays lit, and a card beside it
// says what that part does. Back, Next and Skip step through; a step whose part is not on the page
// (another screen, another role) is left out. The steps for each page are in walkthroughs.tsx.

export interface WalkStep {
  /** The `data-tour` value of the element to light up. */
  target: string
  title: string
  body: ReactNode
}

interface Box {
  top: number
  left: number
  width: number
  height: number
  radius: number
}

const PAD = 8
const GAP = 16
const EDGE = 12

/** Whether this browser has seen the walkthrough named `key`. Storage may be blocked: then it shows each visit. */
export function walkSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'seen'
  } catch {
    return false
  }
}
function markSeen(key: string) {
  try {
    localStorage.setItem(key, 'seen')
  } catch {
    // Not remembered: the walkthrough shows again on the next visit.
  }
}

const find = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`)

export function Walkthrough({ storageKey, steps: all, onClose }: { storageKey: string; steps: WalkStep[]; onClose: () => void }) {
  // Only the steps whose part is on this page now.
  const [steps] = useState(() => all.filter((s) => find(s.target)))
  const [at, setAt] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardH, setCardH] = useState(240)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[at]
  const last = at === steps.length - 1

  const close = () => {
    markSeen(storageKey)
    onClose()
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // Bring the step's part into view, then follow it every frame: it moves while the page scrolls,
  // while the window resizes and while the demo dock unfolds.
  useEffect(() => {
    if (!step) return
    const el = find(step.target)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    let raf = 0
    let prev = ''
    const tick = () => {
      const r = el.getBoundingClientRect()
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12
      const key = `${r.top}|${r.left}|${r.width}|${r.height}`
      if (key !== prev) {
        prev = key
        setBox({ top: r.top, left: r.left, width: r.width, height: r.height, radius })
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [at, box !== null])

  // Keys: Escape skips, arrows step. Focus stays on Next.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowRight') setAt((i) => Math.min(i + 1, steps.length - 1))
      else if (e.key === 'ArrowLeft') setAt((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, steps.length])

  useEffect(() => {
    if (steps.length === 0) closeRef.current()
  }, [steps.length])

  if (!step || !box) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  // The lit hole, kept inside the window when the part is taller than it.
  const hole = {
    top: Math.max(EDGE, box.top - PAD),
    left: Math.max(EDGE / 2, box.left - PAD),
    bottom: Math.min(vh - EDGE, box.top + box.height + PAD),
    right: Math.min(vw - EDGE / 2, box.left + box.width + PAD),
  }
  const cardW = Math.min(360, vw - EDGE * 2)
  const clampX = (x: number) => Math.max(EDGE, Math.min(vw - cardW - EDGE, x))
  const clampY = (y: number) => Math.max(EDGE, Math.min(vh - cardH - EDGE, y))
  const midX = (hole.left + hole.right) / 2
  const midY = (hole.top + hole.bottom) / 2

  // The card goes where it fits: below, above, right of or left of the part; else over its foot.
  let place: 'below' | 'above' | 'right' | 'left' | 'over'
  let pos: { top: number; left: number }
  if (vh - hole.bottom >= cardH + GAP + EDGE) {
    place = 'below'
    pos = { top: hole.bottom + GAP, left: clampX(midX - cardW / 2) }
  } else if (hole.top >= cardH + GAP + EDGE) {
    place = 'above'
    pos = { top: hole.top - GAP - cardH, left: clampX(midX - cardW / 2) }
  } else if (vw - hole.right >= cardW + GAP + EDGE) {
    place = 'right'
    pos = { top: clampY(midY - cardH / 2), left: hole.right + GAP }
  } else if (hole.left >= cardW + GAP + EDGE) {
    place = 'left'
    pos = { top: clampY(midY - cardH / 2), left: hole.left - GAP - cardW }
  } else {
    place = 'over'
    pos = { top: clampY(hole.bottom - cardH - GAP), left: clampX(midX - cardW / 2) }
  }
  const arrow =
    place === 'below' || place === 'above'
      ? { left: Math.max(20, Math.min(cardW - 20, midX - pos.left)) }
      : place === 'right' || place === 'left'
        ? { top: Math.max(20, Math.min(cardH - 20, midY - pos.top)) }
        : null

  // On document.body: a transformed parent (the demo dock) would otherwise hold the fixed layer.
  return createPortal(
    <div className="tip">
      <div
        className="tip-hole"
        style={{ top: hole.top, left: hole.left, width: hole.right - hole.left, height: hole.bottom - hole.top, borderRadius: box.radius + PAD }}
        aria-hidden="true"
      />
      <div
        ref={cardRef}
        key={at}
        className={`tip-card tip-card-${place}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tip-title"
        aria-describedby="tip-body"
        style={{ top: pos.top, left: pos.left, width: cardW }}
      >
        <p className="tip-eyebrow">
          <span className="demo-mark" aria-hidden="true">
            ?
          </span>
          Walkthrough · {at + 1} of {steps.length}
        </p>
        <h2 id="tip-title" className="tip-title">
          {step.title}
        </h2>
        <div id="tip-body" className="tip-body">
          {step.body}
        </div>
        <div className="tip-nav">
          <button type="button" className="tip-skip" onClick={close}>
            {last ? 'Close' : 'Skip'}
          </button>
          <span className="tip-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.target} className={i === at ? 'tip-dot tip-dot-on' : 'tip-dot'} />
            ))}
          </span>
          {at > 0 && (
            <button type="button" className="tip-back" onClick={() => setAt(at - 1)}>
              Back
            </button>
          )}
          <button ref={nextRef} type="button" className="tip-ok" onClick={() => (last ? close() : setAt(at + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
        {arrow && <span className={`tip-arrow tip-arrow-${place}`} style={arrow} aria-hidden="true" />}
      </div>
    </div>,
    document.body,
  )
}
