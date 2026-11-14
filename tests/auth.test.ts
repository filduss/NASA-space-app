import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { appPath, hrefOf, pageOf, safeNext } from '../src/auth/paths.ts'
import { derive, isPinShaped, sameBytes, verifyPin } from '../src/auth/pin.ts'
import {
  afterFailure,
  attemptsFor,
  clearFailures,
  currentUser,
  FREE_ATTEMPTS,
  LOCK_BASE_MS,
  LOCK_MAX_MS,
  mayOpen,
  recordFailure,
  SESSION_KEY,
  SESSION_MS,
  startSession,
  type User,
} from '../src/auth/session.ts'
import type { AccountsFile } from '../src/data/types.ts'

/** A Map-backed Storage, so the session rules run without a browser. */
function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

const file = JSON.parse(readFileSync(new URL('../public/data/accounts.json', import.meta.url), 'utf-8')) as AccountsFile
const accounts = file.accounts
// The demo PINs printed in the README and set in scripts/make_accounts.py.
const DEMO_PINS: Record<string, string> = { anna: '1111', ben: '2222', chen: '3333', dana: '4444' }

describe('PIN hashing', () => {
  it('matches Python hashlib.pbkdf2_hmac (same parameters as scripts/make_accounts.py)', async () => {
    const salt = new TextEncoder().encode('saltsaltsaltsalt')
    const out = await derive('1234', salt, { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000, keyBytes: 32 })
    expect(Buffer.from(out).toString('hex')).toBe('628edfd0d243efa48ea1131ff70b117e8ee386c46c221a22a062d526509bd86b')
  })
  it('accounts.json stores salts and hashes, never a PIN', () => {
    const text = JSON.stringify(file)
    for (const pin of Object.values(DEMO_PINS)) expect(text).not.toContain(`"${pin}"`)
    expect(new Set(accounts.map((a) => a.salt)).size).toBe(accounts.length)
  })
  it('each demo PIN opens its own account and no other', async () => {
    for (const a of accounts) {
      for (const [id, pin] of Object.entries(DEMO_PINS)) {
        expect(await verifyPin(a, pin, file.meta.kdf)).toBe(id === a.crewId)
      }
    }
  }, 30_000)
  it('rejects anything that is not four digits without hashing it', async () => {
    expect(isPinShaped('1234')).toBe(true)
    for (const bad of ['', '123', '12345', '12a4', ' 1234', '١٢٣٤']) expect(isPinShaped(bad)).toBe(false)
    expect(await verifyPin(accounts[0], '111', file.meta.kdf)).toBe(false)
  })
  it('compares bytes in full', () => {
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(sameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })
})

describe('session', () => {
  const now = 1_000_000
  it('a fresh session names the person and takes the role from accounts.json', () => {
    const st = memoryStorage()
    startSession(st, 'dana', now)
    expect(currentUser(st, accounts, now + 1000)).toEqual({ crewId: 'dana', role: 'medical' })
  })
  it('expires after one shift and is then removed', () => {
    const st = memoryStorage()
    startSession(st, 'anna', now)
    expect(currentUser(st, accounts, now + SESSION_MS)).toBeNull()
    expect(st.getItem(SESSION_KEY)).toBeNull()
  })
  it('ignores a session edited by hand: unknown person, a role field, far-future expiry, bad JSON', () => {
    const st = memoryStorage()
    st.setItem(SESSION_KEY, JSON.stringify({ crewId: 'mallory', expiresAt: now + 1000 }))
    expect(currentUser(st, accounts, now)).toBeNull()
    st.setItem(SESSION_KEY, JSON.stringify({ crewId: 'anna', role: 'medical', expiresAt: now + 1000 }))
    expect(currentUser(st, accounts, now)).toEqual({ crewId: 'anna', role: 'astronaut' })
    st.setItem(SESSION_KEY, JSON.stringify({ crewId: 'anna', expiresAt: now + SESSION_MS * 100 }))
    expect(currentUser(st, accounts, now)).toBeNull()
    st.setItem(SESSION_KEY, '{not json')
    expect(currentUser(st, accounts, now)).toBeNull()
  })
})

describe('wrong-PIN lockout', () => {
  it('allows the free attempts, then locks for 30 s, doubling up to 15 min', () => {
    let a = { fails: 0, lockedUntil: 0 }
    for (let i = 1; i < FREE_ATTEMPTS; i++) {
      a = afterFailure(a, 0)
      expect(a.lockedUntil).toBe(0)
    }
    a = afterFailure(a, 0)
    expect(a.lockedUntil).toBe(LOCK_BASE_MS)
    a = afterFailure(a, 0)
    expect(a.lockedUntil).toBe(LOCK_BASE_MS * 2)
    for (let i = 0; i < 20; i++) a = afterFailure(a, 0)
    expect(a.lockedUntil).toBe(LOCK_MAX_MS)
  })
  it('counts per person and clears on success', () => {
    const st = memoryStorage()
    recordFailure(st, 'anna', 0)
    recordFailure(st, 'anna', 0)
    recordFailure(st, 'ben', 0)
    expect(attemptsFor(st, 'anna').fails).toBe(2)
    clearFailures(st, 'anna')
    expect(attemptsFor(st, 'anna').fails).toBe(0)
    expect(attemptsFor(st, 'ben').fails).toBe(1)
  })
})

describe('roles', () => {
  const astronaut: User = { crewId: 'anna', role: 'astronaut' }
  const medical: User = { crewId: 'dana', role: 'medical' }
  it('an astronaut gets their own dashboard and not the crew app', () => {
    expect(mayOpen(astronaut, 'dashboard')).toBe(true)
    expect(mayOpen(astronaut, 'app')).toBe(false)
  })
  it('the medical officer gets their own dashboard and the crew app', () => {
    expect(mayOpen(medical, 'dashboard')).toBe(true)
    expect(mayOpen(medical, 'app')).toBe(true)
  })
})

describe('pages', () => {
  const base = '/'
  const origin = 'https://shipshape.example'
  it('maps paths to pages, with "/" as the login', () => {
    expect(pageOf(appPath('/', base))).toBe('login')
    expect(pageOf(appPath('/dashboard/', base))).toBe('dashboard')
    expect(pageOf(appPath('/app', base))).toBe('app')
    expect(pageOf(appPath('/anything', base))).toBe('login')
    expect(pageOf(appPath('/sub/dashboard', '/sub/'))).toBe('dashboard')
    expect(hrefOf('app', '/sub/')).toBe('/sub/app')
  })
  it('only sends a person back to one of our own pages after login', () => {
    expect(safeNext(null, base, origin)).toBe('/dashboard')
    expect(safeNext('/dashboard?day=223', base, origin)).toBe('/dashboard?day=223')
    expect(safeNext('/app', base, origin)).toBe('/app')
    for (const evil of ['https://evil.example/dashboard', '//evil.example/app', 'javascript:alert(1)', '/']) {
      expect(safeNext(evil, base, origin)).toBe('/dashboard')
    }
  })
})
