// The demo logins and the judge's tour. The PINs are public on purpose: the login is a privacy gate
// for the demo, not security (docs/SPEC.md, "Login"). The same PINs are set in
// scripts/make_accounts.py and listed in the README; the three change together.

import type { Page } from './paths.ts'

export const DEMO_PINS: Record<string, string> = { anna: '1111', ben: '2222', chen: '3333', dana: '4444', mira: '5555' }

/** A place in the demo, opened as one person. Without a person it is a public page and needs no login. */
export interface TourStop {
  as?: string
  page: Exclude<Page, 'login'>
  search?: string
}

export interface TourStep extends TourStop {
  title: string
  body: string
}

/** The golden path in three clicks, then the challenge page. */
export const TOUR: TourStep[] = [
  {
    title: 'Day 213 · Likely the ship',
    body: 'Three of the four crew drift at once while the real ISS cabin CO₂ climbs.',
    as: 'dana',
    page: 'app',
    search: '?day=213&screen=ship',
  },
  {
    title: 'Day 221 · Likely not the ship',
    body: 'The air is back to normal, but Chen is still short on sleep: his own dashboard checks the ship and says likely not the ship, and only he sees it.',
    as: 'chen',
    page: 'dashboard',
    search: '?day=221',
  },
  {
    title: 'Day 223 · Day 3 reaches Earth',
    body: 'Chen is still off on day 3, so a summary goes to the flight surgeon, minutes away.',
    as: 'mira',
    page: 'app',
    search: '?day=223&screen=summary',
  },
  {
    title: 'How it answers the challenge',
    body: 'The five questions, the evidence that the rule works, and its limits.',
    page: 'challenge',
  },
]

/** A tour stop as a link: the same stop, marked with its place in the tour so the page can offer the next one (TourBar). */
export function tourStop(index: number): TourStop {
  const { as, page, search } = TOUR[index]
  return { as, page, search: `${search ? `${search}&` : '?'}tour=${index + 1}` }
}

/** The stop a page was opened at: `?tour=2` is the second stop. Null when the page was not opened from the tour. */
export function tourIndex(search: string): number | null {
  const n = Number(new URLSearchParams(search).get('tour'))
  return Number.isInteger(n) && n >= 1 && n <= TOUR.length ? n - 1 : null
}
