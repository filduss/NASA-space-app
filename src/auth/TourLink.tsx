import { useState, type MouseEvent, type ReactNode } from 'react'
import { useStore } from '../state.tsx'
import { DEMO_PINS, type TourStop } from './demo.ts'
import { hrefOf } from './paths.ts'

/**
 * A link into the demo as one person: it logs in with their public demo PIN, through the same check
 * as typing it, then opens the page. A stop without a person is a public page. A modified click
 * (new tab) is left to the browser, which then shows the login on the way.
 */
export function TourLink({ stop, className, children }: { stop: TourStop; className?: string; children: ReactNode }) {
  const { user, logIn } = useStore()
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle')
  const href = hrefOf(stop.page, import.meta.env.BASE_URL, stop.search ?? '')

  const open = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (!stop.as || user?.crewId === stop.as) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (state === 'busy') return
    setState('busy')
    // The store loads the page itself once the PIN is checked, without changing who this page shows.
    const r = await logIn(stop.as, DEMO_PINS[stop.as], href)
    if (!r.ok) setState('failed')
  }

  return (
    <a href={href} className={className} onClick={open} aria-busy={state === 'busy'}>
      {children}
      {state !== 'idle' && (
        <span className="tour-state" role="status">
          {state === 'busy' ? 'Opening…' : 'Could not log in. Please try again.'}
        </span>
      )}
    </a>
  )
}
