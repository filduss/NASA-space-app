// Who is logged in, and how many wrong PINs a person has typed. Pure functions over a Storage,
// so the rules are testable without a browser. See docs/SPEC.md, "Login".

import type { Account, AccountRole } from '../data/types.ts'
import type { Viewer } from '../engine/privacy.ts'
import type { Page } from './paths.ts'

/** sessionStorage: gone when the tab closes. Holds only who and until when, never the PIN or role. */
export const SESSION_KEY = 'shipshape.session.v1'
/** localStorage: wrong-PIN counts survive closing the tab, so closing it does not reset a lockout. */
export const LOCKOUT_KEY = 'shipshape.lockout.v1'

/** One shift. */
export const SESSION_MS = 8 * 60 * 60 * 1000
export const FREE_ATTEMPTS = 5
export const LOCK_BASE_MS = 30 * 1000
export const LOCK_MAX_MS = 15 * 60 * 1000

export interface Session {
  crewId: string
  expiresAt: number
}

/** A logged-in person: the session checked against accounts.json, with the role taken from the file. */
export interface User {
  crewId: string
  role: AccountRole
}

function readJson(store: Storage, key: string): unknown {
  try {
    const raw = store.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(store: Storage, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // storage can be unavailable (private window); login then lasts only for this page
  }
}

export function startSession(store: Storage, crewId: string, now: number): Session {
  const s: Session = { crewId, expiresAt: now + SESSION_MS }
  writeJson(store, SESSION_KEY, s)
  return s
}

export function endSession(store: Storage): void {
  try {
    store.removeItem(SESSION_KEY)
  } catch {
    // nothing to clear
  }
}

/** The logged-in user, or null. Anything malformed, expired or naming an unknown person is no session. */
export function currentUser(store: Storage, accounts: Account[], now: number): User | null {
  const s = readJson(store, SESSION_KEY) as Partial<Session> | null
  if (!s || typeof s.crewId !== 'string' || typeof s.expiresAt !== 'number') return null
  if (s.expiresAt <= now || s.expiresAt > now + SESSION_MS) {
    endSession(store)
    return null
  }
  const account = accounts.find((a) => a.crewId === s.crewId)
  return account ? { crewId: account.crewId, role: account.role } : null
}

// ---- Wrong-PIN lockout --------------------------------------------------------------------

export interface Attempts {
  fails: number
  lockedUntil: number
}
type LockoutMap = Record<string, Attempts>

const NONE: Attempts = { fails: 0, lockedUntil: 0 }

export function attemptsFor(store: Storage, crewId: string): Attempts {
  const all = readJson(store, LOCKOUT_KEY) as LockoutMap | null
  const a = all?.[crewId]
  return a && typeof a.fails === 'number' && typeof a.lockedUntil === 'number' ? a : NONE
}

/** After the free attempts, each wrong PIN locks the person out for twice as long as the last, up to 15 min. */
export function afterFailure(a: Attempts, now: number): Attempts {
  const fails = a.fails + 1
  if (fails < FREE_ATTEMPTS) return { fails, lockedUntil: 0 }
  const ms = Math.min(LOCK_MAX_MS, LOCK_BASE_MS * 2 ** (fails - FREE_ATTEMPTS))
  return { fails, lockedUntil: now + ms }
}

export function recordFailure(store: Storage, crewId: string, now: number): Attempts {
  const all = (readJson(store, LOCKOUT_KEY) as LockoutMap | null) ?? {}
  const next = afterFailure(attemptsFor(store, crewId), now)
  writeJson(store, LOCKOUT_KEY, { ...all, [crewId]: next })
  return next
}

export function clearFailures(store: Storage, crewId: string): void {
  const all = (readJson(store, LOCKOUT_KEY) as LockoutMap | null) ?? {}
  delete all[crewId]
  writeJson(store, LOCKOUT_KEY, all)
}

// ---- What a role may open -----------------------------------------------------------------

/**
 * Crew (astronauts and the medical officer) get their own dashboard, their own check-in and the Guide. The crew
 * app (/app) is the medical console: the medical officer and the flight surgeon only. The flight
 * surgeon is not crew, so has no dashboard and no check-in.
 */
export function mayOpen(user: User, page: Page): boolean {
  if (page === 'dashboard' || page === 'checkin' || page === 'guide') return user.role !== 'surgeon'
  if (page === 'app') return user.role !== 'astronaut'
  return true
}

/**
 * The views a person takes on a page. On the check-in page a crew member is always themselves. In the
 * crew app the medical officer is the crew medical officer and the flight surgeon is the flight
 * surgeon, who sees everything the crew medical officer sees, plus the summaries sent to Earth.
 * Never another crew member.
 */
export function viewsFor(user: User, page: Page): Viewer[] {
  if (!mayOpen(user, page)) return []
  if (page === 'checkin') return [{ kind: 'crew', crewId: user.crewId }]
  if (page === 'app') return [user.role === 'surgeon' ? { kind: 'surgeon' } : { kind: 'cmo' }]
  return []
}

/** One string per view, for comparing views and for form values. */
export function viewKey(v: Viewer): string {
  return v.kind === 'crew' ? v.crewId : v.kind
}

/** Where a person lands after login, or when they open a page their role may not open. */
export function homePage(user: User): Exclude<Page, 'login'> {
  return mayOpen(user, 'dashboard') ? 'dashboard' : 'app'
}
