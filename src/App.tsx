import { useStore, type Screen } from './state.tsx'
import { About } from './ui/About.tsx'
import { Origin } from './ui/bits.tsx'
import { CheckInScreen } from './ui/CheckInScreen.tsx'
import { CrewBoard } from './ui/CrewBoard.tsx'
import { CmoInbox, SurgeonView } from './ui/Medical.tsx'
import { MeView } from './ui/MeView.tsx'
import { RoleSwitcher } from './ui/RoleSwitcher.tsx'
import { ShipAlert } from './ui/ShipAlert.tsx'

const LABELS: Record<Screen, string> = {
  board: 'Crew board',
  checkin: 'Check-in',
  me: 'Me',
  ship: 'Ship',
  inbox: 'Inbox',
  summary: 'Summaries',
  about: 'How it answers the challenge',
}

export function App() {
  const s = useStore()
  const tabs: Screen[] = s.role.kind === 'crew' ? ['board', 'checkin', 'me', 'ship'] : s.role.kind === 'cmo' ? ['board', 'inbox', 'ship'] : ['summary']
  // The challenge page is for judges and visitors: it opens from the demo controls, not from a tab.
  const screen = s.screen === 'about' || tabs.includes(s.screen) ? s.screen : tabs[0]
  const crewId = s.role.kind === 'crew' ? s.role.crewId : null
  const shipOn = s.todayResult.decision.outcome === 'ship'
  const who = s.role.kind === 'crew' ? s.nameOf(s.role.crewId) : s.role.kind === 'cmo' ? 'Crew medical officer' : 'Flight surgeon'

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Shipshape</h1>
          <p>Is it me, or the ship?</p>
        </div>
        <div className="context">
          <span>
            {s.mission.label} · mission day {s.today} · {who}
          </span>
          <span className="origins">
            <Origin kind="simulated">crew</Origin>
            <Origin kind="real">ISS CO₂, {s.data.cabin.meta.mission}</Origin>
          </span>
        </div>
        <details className="controls" open>
          <summary>Demo controls</summary>
          <RoleSwitcher />
        </details>
      </header>

      <nav className="tabs" aria-label="Screens">
        {tabs.map((t) => (
          <button key={t} type="button" className={t === screen ? 'tab tab-on' : 'tab'} aria-current={t === screen ? 'page' : undefined} onClick={() => s.setScreen(t)}>
            {LABELS[t]}
            {t === 'ship' && shipOn && <span className="tab-flag" aria-label="alert active"> ▲</span>}
          </button>
        ))}
      </nav>

      {/* Keyed by person and day so forms start fresh when either changes. */}
      <main key={`${crewId ?? s.role.kind}-${s.today}`}>
        {screen === 'board' && <CrewBoard />}
        {screen === 'checkin' && crewId && <CheckInScreen crewId={crewId} />}
        {screen === 'me' && crewId && <MeView crewId={crewId} />}
        {screen === 'ship' && <ShipAlert />}
        {screen === 'about' && <About />}
        {screen === 'inbox' && <CmoInbox />}
        {screen === 'summary' && <SurgeonView />}
      </main>

      <footer className="foot">
        <p>
          Shipshape rewards honesty, not perfection. It says "likely" and never diagnoses; it supports the flight surgeon and never replaces
          one. The crew is simulated; the cabin CO₂ is real ISS telemetry from NASA's Open Science Data Repository, replayed on the
          mission calendar in every setting. Radiation figures are published averages for the chosen setting, not dosimeter readings.
        </p>
      </footer>
    </div>
  )
}
