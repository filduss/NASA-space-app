import { useState } from 'react'
import { TOUR, tourIndex, tourStop } from './demo.ts'
import { hrefOf } from './paths.ts'
import { TourLink } from './TourLink.tsx'

/**
 * A strip across the top of a page opened from the judge's tour: which stop this is, and one click
 * to the next, so the tour runs on without going back to the start page. It is demo help, like the
 * tour itself: it shows nothing about anyone and closes with one click.
 */
export function TourBar() {
  const [at] = useState(() => tourIndex(window.location.search))
  const [open, setOpen] = useState(true)
  if (at === null || !open) return null
  const next = at + 1 < TOUR.length ? at + 1 : null
  return (
    <aside className="tourbar" aria-label="Judge's tour">
      <p className="tourbar-here">
        <span className="tourbar-n">
          Tour {at + 1} of {TOUR.length}
        </span>
        <span className="tourbar-title">{TOUR[at].title}</span>
      </p>
      {next !== null ? (
        <TourLink stop={tourStop(next)} className="tourbar-next">
          Next: {TOUR[next].title} <span aria-hidden="true">→</span>
        </TourLink>
      ) : (
        <a className="tourbar-next" href={hrefOf('login', import.meta.env.BASE_URL)}>
          End of the tour. Back to the start <span aria-hidden="true">→</span>
        </a>
      )}
      <button type="button" className="tourbar-close" onClick={() => setOpen(false)} aria-label="Close the tour bar">
        ×
      </button>
    </aside>
  )
}
