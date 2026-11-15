import { useEffect, useMemo, useRef, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import { mayOpen, type User } from '../auth/session.ts'
import { vitalLines } from '../data/wearable.ts'
import { exerciseWeek } from '../engine/gravity.ts'
import { useStore } from '../state.tsx'
import { symptomLabel } from '../ui/text.ts'
import { ChartSheet, type ChartTarget } from './ChartSheet.tsx'
import { Sparkline } from './charts.tsx'
import type { RangeKey } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
import { notices, verdict, vitals, zoneStates, ZONES, type Notice, type Vital, type VerdictSide, type ZoneKey } from './model.ts'
import { SkeletonView } from './SkeletonView.tsx'
import { DemoDock } from './DemoDock.tsx'
import './dashboard.css'

// Personal dashboard of the logged-in crew member, and only theirs: nobody opens another
// person's dashboard. The demo's day controls live apart from it, in DemoDock.
const TREND_DAYS = 14

/** Toolbar glyphs, drawn in the spirit of SF Symbols: one stroke weight, rounded ends. */
function NavIcon({ kind }: { kind: 'checkin' | 'app' | 'logout' }) {
  return (
    <svg className="tbtn-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      {kind === 'checkin' && (
        <>
          <rect x="3.25" y="2.75" width="11.5" height="13" rx="2.5" />
          <path d="M6.5 2.75v-.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5M6.25 9.4l1.8 1.8 3.7-3.9" />
        </>
      )}
      {kind === 'app' && (
        <>
          <rect x="1.75" y="4.75" width="14.5" height="10.5" rx="2.5" />
          <path d="M6.5 4.75v-1a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M9 7.6v5M6.5 10.1h5" />
        </>
      )}
      {kind === 'logout' && (
        <>
          <path d="M7.5 2.75H4.75a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2H7.5M12 5.5L15.25 9 12 12.5M15 9H7" />
        </>
      )}
    </svg>
  )
}

/** The "open larger" control on the vital tiles. */
function ExpandButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="expand"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M7 1h4v4M11 1L7 5M5 11H1V7M1 11l4-4" />
      </svg>
    </button>
  )
}

/**
 * `reference` is a published figure for real ISS crews, shown beside the person's own usual for
 * context. The rules compare each person only with their own normal; the reference judges nothing.
 */
function VitalTile({ v, onOpen, reference }: { v: Vital; onOpen: () => void; reference?: { text: string; title: string } }) {
  const [hover, setHover] = useState<string | null>(null)
  const fmt = (x: number) => (v.key === 'reaction' ? `${Math.round(x)} ms` : v.key === 'sleepHours' ? `${x.toFixed(1)} h` : `${x}/10`)
  const usualNum = v.usual === null ? null : Number(v.usual)
  // The whole tile opens the chart on click; the button is the keyboard and screen-reader route.
  return (
    <article className={`tile tile-${v.level} tile-open`} onClick={onOpen}>
      <header className="tile-head">
        <h3>{v.label}</h3>
        <ExpandButton label={`Open ${v.label} chart`} onClick={onOpen} />
      </header>
      <div className="tile-row">
        <p className="tile-value">
          {v.value}
          {v.value !== '–' && <span className="tile-unit">{v.unit === '/10' ? ' / 10' : ` ${v.unit}`}</span>}
        </p>
        {v.level !== 'ok' && (
          <span className={`pill pill-${v.level}`}>
            <LevelIcon level={v.level} size={12} />
            {LEVEL_WORD[v.level]}
          </span>
        )}
      </div>
      <p className="tile-sub">
        {hover ?? (v.usual === null ? 'Learning your normal' : `Usual ${v.usual}${v.unit === '/10' ? '' : ` ${v.unit}`}`)}
        {!hover && reference && (
          <span className="tile-ref" title={reference.title}>
            {' '}
            · {reference.text}
          </span>
        )}
      </p>
      <Sparkline series={v.series} usual={usualNum} level={v.level} format={fmt} onHover={setHover} />
    </article>
  )
}

