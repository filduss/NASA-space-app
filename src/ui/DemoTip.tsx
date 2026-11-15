import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

// A one-step tutorial for judges: the page dims, the demo dock stays lit, and a short card says what
// the dock does. Shown once per browser; the "?" on the dock shows it again.

const KEY = 'shipshape.demoTip'

/** Whether this browser has seen the tip. Storage may be missing or blocked: then it shows each visit. */
export function tipSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'seen'
  } catch {
    return false
  }
}
function markSeen() {
  try {
    localStorage.setItem(KEY, 'seen')
  } catch {
    // Not remembered: the tip shows again on the next visit.
  }
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** The spotlight around the dock (`anchor`) and the card above it. */
export function DemoTip({ anchor, hasSettings, onClose }: { anchor: RefObject<HTMLElement | null>; hasSettings: boolean; onClose: () => void }) {
  const [box, setBox] = useState<Box | null>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  // Follow the dock: it moves with the window size (centred on wide screens, full width on a phone).
  useLayoutEffect(() => {
    const el = anchor.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [anchor])

  const close = () => {
    markSeen()
    onClose()
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // Once the card is on screen: focus "Got it"; Escape closes.
  const ready = box !== null
  useEffect(() => {
    if (!ready) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready])

  if (!box) return null
  const pad = 8
  // The card sits above the dock, centred on it, kept inside the window.
  const cardWidth = Math.min(380, window.innerWidth - 24)
  const cardLeft = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, box.left + box.width / 2 - cardWidth / 2))
  const arrowLeft = box.left + box.width / 2 - cardLeft

  // On document.body: the dock's transform would otherwise hold the fixed layer inside the dock.
  return createPortal(
    <div className="tip" onClick={close}>
      <div className="tip-hole" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} aria-hidden="true" />
      <div
        className="tip-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tip-title"
        aria-describedby="tip-body"
        style={{ left: cardLeft, width: cardWidth, bottom: window.innerHeight - box.top + pad + 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="tip-eyebrow">
          <span className="demo-mark" aria-hidden="true">
            ?
          </span>
          For judges
        </p>
        <h2 id="tip-title" className="tip-title">
          This bar runs the demo
        </h2>
        <div id="tip-body">
          <p className="tip-lead">It is not part of Shipshape. It moves the simulated mission calendar so you can watch the app react.</p>
          <ul className="tip-list">
            <li>
              <strong>‹ Day ›</strong> steps one mission day.
            </li>
            <li>
              <strong>1–4</strong> jump to the four moments of the demo: the cabin CO₂ climbs, the cabin is high, likely you, day 3.
            </li>
            {hasSettings && (
              <li>
                <strong>Settings</strong> change the mission and the delay to Earth.
              </li>
            )}
            <li>
              <strong>ⓘ</strong> says which data is simulated and which is real ISS telemetry.
            </li>
            <li>
              <strong>⌄</strong> folds the bar away. The <strong>?</strong> on it shows this again.
            </li>
          </ul>
        </div>
        <button ref={okRef} type="button" className="tip-ok" onClick={close}>
          Got it
        </button>
        <span className="tip-arrow" style={{ left: arrowLeft }} aria-hidden="true" />
      </div>
    </div>,
    document.body,
  )
}
