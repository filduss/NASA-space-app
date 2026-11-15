import { useEffect } from 'react'
import { hrefOf, type Page } from './auth/paths.ts'
import { mayOpen } from './auth/session.ts'
import type { AccountRole } from './data/types.ts'
import { cabinLevel } from './dashboard/model.ts'
import { useStore, type Role, type Screen } from './state.tsx'
import { Origin } from './ui/bits.tsx'
import { CheckInScreen } from './ui/CheckInScreen.tsx'
import { CrewBoard } from './ui/CrewBoard.tsx'
import { CmoInbox, SurgeonView } from './ui/Medical.tsx'
import { RoleSwitcher } from './ui/RoleSwitcher.tsx'
import { ShipAlert } from './ui/ShipAlert.tsx'

const LABELS: Record<Screen, string> = {
  board: 'Crew board',
  checkin: 'Check-in',
  ship: 'Ship',
  inbox: 'Inbox',
  summary: 'Summaries',
}

const ROLE_WORD: Record<AccountRole, string> = { astronaut: 'astronaut', medical: 'medical officer', surgeon: 'flight surgeon, Earth' }

// The tabs of each view. A crew member's own view is the check-in page; the crew app is the medical
// console, where the flight surgeon sees everything the crew medical officer sees, plus the summaries.
const TABS: Record<Role['kind'], Screen[]> = {
  crew: ['checkin'],
  cmo: ['board', 'inbox', 'ship'],
  surgeon: ['board', 'inbox', 'ship', 'summary'],
}

/** Links to the other pages this person may open. */
const OTHER_PAGES: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'My dashboard' },
  { page: 'checkin', label: 'Check in' },
  { page: 'app', label: 'Crew app' },
]

export function App({ page }: { page: 'checkin' | 'app' }) {
  const s = useStore()
  const tabs = TABS[s.role.kind]
  const screen = tabs.includes(s.screen) ? s.screen : tabs[0]
  const crewId = s.role.kind === 'crew' ? s.role.crewId : null
  // The Ship tab carries the same orange / red as the cabin air on the dashboard.
  const shipLevel = s.todayResult.decision.outcome === 'ship' ? (cabinLevel(s.todayResult.cabin) === 'alert' ? 'alert' : 'watch') : null
  const who = s.role.kind === 'crew' ? s.nameOf(s.role.crewId) : s.role.kind === 'cmo' ? 'Crew medical officer' : 'Flight surgeon, Mission Control (Earth)'
  const me = s.user ? s.nameOf(s.user.crewId) : ''
  const myRole = s.user ? ROLE_WORD[s.user.role] : ''

  useEffect(() => {
    document.title = `${LABELS[screen]} · Ship Or Me?`
  }, [screen])

  return (
    <div className={page === 'checkin' ? 'app app-narrow' : 'app'}>
      <header className="appbar">
        <div className="appbar-brand">
          <span className="appicon" aria-hidden="true">
            S
          </span>
          <div>
            <p className="appbar-name">Ship Or Me?</p>
            <p className="appbar-meta">Is it me, or the ship?</p>
          </div>
        </div>

        {tabs.length > 1 && (
          <nav className="tabs" aria-label="Screens">
            {tabs.map((t) => (
              <button key={t} type="button" className={t === screen ? 'tab tab-on' : 'tab'} aria-current={t === screen ? 'page' : undefined} onClick={() => s.setScreen(t)}>
                {LABELS[t]}
                {t === 'ship' && shipLevel && (
                  <span className={`tab-flag tab-flag-${shipLevel}`} role="img" aria-label="ship alert active">
                    {shipLevel === 'alert' ? '◆' : '▲'}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        <nav className="account" aria-label="Account">
          <span className="account-who">
            <span className="avatar-sm" aria-hidden="true">
              {me.slice(0, 1)}
            </span>
            <span>
              {me} <span className="account-role">· {myRole}</span>
            </span>
          </span>
          {OTHER_PAGES.filter((o) => o.page !== page && s.user && mayOpen(s.user, o.page)).map((o) => (
            <a key={o.page} href={hrefOf(o.page, import.meta.env.BASE_URL, `?day=${s.today}`)}>
              {o.label}
            </a>
          ))}
          <button type="button" className="link" onClick={s.logOut}>
            Log out
          </button>
        </nav>
      </header>

      <section className="intro">
        <div>
          <p className="intro-eyebrow">
            {s.mission.label} · mission day {s.today} · {who}
          </p>
          <h1>{LABELS[screen]}</h1>
        </div>
        <span className="origins">
          <Origin kind="simulated">crew</Origin>
          <Origin kind="real">ISS cabin air, {s.data.cabin.meta.mission}</Origin>
        </span>
      </section>

      <details className="controls">
        <summary>Demo controls</summary>
        <RoleSwitcher />
      </details>

      {/* Keyed by person and day so forms start fresh when either changes. */}
      <main key={`${crewId ?? s.role.kind}-${s.today}`}>
        {screen === 'board' && <CrewBoard />}
        {screen === 'checkin' && crewId && <CheckInScreen crewId={crewId} />}
        {screen === 'ship' && <ShipAlert />}
        {screen === 'inbox' && <CmoInbox />}
        {screen === 'summary' && <SurgeonView />}
      </main>

      <footer className="foot">
        <p>
          Ship Or Me? says "likely" and never diagnoses; it supports the flight surgeon and never replaces one. The crew is simulated; the
          cabin CO₂, temperature and humidity are real ISS telemetry from NASA's Open Science Data Repository, replayed on the mission
          calendar in every setting. Radiation figures are published averages for the chosen setting, not dosimeter readings.
        </p>
      </footer>
    </div>
  )
}
