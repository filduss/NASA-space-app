import { useEffect, useMemo, useRef, useState } from 'react'
import { hrefOf } from '../auth/paths.ts'
import type { User } from '../auth/session.ts'
import { vitalLines } from '../data/wearable.ts'
import { exerciseWeek } from '../engine/gravity.ts'
import type { SymptomKey } from '../engine/types.ts'
import { ENTRY_FOR, entryById } from '../guide/entries.ts'
import { GuideLink } from '../guide/Guide.tsx'
import { useStore } from '../state.tsx'
import { symptomLabel } from '../ui/text.ts'
import { DemoDock } from '../ui/DemoDock.tsx'
import { Toolbar } from '../ui/Toolbar.tsx'
import { ChartSheet, type ChartTarget } from './ChartSheet.tsx'
import { Sparkline } from './charts.tsx'
import type { RangeKey } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
import { notices, verdict, vitals, zoneStates, ZONES, type Level, type Notice, type Vital, type VerdictSide, type ZoneKey, type ZoneState } from './model.ts'
import { SkeletonView } from './SkeletonView.tsx'
import './dashboard.css'

// Personal dashboard of the logged-in crew member, and only theirs: nobody opens another
// person's dashboard. The demo's day controls live apart from it, in DemoDock.
const TREND_DAYS = 14

type CheckInState = 'todo' | 'simulated' | 'done'
type DayMark = 'done' | 'missed' | 'pending'

const WEEK = 7

/** When the last check-in was, in words: "today", "yesterday", "3 days ago (day 218)". */
function lastCheckInText(last: number | null, today: number): string {
  if (last === null) return 'No check-in yet'
  const ago = today - last
  if (ago === 0) return 'Last check-in today'
  if (ago === 1) return 'Last check-in yesterday'
  return `Last check-in ${ago} days ago (day ${last})`
}

const MARK_WORD: Record<DayMark, string> = { done: 'checked in', missed: 'no check-in', pending: 'not yet' }

/** The daily check-in, the one thing the dashboard asks of the person: a large card in the left
 *  column, filled blue until today's is sent, then quiet with a done mark. Under it, the last 7
 *  mission days as circles, filled for a check-in, empty for none, with a plain count (no streak:
 *  docs/SPEC.md). */
function CheckInCard({ state, day, last, week }: { state: CheckInState; day: number; last: number | null; week: { day: number; mark: DayMark }[] }) {
  const done = week.filter((w) => w.mark === 'done').length
  const lastText = lastCheckInText(last, day)
  const title = state === 'done' ? 'Checked in today' : 'Check in'
  const sub = state === 'done' ? 'View or change your answers' : lastText
  return (
    <a className={`cta cta-${state}`} data-tour="checkin" href={hrefOf('checkin', import.meta.env.BASE_URL, `?day=${day}`)}>
      <span className="cta-row">
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
          <span className="cta-title">{title}</span>
          <span className="cta-sub">{sub}</span>
        </span>
        <svg className="cta-chev" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
          <path d="M2 2l6 6-6 6" />
        </svg>
      </span>
      <span className="cta-week">
        <span className="cta-days" role="img" aria-label={`Checked in on ${done} of the last ${WEEK} days`}>
          {week.map((w) => (
            <span key={w.day} className={w.mark === 'done' ? 'cta-day cta-day-done' : 'cta-day'} title={`Day ${w.day}: ${MARK_WORD[w.mark]}`} />
          ))}
        </span>
        <span className="cta-count" aria-hidden="true">
          {done} of the last {WEEK} days
        </span>
      </span>
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
      {v.level !== 'ok' && <WhatItMeans id={ENTRY_FOR[v.key]} label={v.label} />}
    </article>
  )
}

