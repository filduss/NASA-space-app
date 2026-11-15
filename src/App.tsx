import { useEffect } from 'react'
import type { AccountRole } from './data/types.ts'
import { cabinLevel } from './dashboard/model.ts'
import { useStore, type Role, type Screen } from './state.tsx'
import { Origin } from './ui/bits.tsx'
import { CheckInScreen } from './ui/CheckInScreen.tsx'
import { CrewBoard } from './ui/CrewBoard.tsx'
import { CmoInbox, SurgeonView } from './ui/Medical.tsx'
import { DemoDock } from './ui/DemoDock.tsx'
import { DemoSettings } from './ui/DemoSettings.tsx'
import { ShipAlert } from './ui/ShipAlert.tsx'
import { Toolbar } from './ui/Toolbar.tsx'

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

/** The person's other pages, offered in the toolbar when they may open them. */
const OTHER_PAGES = ['dashboard', 'checkin', 'app'] as const

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
    document.title = `${LABELS[screen]} · Shipshape`
  }, [screen])

  return (
    <div className={page === 'checkin' ? 'app app-narrow' : 'app'}>
      <header className="appbar">
        <div className="appbar-brand">
          <span className="appicon" aria-hidden="true">
            S
          </span>
          <div>
            <p className="appbar-name">Shipshape</p>
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

        <div className="account">
          <span className="account-who">
            <span className="avatar-sm" aria-hidden="true">
              {me.slice(0, 1)}
            </span>
            <span className="account-text">
              <span className="account-name">{me}</span>
              <span className="account-role">{myRole}</span>
            </span>
          </span>
          {s.user && <Toolbar user={s.user} pages={OTHER_PAGES.filter((p) => p !== page)} day={s.today} onLogOut={s.logOut} />}
        </div>
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


      {/* Keyed by person and day so forms start fresh when either changes. */}
      <main key={`${crewId ?? s.role.kind}-${s.today}`}>
        {screen === 'board' && <CrewBoard />}
        {screen === 'checkin' && crewId && <CheckInScreen crewId={crewId} />}
        {screen === 'ship' && <ShipAlert />}
        {screen === 'inbox' && <CmoInbox />}
        {screen === 'summary' && <SurgeonView />}
      </main>

      <DemoDock settings={<DemoSettings />} />

      <footer className="foot">
        <p>
          Shipshape says "likely" and never diagnoses; it supports the flight surgeon and never replaces one. The crew is simulated; the
          cabin CO₂, temperature and humidity are real ISS telemetry from NASA's Open Science Data Repository, replayed on the mission
          calendar in every setting. Radiation figures are published averages for the chosen setting, not dosimeter readings.
        </p>
      </footer>
    </div>
  )
}
