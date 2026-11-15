import { useEffect } from 'react'
import type { AccountRole } from './data/types.ts'
import { cabinLevel } from './dashboard/model.ts'
import { Guide } from './guide/Guide.tsx'
import { useStore, type Role, type Screen } from './state.tsx'
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
const OTHER_PAGES = ['dashboard', 'checkin', 'guide', 'app'] as const

export function App({ page }: { page: 'checkin' | 'guide' | 'app' }) {
  const s = useStore()
  const tabs = TABS[s.role.kind]
  const screen = tabs.includes(s.screen) ? s.screen : tabs[0]
  const crewId = s.role.kind === 'crew' ? s.role.crewId : null
  // The Ship tab carries the same orange / red as the cabin air on the dashboard.
  const shipLevel = s.todayResult.decision.outcome === 'ship' ? (cabinLevel(s.todayResult.cabin) === 'alert' ? 'alert' : 'watch') : null
  const me = s.user ? s.nameOf(s.user.crewId) : ''
  const myRole = s.user ? ROLE_WORD[s.user.role] : ''

  const guide = page === 'guide'
  const heading = guide ? 'Guide' : LABELS[screen]

  useEffect(() => {
    document.title = `${heading} · Ship Or Me?`
  }, [heading])

  // Every page has the same head row on the page itself, with no top bar (as on the dashboard): who and
  // what on the left, the toolbar on the right. The crew app's screens are tabs in a row of their own
  // under it.
  const eyebrow = guide
    ? 'What your readings mean, and why they matter in space'
    : page === 'checkin'
      ? `${me} · ${s.mission.label} · mission day ${s.today}`
      : `${me}, ${myRole} · ${s.mission.label} · mission day ${s.today}`

  return (
    <div className={page === 'checkin' ? 'app app-checkin' : 'app'}>
      <header className="intro intro-page">
        <div className="intro-title">
          <p className="intro-eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
        </div>
        {s.user && <Toolbar user={s.user} pages={OTHER_PAGES.filter((p) => p !== page)} day={s.today} onLogOut={s.logOut} />}
      </header>

      {!guide && tabs.length > 1 && (
        <nav className="tabs-row" aria-label="Screens">
          <div className="tabs" data-tour="screens">
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
          </div>
        </nav>
      )}

      {guide ? (
        <main>
          <Guide />
        </main>
      ) : (
        // Keyed by person and day so forms start fresh when either changes.
        <main key={`${crewId ?? s.role.kind}-${s.today}`}>
          {screen === 'board' && <CrewBoard />}
          {screen === 'checkin' && crewId && <CheckInScreen crewId={crewId} />}
          {screen === 'ship' && <ShipAlert />}
          {screen === 'inbox' && <CmoInbox />}
          {screen === 'summary' && <SurgeonView />}
        </main>
      )}

      {/* The Guide shows no mission day or person's data, so it has no demo controls or walkthrough. */}
      {!guide && <DemoDock settings={<DemoSettings />} page={page} surgeon={s.role.kind === 'surgeon'} />}
    </div>
  )
}
