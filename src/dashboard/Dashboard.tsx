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
import './dashboard.css'

// Personal dashboard of the logged-in crew member, and only theirs: nobody opens another
// person's dashboard. In the demo crew Chen is the one to follow: fine while the cabin CO2 is high
// (day 213), still off once the air is back to normal (day 221), and day 3 (day 223). The same four
// days as the crew app's golden path.
const TREND_DAYS = 14
const SCENES: { day: number; label: string }[] = [
  { day: 212, label: 'CO₂ climbs' },
  { day: 213, label: 'Cabin high' },
  { day: 221, label: 'Likely you' },
  { day: 223, label: 'Day 3' },
]

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

  // ?day=221 opens the dashboard on that mission day: the store reads it at start-up.
  const [lo, hi] = s.dayRange

  useEffect(() => {
    document.title = `${name} · Shipshape`
    document.body.classList.add('dash-body')
    return () => document.body.classList.remove('dash-body')
  }, [name])


  // Data labels and the skeleton's licence credit. On wide screens they sit under the
  // notifications so the page fits one screen; on narrower ones, at the foot of the page.
  const credits = (
    <>
      <p>
        <span className="tag">Simulated crew</span> No real person's data. <span className="tag tag-real">Real ISS cabin air</span> CO₂, temperature and humidity, NASA OSDR, {s.data.cabin.meta.mission}, replayed on the mission calendar. Shipshape says
        "likely" and never diagnoses.
      </p>
      <p className="dash-credit">
        Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0). Modified by open-anatomy-3d (https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0. Skeleton extracted and
        re-exported. For visualisation only.
      </p>
    </>
  )

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
            <p className="bar-name">{name}</p>
            <p className="bar-meta">{s.mission.label} · Personal dashboard</p>
          </div>
        </div>

        <div className="seg" role="group" aria-label="Demo days">
          {SCENES.map((sc) => (
            <button key={sc.day} type="button" className={today === sc.day ? 'seg-on' : ''} aria-pressed={today === sc.day} onClick={() => s.setToday(sc.day)}>
              {sc.label}
            </button>
          ))}
        </div>

        <div className="daystep" aria-label="Mission day">
          <button type="button" onClick={() => s.setToday(Math.max(lo, today - 1))} disabled={today <= lo} aria-label="Previous day">
            ‹
          </button>
          <div className="daystep-day">
            <span>Mission day</span>
            <strong>{today}</strong>
          </div>
          <button type="button" onClick={() => s.setToday(Math.min(hi, today + 1))} disabled={today >= hi} aria-label="Next day">
            ›
          </button>
        </div>

        <div className="acct">
          <span className="acct-links">
            <a href={hrefOf('checkin', import.meta.env.BASE_URL, `?day=${today}`)}>Check in</a>
            {mayOpen(user, 'app') && <a href={hrefOf('app', import.meta.env.BASE_URL, `?day=${today}`)}>Crew app</a>}
            <button type="button" onClick={s.logOut}>
              Log out
            </button>
          </span>
        </div>
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

          <footer className="dash-foot dash-foot-side">{credits}</footer>
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

      <footer className="dash-foot dash-foot-end">{credits}</footer>
    </div>
  )
}
