// Who is logged in, and how many wrong PINs a person has typed. Pure functions over a Storage,
// so the rules are testable without a browser. See docs/SPEC.md, "Login".

import type { Account, AccountRole } from '../data/types.ts'
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
 * Everyone gets their own dashboard. The crew app (/app) is the medical officer's alone: it is
 * where the medical officer sees the rest of the crew. That is the only thing the role adds.
 */
export function mayOpen(user: User, page: Page): boolean {
  if (page === 'app') return user.role === 'medical'
  return true
}