/** One side of the answer: a level by shape, colour and word. The detail is a tooltip. */
function HeroChip({ label, side, known = true }: { label: string; side: VerdictSide; known?: boolean }) {
  if (!known) {
    return (
      <li className="hero-chip hero-chip-idle" title={side.detail}>
        <svg className="lvl" width={14} height={14} viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
        <span className="hero-chip-label">{label}</span>
        <span className="hero-chip-word">No data</span>
      </li>
    )
  }
  return (
    <li className={`hero-chip hero-chip-${side.level}`} title={side.detail}>
      <LevelIcon level={side.level} size={14} />
      <span className="hero-chip-label">{label}</span>
      <span className="hero-chip-word">{LEVEL_WORD[side.level]}</span>
    </li>
  )
}

export function Dashboard() {
  const s = useStore()
  // RequireUser renders this page only for a logged-in person.
  const user = s.user as User
  const crewId = user.crewId
  const [focus, setFocus] = useState<ZoneKey | null>(null)
  // The open chart sheet, and the last range picked (kept between openings).
  const [chart, setChart] = useState<ChartTarget | null>(null)
  const [vitalRange, setVitalRange] = useState<RangeKey>('14d')
  const name = s.nameOf(crewId)
  const today = s.today
  const me = s.todayResult.people[crewId]
  const cabin = s.todayResult.cabin

  const history = useMemo(() => s.checkIns.filter((c) => c.crewId === crewId), [s.checkIns, crewId])
  const exercise = useMemo(() => exerciseWeek(history, today), [history, today])
  // The (simulated) wearable's vitals: shown for information, never judged.
  const vitalsToday = history.find((c) => c.day === today)?.watch ?? null
  const zones = useMemo(() => zoneStates(me, exercise), [me, exercise])
  const list = useMemo(() => notices(me, cabin, s.commDelaySec, exercise), [me, cabin, s.commDelaySec, exercise])
  const tiles = useMemo(() => vitals(me, history, today, TREND_DAYS), [me, history, today])
  const chartVital = chart ? tiles.find((t) => t.key === chart.key) : undefined
  const v = verdict(me, cabin)
  // A published figure for real ISS crews, shown beside the person's own usual sleep (backtest.json).
  const issSleep = s.data.backtest?.meta.issCrews?.sleepHours

  // An iOS-style banner drops in when a day brings something new to look at.
  const [banner, setBanner] = useState<Notice | null>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const top = list[0]
    if (!top || top.level === 'ok') return
    setBanner(top)
    const t = window.setTimeout(() => setBanner(null), 5200)
    return () => window.clearTimeout(t)
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = `${name} · Ship Or Me?`
    document.body.classList.add('dash-body')
    return () => document.body.classList.remove('dash-body')
  }, [name])


  return (
    <div className="dash">
      <div className="dash-aurora" aria-hidden="true" />

      {banner && (
        <div className={`toast toast-${banner.level}`} role="status" onClick={() => setBanner(null)}>
          <span className="toast-app">
            <LevelIcon level={banner.level} size={18} />
          </span>
          <div>
            <p className="toast-meta">
              Ship Or Me? · Day {today}
            </p>
            <p className="toast-title">{banner.title}</p>
            <p className="toast-body">{banner.body}</p>
          </div>
        </div>
      )}

      <header className="bar">
        <div className="bar-who">
          <span className="avatar" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
          <div>
            <p className="bar-name">
              {name} <span className="bar-sim">Simulated</span>
            </p>
            <p className="bar-meta">
              {s.mission.label} · <span className="bar-meta-long">Mission day</span>
              <span className="bar-meta-short">Day</span> {today}
            </p>
          </div>
        </div>

        <nav className="toolbar" aria-label="Account">
          <a className="tbtn tbtn-tint" href={hrefOf('checkin', import.meta.env.BASE_URL, `?day=${today}`)} title="Check in">
            <NavIcon kind="checkin" />
            <span className="tbtn-label">Check in</span>
          </a>
          {mayOpen(user, 'app') && (
            <a className="tbtn" href={hrefOf('app', import.meta.env.BASE_URL, `?day=${today}`)} title="Crew app">
              <NavIcon kind="app" />
              <span className="tbtn-label">Crew app</span>
            </a>
          )}
          <span className="toolbar-sep" aria-hidden="true" />
          <button type="button" className="tbtn tbtn-quiet" onClick={s.logOut} title="Log out">
            <NavIcon kind="logout" />
            <span className="tbtn-label">Log out</span>
          </button>
        </nav>
      </header>

      <main className="grid">
        <section className="col col-left">
          <div className={`hero hero-${v.tint}`}>
            <p className="hero-kicker">Ship check</p>
            <h1>{v.title}</h1>
            <ul className="hero-chips">
              <HeroChip label="You" side={v.you} />
              <HeroChip label="CO₂" side={v.co2} known={v.co2.known} />
            </ul>
          </div>

          <div className="panel watchp">
            <h2 className="panel-title watch-title">From your wearable</h2>
            <p className="watch-sub">Simulated · for information</p>
            {vitalsToday ? (
              <dl className="watch-list">
                {vitalLines(vitalsToday).map((l) => (
                  <div key={l.label} className="watch-row">
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="watch-note">No wearable reading today</p>
            )}
            <p className="watch-note">The app's rules don't use these yet. Next, each will be compared with your own normal once a real device feeds them.</p>
          </div>

        </section>

        <section className="col col-stage" aria-label="Body status">
          <div className="stage">
            <SkeletonView zones={zones} focus={focus} onFocus={setFocus} />
            <div className="stage-top">
              <p className="stage-eyebrow">Body status</p>
              {focus && (
                <button type="button" className="chip-btn" onClick={() => setFocus(null)}>
                  Whole body
                </button>
              )}
            </div>
            <ul className="zones">
              {ZONES.map((z) => {
                const st = zones[z.key]
                return (
                  <li key={z.key}>
                    <button type="button" className={`zone zone-${st.level}${focus === z.key ? ' zone-on' : ''}`} onClick={() => setFocus(focus === z.key ? null : z.key)} aria-pressed={focus === z.key}>
                      <LevelIcon level={st.level} size={14} />
                      <span className="zone-name">{z.label}</span>
                      <span className="zone-why">{st.level === 'ok' ? 'Normal' : st.reasons.join(', ')}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="col col-right">
          <div className="panel">
            <h2 className="panel-title">
              Vitals <span className="panel-note">vs. your own normal · {TREND_DAYS} days · sleep from your wearable</span>
            </h2>
            <div className="tiles">
              {tiles.map((v) => (
                <VitalTile
                  key={v.key}
                  v={v}
                  onOpen={() => setChart({ kind: 'vital', key: v.key })}
                  reference={
                    v.key === 'sleepHours' && issSleep
                      ? {
                          text: `ISS ${issSleep.value} h`,
                          title: `Real ISS crews: ${issSleep.text} (${issSleep.source}). For context only: the rules compare you with your own normal.`,
                        }
                      : undefined
                  }
                />
              ))}
              <article className={`tile tile-${me.assessment.symptoms.length ? (zones.head.level === 'alert' ? 'alert' : 'watch') : 'ok'}`}>
                <header className="tile-head">
                  <h3>Symptoms</h3>
                </header>
                <p className="tile-value tile-value-sm">{me.assessment.symptoms.length ? me.assessment.symptoms.length : 'None'}</p>
                <p className="tile-sub">{me.assessment.symptoms.length ? me.assessment.symptoms.map(symptomLabel).join(', ') : 'Nothing reported today'}</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      {chartVital && chart && (
        <ChartSheet
          target={chart}
          vital={chartVital}
          range={vitalRange}
          onRange={setVitalRange}
          onClose={() => setChart(null)}
        />
      )}

      <DemoDock />
    </div>
  )
}