/** Opens the Guide entry for something that is off today, in a sheet over the dashboard. */
function WhatItMeans({ id, label, text = 'What this means' }: { id: string; label: string; text?: string }) {
  return (
    <GuideLink id={id} label={label} className="guide-more" toGuide>
      <span className="guide-more-q" aria-hidden="true">
        ?
      </span>
      {text}
    </GuideLink>
  )
}

/** Today's symptoms: the count and names. When something is reported, a tap opens them in a sheet. */
function SymptomsTile({ symptoms, level, onOpen }: { symptoms: SymptomKey[]; level: Level; onOpen: () => void }) {
  const some = symptoms.length > 0
  return (
    <article className={`tile tile-${level}${some ? ' tile-open' : ''}`} onClick={some ? onOpen : undefined}>
      <header className="tile-head">
        <h3>Symptoms</h3>
        {some && <ExpandButton label="Open today's symptoms" onClick={onOpen} />}
      </header>
      <p className="tile-value tile-value-sm">{some ? symptoms.length : 'None'}</p>
      <p className="tile-sub">{some ? symptoms.map(symptomLabel).join(', ') : 'Nothing reported today'}</p>
    </article>
  )
}

/**
 * Today's symptoms in a sheet: each Guide entry with the symptoms it covers and its "What it means"
 * button. A native modal <dialog>, as the chart sheet, so Esc and focus trapping come from the browser.
 */
