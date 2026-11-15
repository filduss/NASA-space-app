import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { AccountRole } from '../data/types.ts'
import { useStore } from '../state.tsx'
import { DEMO_PINS, TOUR, tourStop } from './demo.ts'
import { appPath, hrefOf, pageOf, safeNext } from './paths.ts'
import { isPinShaped, PIN_LENGTH } from './pin.ts'
import { attemptsFor, homePage, mayOpen, type User } from './session.ts'
import { TourLink } from './TourLink.tsx'
import './login.css'

/** The on-screen keypad, phone order. Empty strings keep the grid in place. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const

const ROLE_LABEL: Record<AccountRole, string> = { astronaut: 'Astronaut', medical: 'Medical officer', surgeon: 'Flight surgeon' }

/** The ?next= page if this person may open it, otherwise their home page. */
function nextUrl(user: User): string {
  const base = import.meta.env.BASE_URL
  const next = safeNext(new URLSearchParams(window.location.search).get('next'), base, window.location.origin)
  const page = pageOf(appPath(new URL(next, window.location.origin).pathname, base))
  return page !== 'login' && mayOpen(user, page) ? next : hrefOf(homePage(user), base)
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
    document.title = 'Shipshape · Is it me, or the ship?'
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
  const crew = s.data.crew.crew.filter((c) => roleOf(c.id) !== null).map((c) => ({ id: c.id, name: c.name }))
  const crewIds = new Set(crew.map((c) => c.id))
  const earth = s.data.accounts.accounts.filter((a) => !crewIds.has(a.crewId)).map((a) => ({ id: a.crewId, name: s.nameOf(a.crewId) }))

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
    const role = roleOf(picked)
    if (r.ok && role) {
      window.location.assign(nextUrl({ crewId: picked, role }))
      return
    }
    if (r.ok) return
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

  const press = (key: string) => {
    if (busy || locked) return
    if (key === 'back') setPin((p) => p.slice(0, -1))
    else onChange(pin + key)
  }

  // Digits and Backspace typed while a keypad button has focus still go into the PIN.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.target === pinRef.current || e.metaKey || e.ctrlKey || e.altKey) return
    if (/^\d$/.test(e.key)) press(e.key)
    else if (e.key === 'Backspace') press('back')
    else return
    e.preventDefault()
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
            <a className="login-btn login-btn-primary" href={nextUrl(s.user)}>
              Continue
            </a>
            <button type="button" className="login-btn" onClick={s.logOut}>
              Log out
            </button>
          </div>
        </section>
        <Tour />
      </Shell>
    )
  }

  const name = picked ? s.nameOf(picked) : ''
  const people = (list: { id: string; name: string }[]) => (
    <ul className="login-crew">
      {list.map((c) => {
        const role = roleOf(c.id) as AccountRole
        return (
          <li key={c.id}>
            <button type="button" className="login-person" onClick={() => pick(c.id)}>
              <span className={`login-avatar${role === 'surgeon' ? ' login-avatar-earth' : ''}`} aria-hidden="true">
                {c.name.slice(0, 1)}
              </span>
              <span className="login-person-who">
                <span className="login-person-name">{c.name}</span>
                <span className={`login-role login-role-${role}`}>{ROLE_LABEL[role]}</span>
              </span>
              {DEMO_PINS[c.id] && (
                <span className="login-pin-hint">
                  Demo PIN <strong>{DEMO_PINS[c.id]}</strong>
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
  return (
    <Shell>
      {!picked ? (
        <section className="login-card" aria-labelledby="who">
          <h2 id="who">Who is logging in?</h2>
          <p className="login-group">Crew</p>
          {people(crew)}
          {earth.length > 0 && (
            <>
              <p className="login-group">Mission Control, Earth</p>
              {people(earth)}
            </>
          )}
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
          <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="login-form">
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
              // The keypad below is the keyboard: no system keyboard pops up over it on a phone.
              inputMode="none"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              value={pin}
              disabled={busy || locked}
              onChange={(e) => onChange(e.target.value)}
              aria-describedby="pin-msg"
            />
            <p id="pin-msg" className="login-msg" role="status" aria-live="polite">
              {locked ? `${message ?? 'Locked.'} Try again in ${mmss(lockedUntil - now)}.` : busy ? null : message}
            </p>
            <div className="login-keypad" role="group" aria-label="PIN keypad">
              {KEYS.map((k, i) =>
                k === '' ? (
                  <span key={`blank-${i}`} aria-hidden="true" />
                ) : (
                  <button
                    key={k}
                    type="button"
                    className={k === 'back' ? 'login-key login-key-back' : 'login-key'}
                    onClick={() => press(k)}
                    disabled={busy || locked || (k === 'back' ? pin.length === 0 : pin.length >= PIN_LENGTH)}
                    aria-label={k === 'back' ? 'Delete last digit' : k}
                  >
                    {k === 'back' ? '⌫' : k}
                  </button>
                ),
              )}
            </div>
          </form>
        </section>
      )}
      {/* The tour is help beside the login. Wide screens keep it next to the keypad so nothing
          jumps; on a phone it steps aside once a person is picked. */}
      <Tour picked={picked !== null} />
    </Shell>
  )
}

/** Help for judges, beside the login: the golden path in one click per step, each logging in with that person's public demo PIN. */
function Tour({ picked = false }: { picked?: boolean }) {
  const { nameOf } = useStore()
  return (
    <aside className={`login-tour${picked ? ' login-tour-picked' : ''}`} aria-labelledby="tour">
      <h2 id="tour">
        <span className="login-tour-mark" aria-hidden="true">
          ?
        </span>
        Judging? Take the tour
      </h2>
      <p className="login-tour-sub">Four one-click stops through the demo. Each logs in with that person's demo PIN for you.</p>
      <ol className="login-steps">
        {TOUR.map((t, i) => (
          <li key={t.title}>
            <TourLink stop={tourStop(i)} className="login-step">
              <span className="login-step-n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="login-step-text">
                <span className="login-step-title">{t.title}</span>
                <span className="login-step-body">{t.body}</span>
                <span className="login-step-as">{t.as ? `Opens as ${nameOf(t.as)}` : 'No login needed'}</span>
              </span>
            </TourLink>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="login">
      <div className="login-aurora" aria-hidden="true" />
      <header className="login-brand">
        <h1>Shipshape</h1>
        <p>Is it me, or the ship?</p>
        <p className="login-pitch">
          A daily crew check-in for long missions. When several people feel off at once, it checks real ISS cabin CO₂ before blaming anyone.
        </p>
      </header>
      <main className="login-main">{children}</main>
      <footer className="login-foot">
        <p>
          <span className="login-tag">Simulated crew</span> No real person's data. The demo PINs are shown next to each name.
        </p>
        <p>
          Your session ends when you close this tab. Shipshape says "likely" and never diagnoses.
        </p>
      </footer>
    </div>
  )
}
