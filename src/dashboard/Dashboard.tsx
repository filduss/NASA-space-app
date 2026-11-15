import { useEffect, useMemo, useRef, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import { mayOpen, type User } from '../auth/session.ts'
import { vitalLines } from '../data/watch.ts'
import { exerciseWeek } from '../engine/gravity.ts'
import { useStore } from '../state.tsx'
import { delayText, symptomLabel } from '../ui/text.ts'
import { ChartSheet, type ChartTarget } from './ChartSheet.tsx'
import { Sparkline } from './charts.tsx'
import type { RangeKey } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
import { cabinLevel, notices, vitals, worst, zoneStates, ZONES, type Level, type Notice, type Vital, type ZoneKey } from './model.ts'
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

function VitalTile({ v, onOpen }: { v: Vital; onOpen: () => void }) {
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
      <p className="tile-sub">{hover ?? (v.usual === null ? 'Learning your normal' : `Usual ${v.usual}${v.unit === '/10' ? '' : ` ${v.unit}`}`)}</p>
      <Sparkline series={v.series} usual={usualNum} level={v.level} format={fmt} onHover={setHover} />
    </article>
  )
}

/** A 14-day line of one watch reading, with its value under the pointer. No usual line: these are not judged. */
function WatchTrend({ label, unit, series }: { label: string; unit: string; series: { day: number; v: number | null }[] }) {
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div className="watch-trend">
      <span className="watch-label">
        {label}, {TREND_DAYS} days{hover ? ` · ${hover}` : ''}
      </span>
      <Sparkline series={series} usual={null} level="ok" format={(v) => `${Math.round(v)} ${unit}`} onHover={setHover} />
    </div>
  )
}

function NoticeCard({ n, onOpen }: { n: Notice; onOpen?: () => void }) {
  return (
    <li className={`note note-${n.level}`}>
      <span className="note-icon">
        <LevelIcon level={n.level} size={18} />
      </span>
      <div className="note-text">
        <p className="note-title">{n.title}</p>
        <p className="note-body">{n.body}</p>
      </div>
      {onOpen && (
        <button type="button" className="note-go" onClick={onOpen} aria-label={`Show ${n.title} on the body`}>
          ›
        </button>
      )}
    </li>
  )
}

