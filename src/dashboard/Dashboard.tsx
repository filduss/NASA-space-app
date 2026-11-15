import { useEffect, useMemo, useRef, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import type { User } from '../auth/session.ts'
import { vitalLines } from '../data/wearable.ts'
import { exerciseWeek } from '../engine/gravity.ts'
import { useStore } from '../state.tsx'
import { symptomLabel } from '../ui/text.ts'
import { DemoDock } from '../ui/DemoDock.tsx'
import { Toolbar } from '../ui/Toolbar.tsx'
import { ChartSheet, type ChartTarget } from './ChartSheet.tsx'
import { Sparkline } from './charts.tsx'
import type { RangeKey } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
import { notices, verdict, vitals, zoneStates, ZONES, type Notice, type Vital, type VerdictSide, type ZoneKey } from './model.ts'
import { SkeletonView } from './SkeletonView.tsx'
import './dashboard.css'

// Personal dashboard of the logged-in crew member, and only theirs: nobody opens another
// person's dashboard. The demo's day controls live apart from it, in DemoDock.
const TREND_DAYS = 14

type CheckInState = 'todo' | 'simulated' | 'done'

const CHECK_IN_TEXT: Record<CheckInState, { title: string; sub: string }> = {
  todo: { title: 'Check in', sub: 'Not done today · about a minute' },
  simulated: { title: 'Check in', sub: 'Today’s came from the simulator' },
  done: { title: 'Checked in today', sub: 'View or change your answers' },
}

/** The daily check-in, the one thing the dashboard asks of the person: a large card in the left
 *  column, filled blue until today's is sent, then quiet with a done mark. */
function CheckInCard({ state, day }: { state: CheckInState; day: number }) {
  const text = CHECK_IN_TEXT[state]
  return (
    <a className={`cta cta-${state}`} href={hrefOf('checkin', import.meta.env.BASE_URL, `?day=${day}`)}>
      <span className="cta-icon" aria-hidden="true">
        {state === 'done' ? (
          <svg width="22" height="22" viewBox="0 0 22 22">
            <path d="M5.5 11.5l3.8 3.8 7.2-8" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 18 18">
            <rect x="3.25" y="2.75" width="11.5" height="13" rx="2.5" />
            <path d="M6.5 2.75v-.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5M6.25 9.4l1.8 1.8 3.7-3.9" />
          </svg>
        )}
      </span>
      <span className="cta-text">
        <span className="cta-title">{text.title}</span>
        <span className="cta-sub">{text.sub}</span>
      </span>
      <svg className="cta-chev" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
        <path d="M2 2l6 6-6 6" />
      </svg>
    </a>
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
function HeroChip({ label, side }: { label: string; side: VerdictSide }) {
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
  const todaysCheckIn = history.find((c) => c.day === today)
  const vitalsToday = todaysCheckIn?.watch ?? null
  // Today's check-in: still to do, sent by the person, or filled in by the crew simulator.
  const checkInState: CheckInState = !todaysCheckIn ? 'todo' : todaysCheckIn.simulated ? 'simulated' : 'done'
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
    document.title = `${name} · Shipshape`
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
              Shipshape · Day {today}
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

        <Toolbar user={user} pages={['app']} day={today} onLogOut={s.logOut} />
      </header>

      <main className="grid">
        <section className="col col-left">
          <div className={`hero hero-${v.tint}`}>
            <h1>{v.title}</h1>
            {v.note && <p>{v.note}</p>}
            <ul className="hero-chips">
              <HeroChip label="You" side={v.you} />
              <HeroChip label="Cabin air" side={v.ship} />
            </ul>
          </div>

          <CheckInCard state={checkInState} day={today} />

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
            <p className="watch-note">Shipshape's rules don't use these yet. Next, each will be compared with your own normal once a real device feeds them.</p>
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
