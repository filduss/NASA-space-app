import { useEffect, useState } from 'react'
import { useStore } from '../state.tsx'

// The demo's own controls, kept apart from the dashboard itself: a floating dock at the bottom
// of the screen, styled as help like the judge's tour beside the login. It moves the simulated
// mission calendar; nothing in it is part of Shipshape. The golden path: the cabin CO2 climbs
// (212), Chen is fine while the cabin is high (213), still off once the air is back to normal
// (221), and day 3 (223). The same four days as the crew app's golden path.
const SCENES: { day: number; label: string }[] = [
  { day: 212, label: 'CO₂ climbs' },
  { day: 213, label: 'Cabin high' },
  { day: 221, label: 'Likely you' },
  { day: 223, label: 'Day 3' },
]

/** The dock's open or folded state is a per-viewer convenience: storage may be missing or blocked. */
const KEY = 'shipshape.demoDock'
function readFolded(): boolean {
  try {
    return localStorage.getItem(KEY) === 'folded'
  } catch {
    return false
  }
}
function writeFolded(folded: boolean) {
  try {
    if (folded) localStorage.setItem(KEY, 'folded')
    else localStorage.removeItem(KEY)
  } catch {
    // Not remembered: the dock opens again on the next visit.
  }
}

export function DemoDock() {
  const s = useStore()
  const [folded, setFolded] = useState(readFolded)
  const [lo, hi] = s.dayRange
  const today = s.today

  useEffect(() => writeFolded(folded), [folded])

  if (folded) {
    return (
      <div className="demo demo-folded">
        <button type="button" className="demo-open" onClick={() => setFolded(false)} aria-expanded="false">
          <span className="demo-mark" aria-hidden="true">
            ?
          </span>
          Demo controls
          <span className="demo-open-day">Day {today}</span>
        </button>
      </div>
    )
  }

  return (
    <aside className="demo" aria-label="Demo controls, not part of Shipshape">
      <div className="demo-head">
        <span className="demo-mark" aria-hidden="true">
          ?
        </span>
        <div className="demo-head-text">
          <p className="demo-title">Demo</p>
          <p className="demo-sub">Not part of the app</p>
        </div>
      </div>

      <div className="demo-day" role="group" aria-label="Mission day">
        <button type="button" onClick={() => s.setToday(Math.max(lo, today - 1))} disabled={today <= lo} aria-label="Previous mission day">
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
            <path d="M8 2L2 8l6 6" />
          </svg>
        </button>
        <p className="demo-day-num" aria-live="polite">
          <span>Day</span> {today}
        </p>
        <button type="button" onClick={() => s.setToday(Math.min(hi, today + 1))} disabled={today >= hi} aria-label="Next mission day">
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
            <path d="M2 2l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className="demo-scenes" role="group" aria-label="Golden path">
        {SCENES.map((sc, i) => (
          <button key={sc.day} type="button" className={today === sc.day ? 'demo-scene demo-scene-on' : 'demo-scene'} aria-pressed={today === sc.day} onClick={() => s.setToday(sc.day)}>
            <span className="demo-scene-n" aria-hidden="true">
              {i + 1}
            </span>
            {sc.label}
          </button>
        ))}
      </div>

      <details className="demo-about">
        <summary aria-label="About the data">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.75" />
            <path d="M8 7.2v4.3M8 4.6v.1" />
          </svg>
        </summary>
        <div className="demo-about-card">
          <p className="demo-about-title">About the data</p>
          <p>
            <span className="tag">Simulated crew</span> No real person's data.
          </p>
          <p>
            <span className="tag tag-real">Real ISS cabin air</span> CO₂, temperature and humidity, NASA OSDR, {s.data.cabin.meta.mission}, replayed on the mission calendar.
          </p>
          <p>Shipshape says "likely" and never diagnoses.</p>
          <p className="demo-credit">
            Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0). Modified by open-anatomy-3d (https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0. Skeleton extracted and
            re-exported. For visualisation only.
          </p>
        </div>
      </details>

      <button type="button" className="demo-fold" onClick={() => setFolded(true)} aria-label="Hide demo controls" title="Hide demo controls">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 5.5l4 4 4-4" />
        </svg>
      </button>
    </aside>
  )
}