const NOTICE_ZONE = (id: string): ZoneKey | null => {
  if (id === 'co2' || id === 'ship') return 'chest'
  if (id === 'ind-fatigue') return 'limbs'
  if (id === 'exercise') return 'core'
  if (id.startsWith('ind-') || id === 'safety') return 'head'
  return null
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
  // The (simulated) wrist wearable's vitals: shown for information, never judged.
  const vitalsToday = history.find((c) => c.day === today)?.watch ?? null
  const vitalTrend = (pick: (c: { restingHr: number; hrvMs: number }) => number) =>
    Array.from({ length: TREND_DAYS }, (_, i) => {
      const d = today - TREND_DAYS + 1 + i
      const w = history.find((c) => c.day === d)?.watch
      return { day: d, v: w ? pick(w) : null }
    })
  const zones = useMemo(() => zoneStates(me, cabin, exercise), [me, cabin, exercise])
  const list = useMemo(() => notices(me, cabin, s.commDelaySec, exercise), [me, cabin, s.commDelaySec, exercise])
  const tiles = useMemo(() => vitals(me, history, today, TREND_DAYS), [me, history, today])
  const chartVital = chart ? tiles.find((t) => t.key === chart.key) : undefined
  const overall = worst(...ZONES.map((z) => zones[z.key].level))
  const co2Level = cabinLevel(cabin)

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
        <span className="tag">Simulated crew</span> No real person's data. <span className="tag tag-real">Real ISS CO₂</span> NASA OSDR, {s.data.cabin.meta.mission}, replayed on the mission calendar. Shipshape says
        "likely" and never diagnoses.
      </p>
      <p className="dash-credit">
        Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0). Modified by open-anatomy-3d (https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0. Skeleton extracted and
        re-exported. For visualisation only.
      </p>
    </>
  )

  const hero = heroText(overall, me.attribution, me.tier, me.episodeDay, me.assessment.checkedIn, co2Level)

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
          <div className={`hero hero-${overall}`}>
            <div className="hero-top">
              <LevelIcon level={overall} size={28} />
              <span className={`pill pill-${overall}`}>{LEVEL_WORD[overall]}</span>
            </div>
            <h1>{hero.title}</h1>
            <p>{hero.body}</p>
            <dl className="hero-facts">
              <div>
                <dt>Check-in UTC</dt>
                <dd>{me.assessment.checkedIn ? '08:00' : 'Not yet'}</dd>
              </div>
              <div>
                <dt>Flagged</dt>
                <dd>{me.assessment.off.length + (co2Level === 'ok' ? 0 : 1)}</dd>
              </div>
              <div>
                <dt>Earth delay</dt>
                <dd>{delayText(s.commDelaySec)}</dd>
              </div>
            </dl>
          </div>

          <div className="panel">
            <h2 className="panel-title">
              Notifications <span className="badge">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <ul className="notices">
                <NoticeCard n={{ id: 'clear', level: 'ok', title: 'Nothing needs your attention', body: 'Everything you logged today sits inside your own usual range, and the cabin air is normal.' }} />
              </ul>
            ) : (
              <ul className="notices">
                {list.map((n) => {
                  const z = NOTICE_ZONE(n.id)
                  return <NoticeCard key={n.id} n={n} onOpen={z ? () => setFocus(z) : undefined} />
                })}
              </ul>
            )}
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
              Vitals <span className="panel-note">vs. your own normal · {TREND_DAYS} days · sleep from your watch</span>
            </h2>
            <div className="tiles">
              {tiles.map((v) => (
                <VitalTile key={v.key} v={v} onOpen={() => setChart({ kind: 'vital', key: v.key })} />
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

          <div className="panel watchp">
            <h2 className="panel-title">
              From your watch <span className="panel-note">simulated · for information</span>
            </h2>
            {vitalsToday ? (
              <div className="watch-grid">
                {vitalLines(vitalsToday).map((l) => (
                  <div key={l.label}>
                    <span className="watch-label">{l.label}</span>
                    <p className="watch-value">{l.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="watch-note">No watch data today</p>
            )}
            <div className="watch-trends">
              <WatchTrend label="Resting heart rate" unit="bpm" series={vitalTrend((w) => w.restingHr)} />
              <WatchTrend label="HRV" unit="ms" series={vitalTrend((w) => w.hrvMs)} />
            </div>
            <p className="watch-note">Shipshape's rules don't use these yet. Next, each will be compared with your own normal once a real device feeds them.</p>
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

function heroText(overall: Level, attribution: string, tier: number, episodeDay: number, checkedIn: boolean, co2: Level): { title: string; body: string } {
  if (!checkedIn) return { title: 'Good morning', body: 'No check-in yet today. Your trends run up to your last one.' }
  if (tier === 4) return { title: 'Help is on the way', body: 'Your crew medical officer was told privately. The game is paused for you today.' }
  if (tier === 3) return { title: `Still off your usual, day ${episodeDay}`, body: 'A short summary went to the flight surgeon. It lists what changed, never a diagnosis.' }
  if (attribution === 'ship') return { title: 'Likely the ship, not you', body: 'Most of the crew show the same change while cabin CO₂ is above its usual level.' }
  if (attribution === 'me' || attribution === 'shared') return { title: 'Something is off your usual', body: 'Only you see this. Take it easy today and check in again tomorrow.' }
  if (co2 !== 'ok') return { title: 'You are within your normal', body: 'Your body is steady. The cabin air is flagged in your notifications.' }
  if (overall === 'ok') return { title: 'All within your normal', body: 'Everything you logged today sits inside your own usual range.' }
  return { title: 'Worth a look', body: 'Something is flagged below.' }
}
