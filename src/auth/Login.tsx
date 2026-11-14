import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { AccountRole } from '../data/types.ts'
import { useStore } from '../state.tsx'
import { safeNext } from './paths.ts'
import { isPinShaped, PIN_LENGTH } from './pin.ts'
import { attemptsFor } from './session.ts'
import './login.css'

const ROLE_LABEL: Record<AccountRole, string> = { astronaut: 'Astronaut', medical: 'Medical officer' }

function nextUrl(): string {
  return safeNext(new URLSearchParams(window.location.search).get('next'), import.meta.env.BASE_URL, window.location.origin)
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Login() {
  const s = useStore()
  const [picked, setPicked] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState(0)
  const pinRef = useRef<HTMLInputElement>(null)
  const now = useNow(lockedUntil > 0)
  const locked = lockedUntil > now

  useEffect(() => {
    document.title = 'Log in · Shipshape'
    document.body.classList.add('login-body')
    return () => document.body.classList.remove('login-body')
  }, [])

  useEffect(() => {
    if (picked) pinRef.current?.focus()
  }, [picked])

  useEffect(() => {
    if (lockedUntil > 0 && !locked) {
      setLockedUntil(0)
      setMessage(null)
    }
  }, [lockedUntil, locked])

  const roleOf = (id: string) => s.data.accounts.accounts.find((a) => a.crewId === id)?.role ?? null
  const crew = s.data.crew.crew.filter((c) => roleOf(c.id) !== null)

  const pick = (id: string) => {
    setPicked(id)
    setPin('')
    setMessage(null)
    const until = attemptsFor(localStorage, id).lockedUntil
    setLockedUntil(until > Date.now() ? until : 0)
  }

  const submit = async (value: string) => {
    if (!picked || busy || locked || !isPinShaped(value)) return
    setBusy(true)
    setPin('') // the PIN does not stay in state once it has been checked
    const r = await s.logIn(picked, value)
    setBusy(false)
    if (r.ok) {
      window.location.assign(nextUrl())
      return
    }
    if (r.reason === 'locked') {
      setLockedUntil(r.lockedUntil)
      setMessage('Too many wrong PINs.')
    } else {
      setMessage(`Wrong PIN. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'try' : 'tries'} left before a short lockout.`)
      pinRef.current?.focus()
    }
  }

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPin(digits)
    if (digits.length === PIN_LENGTH) void submit(digits)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(pin)
  }

  if (s.user) {
    return (
      <Shell>
        <section className="login-card">
          <h2>Signed in as {s.nameOf(s.user.crewId)}</h2>
          <p className="login-sub">{ROLE_LABEL[s.user.role]}</p>
          <div className="login-actions">
            <a className="login-btn login-btn-primary" href={nextUrl()}>
              Continue
            </a>
            <button type="button" className="login-btn" onClick={s.logOut}>
              Log out
            </button>
          </div>
        </section>
      </Shell>
    )
  }

  const name = picked ? s.nameOf(picked) : ''
  return (
    <Shell>
      {!picked ? (
        <section className="login-card" aria-labelledby="who">
          <h2 id="who">Who is checking in?</h2>
          <ul className="login-crew">
            {crew.map((c) => {
              const role = roleOf(c.id) as AccountRole
              return (
                <li key={c.id}>
                  <button type="button" className="login-person" onClick={() => pick(c.id)}>
                    <span className="login-avatar" aria-hidden="true">
                      {c.name.slice(0, 1)}
                    </span>
                    <span className="login-person-name">{c.name}</span>
                    <span className={`login-role login-role-${role}`}>{ROLE_LABEL[role]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : (
        <section className="login-card" aria-labelledby="pin-title">
          <button type="button" className="login-back" onClick={() => setPicked(null)}>
            ‹ Not {name}?
          </button>
          <div className="login-picked">
            <span className="login-avatar login-avatar-lg" aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <h2 id="pin-title">{name}</h2>
            <p className="login-sub">Enter your {PIN_LENGTH}-digit PIN</p>
          </div>
          <form onSubmit={onSubmit} className="login-form">
            <label htmlFor="pin" className="visually-hidden">
              PIN for {name}
            </label>
            <div className="login-dots" aria-hidden="true">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <span key={i} className={i < pin.length ? 'login-dot login-dot-on' : 'login-dot'} />
              ))}
            </div>
            <input
              ref={pinRef}
              id="pin"
              className="login-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              value={pin}
              disabled={busy || locked}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby="pin-msg"
            />
            <p id="pin-msg" className="login-msg" role="status" aria-live="polite">
              {busy ? 'Checking…' : locked ? `${message ?? 'Locked.'} Try again in ${mmss(lockedUntil - now)}.` : message}
            </p>
            <button type="submit" className="login-btn login-btn-primary" disabled={busy || locked || pin.length !== PIN_LENGTH}>
              Log in
            </button>
          </form>
        </section>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="login">
      <div className="login-aurora" aria-hidden="true" />
      <header className="login-brand">
        <h1>Shipshape</h1>
        <p>Is it me, or the ship?</p>
      </header>
      <main className="login-main">{children}</main>
      <footer className="login-foot">
        <p>
          <span className="login-tag">Simulated crew</span> No real person's data. Demo PINs are listed in the README.
        </p>
        <p>
          Your session ends when you close this tab. Shipshape says "likely" and never diagnoses.
        </p>
      </footer>
    </div>
  )
}
