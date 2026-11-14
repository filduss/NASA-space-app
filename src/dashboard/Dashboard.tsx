import { useEffect, useMemo, useRef, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import { mayOpen, type User } from '../auth/session.ts'
import { RULES } from '../engine/config.ts'
import { useStore } from '../state.tsx'
import { symptomLabel } from '../ui/text.ts'
import { Co2Chart, Sparkline } from './charts.tsx'
import { cabinLevel, notices, vitals, worst, zoneStates, ZONES, type Level, type Notice, type Vital, type ZoneKey } from './model.ts'
import { SkeletonView } from './SkeletonView.tsx'
import './dashboard.css'

// Personal dashboard of the logged-in crew member, and only theirs: nobody opens another
// person's dashboard. In the demo crew Chen is the one to follow: caught up in the cabin CO2
// event (day 219) and the one still off on day 3 (day 223).
const TREND_DAYS = 14
const SCENES: { day: number; label: string }[] = [
  { day: 212, label: 'Nominal' },
  { day: 219, label: 'Cabin CO₂' },
  { day: 223, label: 'Day 3' },
]

const LEVEL_WORD: Record<Level, string> = { ok: 'Normal', watch: 'Watch', alert: 'Alert' }

/** Shape carries the level as well as colour: circle, triangle, octagon. */
export function LevelIcon({ level, size = 16 }: { level: Level; size?: number }) {
  return (
    <svg className={`lvl lvl-${level}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {level === 'ok' && (
        <>
          <circle cx="10" cy="10" r="9" className="lvl-fill" />
          <path d="M6 10.4l2.6 2.6L14.2 7.4" className="lvl-mark" />
        </>
      )}
      {level === 'watch' && (
        <>
          <path d="M10 1.8L18.6 17H1.4z" className="lvl-fill" strokeLinejoin="round" />
          <path d="M10 7.2v4.6M10 14.3v.1" className="lvl-mark" />
        </>
      )}
      {level === 'alert' && (
        <>
          <path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" className="lvl-fill" />
          <path d="M10 5.6v5.6M10 14.2v.1" className="lvl-mark" />
        </>
      )}
    </svg>
  )
}

function VitalTile({ v }: { v: Vital }) {
  const [hover, setHover] = useState<string | null>(null)
  const fmt = (x: number) => (v.key === 'reaction' ? `${Math.round(x)} ms` : v.key === 'sleepHours' ? `${x.toFixed(1)} h` : `${x}/10`)
  const usualNum = v.usual === null ? null : Number(v.usual)
  return (
    <article className={`tile tile-${v.level}`}>
      <header className="tile-head">
        <h3>{v.label}</h3>
        {v.level !== 'ok' && (
          <span className={`pill pill-${v.level}`}>
            <LevelIcon level={v.level} size={12} />
            {LEVEL_WORD[v.level]}
          </span>
        )}
      </header>
      <p className="tile-value">
        {v.value}
        {v.value !== '–' && <span className="tile-unit">{v.unit === '/10' ? ' / 10' : ` ${v.unit}`}</span>}
      </p>
      <p className="tile-sub">{hover ?? (v.usual === null ? 'Learning your normal' : `Usual ${v.usual}${v.unit === '/10' ? '' : ` ${v.unit}`}`)}</p>
      <Sparkline series={v.series} usual={usualNum} level={v.level} format={fmt} onHover={setHover} />
    </article>
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
  if (id.startsWith('ind-') || id === 'safety') return 'head'
  return null
}

export function Dashboard() {
  const s = useStore()
  // RequireUser renders this page only for a logged-in person.
  const user = s.user as User
  const crewId = user.crewId
  const [focus, setFocus] = useState<ZoneKey | null>(null)
  const name = s.nameOf(crewId)
  const today = s.today
  const me = s.todayResult.people[crewId]
  const cabin = s.todayResult.cabin
  const cabinDay = s.data.cabin.daily.find((d) => d.day === today) ?? null

  const zones = useMemo(() => zoneStates(me, cabin), [me, cabin])
  const list = useMemo(() => notices(me, cabin, s.commDelayMin), [me, cabin, s.commDelayMin])
  const history = useMemo(() => s.checkIns.filter((c) => c.crewId === crewId), [s.checkIns, crewId])
  const tiles = useMemo(() => vitals(me, history, today, TREND_DAYS), [me, history, today])
  const hours = useMemo(() => s.data.cabin.hourly.filter((h) => h.day === today), [s.data, today])
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

  // ?day=223 opens the dashboard on that mission day (handy for the demo and for links).
  const setToday = s.setToday
  const [lo, hi] = s.dayRange
  useEffect(() => {
    const d = Number(new URLSearchParams(window.location.search).get('day'))
    if (Number.isInteger(d) && d >= lo && d <= hi) setToday(d)
  }, [setToday, lo, hi])

  useEffect(() => {
    document.title = `${name} · Shipshape`
    document.body.classList.add('dash-body')
    return () => document.body.classList.remove('dash-body')
  }, [name])


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
            <p className="bar-meta">Mars transit · Personal dashboard</p>
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
          <span className="acct-who">
            Logged in as {name}
            {user.role === 'medical' ? ' · medical officer' : ''}
          </span>
          <span className="acct-links">
            {mayOpen(user, 'app') && <a href={hrefOf('app', import.meta.env.BASE_URL)}>Crew app</a>}
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
                <dd>{s.commDelayMin} min</dd>
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
              Vitals <span className="panel-note">vs. your own normal · {TREND_DAYS} days</span>
            </h2>
            <div className="tiles">
              {tiles.map((v) => (
                <VitalTile key={v.key} v={v} />
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

          <div className={`panel cabin cabin-${co2Level}`}>
            <h2 className="panel-title">
              Cabin air
              {co2Level !== 'ok' && (
                <span className={`pill pill-${co2Level}`}>
                  <LevelIcon level={co2Level} size={12} />
                  {LEVEL_WORD[co2Level]}
                </span>
              )}
            </h2>
            <div className="cabin-stats">
              <div className="cabin-main">
                <span className="cabin-label">CO₂ · 24 h average</span>
                <p className="cabin-value">
                  {cabin.co2Mean?.toFixed(1) ?? '–'}
                  <span className="tile-unit"> mmHg</span>
                </p>
              </div>
              <div>
                <span className="cabin-label">Peak hour</span>
                <p className="cabin-small">{cabin.co2Max1h?.toFixed(1) ?? '–'}</p>
              </div>
              <div>
                <span className="cabin-label">Temp</span>
                <p className="cabin-small">{cabinDay?.temp != null ? `${cabinDay.temp.toFixed(1)}°` : '–'}</p>
              </div>
              <div>
                <span className="cabin-label">Humidity</span>
                <p className="cabin-small">{cabinDay?.rh != null ? `${Math.round(cabinDay.rh)}%` : '–'}</p>
              </div>
            </div>
            <Co2Chart hours={hours} limit={RULES.co2LimitMmHg} usual={cabin.baseline} />
          </div>
        </section>
      </main>

      <footer className="dash-foot">
        <p>
          <span className="tag">Simulated crew</span> No real person's data. <span className="tag tag-real">Real ISS CO₂</span> NASA OSDR, {s.data.cabin.meta.mission}, replayed on the mission calendar. Shipshape says
          "likely" and never diagnoses.
        </p>
        <p className="dash-credit">
          Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0). Modified by open-anatomy-3d (https://github.com/MervinR07/open-anatomy-3d), CC BY 4.0. Skeleton extracted and
          re-exported. For visualisation only.
        </p>
      </footer>
    </div>
  )
}

function heroText(overall: Level, attribution: string, tier: number, episodeDay: number, checkedIn: boolean, co2: Level): { title: string; body: string } {
  if (!checkedIn) return { title: 'Good morning', body: 'No check-in yet today. Your trends run up to your last one.' }
  if (tier === 4) return { title: 'Help is on the way', body: 'Your crew medical officer was told privately. The game is paused for you today.' }
  if (tier === 3) return { title: `Still off your usual, day ${episodeDay}`, body: 'A short summary went to the flight surgeon. It lists what changed, never a diagnosis.' }
  if (attribution === 'ship') return { title: 'Likely the ship, not you', body: 'Most of the crew show the same change while cabin CO₂ is above its usual level.' }
  if (attribution === 'me' || attribution === 'shared') return { title: 'Something is off your usual', body: 'Only you see this. Take it easy today and check in again tomorrow.' }
  if (co2 !== 'ok') return { title: 'You are within your normal', body: 'Your body is steady. The cabin air is flagged on the right.' }
  if (overall === 'ok') return { title: 'All within your normal', body: 'Everything you logged today sits inside your own usual range.' }
  return { title: 'Worth a look', body: 'Something is flagged below.' }
}