function SymptomsSheet({ symptoms, level, onClose }: { symptoms: SymptomKey[]; level: Level; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  // Taken at first render, before the dialog moves focus inside itself.
  const opener = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    // Not closed in the cleanup: StrictMode runs this twice, and a close() would fire onClose.
    if (!dlg.open) dlg.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      const back = opener.current
      requestAnimationFrame(() => back?.focus?.())
    }
  }, [])
  // Dizziness and nausea share one Guide entry, so they share one row.
  const groups = [...new Set(symptoms.map((k) => ENTRY_FOR[k]))].map((id) => ({ id, names: symptoms.filter((k) => ENTRY_FOR[k] === id).map(symptomLabel) }))
  return (
    <dialog ref={ref} className="sheet sheet-sm" aria-labelledby="symptoms-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={`sheet-card sheet-${level}`}>
        <span className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            <p className="sheet-eyebrow">Vitals</p>
            <h2 id="symptoms-title" className="sheet-title">
              Symptoms
              {level !== 'ok' && (
                <span className={`pill pill-${level}`}>
                  <LevelIcon level={level} size={12} />
                  {LEVEL_WORD[level]}
                </span>
              )}
            </h2>
            <p className="sheet-now">Reported today</p>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </header>
        <ul className="sym-list">
          {groups.map((g) => (
            <li key={g.id}>
              <p className="sym-name">{g.names.join(', ')}</p>
              <WhatItMeans id={g.id} label={g.names.join(', ')} text={`${entryById(g.id)?.title}: what it means`} />
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}

/** What is off in one body zone, shown once the person taps it and the skeleton zooms in. */
function ZoneDetail({ label, state }: { label: string; state: ZoneState }) {
  return (
    <div className={`zone-detail zone-detail-${state.level}`} role="status">
      <p className="zone-detail-head">
        <LevelIcon level={state.level} size={14} />
        <strong>{label}</strong>
        <span className="zone-detail-word">{LEVEL_WORD[state.level]}</span>
      </p>
      {state.reasons.length > 0 ? (
        <ul className="zone-detail-list">
          {state.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className="zone-detail-ok">Within your normal today</p>
      )}
    </div>
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
  const todaysCheckIn = history.find((c) => c.day === today)
  const vitalsToday = todaysCheckIn?.watch ?? null
  // Today's check-in: still to do, sent by the person, or filled in by the crew simulator.
  const checkInState: CheckInState = !todaysCheckIn ? 'todo' : todaysCheckIn.simulated ? 'simulated' : 'done'
  const checkInDays = useMemo(() => new Set(history.map((c) => c.day)), [history])
  const lastCheckIn = history.reduce<number | null>((m, c) => (c.day <= today && (m === null || c.day > m) ? c.day : m), null)
  const week = Array.from({ length: WEEK }, (_, i) => {
    const d = today - (WEEK - 1) + i
    const mark: DayMark = checkInDays.has(d) ? 'done' : d === today ? 'pending' : 'missed'
    return { day: d, mark }
  })
  const zones = useMemo(() => zoneStates(me, exercise), [me, exercise])
  const list = useMemo(() => notices(me, cabin, s.commDelaySec, exercise), [me, cabin, s.commDelaySec, exercise])
  const tiles = useMemo(() => vitals(me, history, today, TREND_DAYS), [me, history, today])
  const symptoms = me.assessment.symptoms
  const symptomsLevel: Level = symptoms.length ? (zones.head.level === 'alert' ? 'alert' : 'watch') : 'ok'
  const [symptomsOpen, setSymptomsOpen] = useState(false)
  const chartVital = chart ? tiles.find((t) => t.key === chart.key) : undefined
  const focusZone = focus ? ZONES.find((z) => z.key === focus) : undefined
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

      {/* The person on the left and the toolbar on the right, as wide as the grid below. */}
      <header className="bar">
        <div className="bar-who">
          <span className="avatar" aria-hidden="true">
            {name.slice(0, 1)}
          </span>
          <div>
            <h1 className="bar-name">{name}</h1>
            <p className="bar-meta">
              {s.mission.label} · <span className="bar-meta-long">Mission day</span>
              <span className="bar-meta-short">Day</span> {today}
            </p>
          </div>
        </div>
        <Toolbar user={user} pages={['guide', 'app']} day={today} onLogOut={s.logOut} />
      </header>

      <main className="grid">
        <section className="col col-left">
          <div className={`hero hero-${v.tint}`} data-tour="answer">
            <p className="hero-kicker">Ship or me</p>
            <h2 className="hero-title">{v.title}</h2>
            <ul className="hero-chips">
              <HeroChip label="Cabin CO₂ level" side={v.co2} known={v.co2.known} />
            </ul>
          </div>

          <CheckInCard state={checkInState} day={today} last={lastCheckIn} week={week} />

          <div className="panel watchp" data-tour="wearable">
            <h2 className="panel-title watch-title">From your wearable</h2>
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
          </div>

        </section>

        <section className="col col-stage" aria-label="Body status">
          <div className="stage" data-tour="body">
            <SkeletonView zones={zones} focus={focus} onFocus={setFocus} />
            <div className="stage-top">
              <p className="stage-eyebrow">Body status</p>
              {focus && (
                <button type="button" className="chip-btn" onClick={() => setFocus(null)}>
                  Whole body
                </button>
              )}
            </div>
            {focusZone && <ZoneDetail label={focusZone.label} state={zones[focusZone.key]} />}
            <ul className="zones">
              {ZONES.map((z) => {
                const st = zones[z.key]
                return (
                  <li key={z.key}>
                    <button type="button" className={`zone zone-${st.level}${focus === z.key ? ' zone-on' : ''}`} onClick={() => setFocus(focus === z.key ? null : z.key)} aria-pressed={focus === z.key}>
                      <LevelIcon level={st.level} size={14} />
                      <span className="zone-name">{z.label}</span>
                      <span className="zone-why">{LEVEL_WORD[st.level]}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        <section className="col col-right">
          <div className="panel" data-tour="vitals">
            <h2 className="panel-title">
              Vitals
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
              <SymptomsTile symptoms={symptoms} level={symptomsLevel} onOpen={() => setSymptomsOpen(true)} />
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
      {symptomsOpen && symptoms.length > 0 && <SymptomsSheet symptoms={symptoms} level={symptomsLevel} onClose={() => setSymptomsOpen(false)} />}

      <DemoDock page="dashboard" />
    </div>
  )
}
