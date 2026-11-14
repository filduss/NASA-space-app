import { useEffect, useMemo, useRef } from 'react'
import { RULES } from '../engine/config.ts'
import { SPEC } from '../engine/deviation.ts'
import type { IndicatorKey } from '../engine/types.ts'
import { useStore } from '../state.tsx'
import { TrendChart, type XTick } from './charts.tsx'
import { co2Series, CO2_RANGES, niceTicks, RANGE_LABEL, RANGE_NAME, rangeStart, stats, VITAL_RANGES, vitalSeries, type RangeKey, type Series } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
import { cabinLevel, type Vital } from './model.ts'

// The expanded view of one dashboard chart: a vital of the logged-in person, or the cabin CO2.
// Opened from a tile or the cabin panel; a native modal <dialog>, so Esc, focus trapping and the
// inert page behind it come from the browser.

export type ChartTarget = { kind: 'vital'; key: IndicatorKey } | { kind: 'co2' }

export function ChartSheet({
  target,
  vital,
  range,
  onRange,
  onClose,
}: {
  target: ChartTarget
  /** The tile's own numbers, so the sheet and the tile always agree. */
  vital?: Vital
  range: RangeKey
  onRange: (r: RangeKey) => void
  onClose: () => void
}) {
  const s = useStore()
  const ref = useRef<HTMLDialogElement>(null)
  // Taken at first render, before the dialog moves focus inside itself.
  const opener = useRef(document.activeElement as HTMLElement | null)
  const crewId = s.user!.crewId
  const today = s.today
  const firstDay = s.data.crew.meta.days[0]
  const from = rangeStart(range, today, firstDay)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    // Not closed in the cleanup: StrictMode runs this twice, and a close() would fire onClose.
    if (!dlg.open) dlg.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      // Back to the tile's button once the dialog has left the page (until then the page is inert).
      const back = opener.current
      requestAnimationFrame(() => back?.focus?.())
    }
  }, [])

  const series: Series = useMemo(
    () => (target.kind === 'co2' ? co2Series(s.data.cabin.hourly, s.results, from, today) : vitalSeries(target.key, crewId, s.checkIns, s.results, from, today)),
    [target, s.data, s.results, s.checkIns, crewId, from, today],
  )
  const st = stats(series.points)
  const ranges = target.kind === 'co2' ? CO2_RANGES : VITAL_RANGES
  const days = today - from + 1

  const body =
    target.kind === 'co2'
      ? co2Body(series, st, from, today, s.todayResult.cabin.baseline, range)
      : vitalBody(target.key, vital!, series, st, from, today, days)
  const level = target.kind === 'co2' ? cabinLevel(s.todayResult.cabin) : vital!.level
  const titleId = 'sheet-title'

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={`sheet-card sheet-${level}`}>
        <span className="sheet-grab" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            <p className="sheet-eyebrow">
              {target.kind === 'co2' ? (
                <>
                  Cabin air <span className="tag tag-real">Real ISS CO₂</span>
                </>
              ) : (
                <>
                  Vitals <span className="tag">Simulated crew</span>
                </>
              )}
            </p>
            <h2 id={titleId} className="sheet-title">
              {body.title}
              {level !== 'ok' && (
                <span className={`pill pill-${level}`}>
                  <LevelIcon level={level} size={12} />
                  {LEVEL_WORD[level]}
                </span>
              )}
            </h2>
            <p className="sheet-now">{body.now}</p>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close chart">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </header>

        <div className="seg sheet-seg" role="group" aria-label="Time range">
          {ranges.map((r) => (
            <button key={r} type="button" className={range === r ? 'seg-on' : ''} aria-pressed={range === r} aria-label={RANGE_NAME[r]} title={RANGE_NAME[r]} onClick={() => onRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>

        <TrendChart
          key={`${target.kind}-${range}`}
          series={series}
          domain={body.domain}
          yDomain={body.yDomain}
          area={target.kind === 'co2'}
          usual={body.usual}
          usualText={body.usualText}
          limit={target.kind === 'co2' ? RULES.co2LimitMmHg : null}
          format={body.format}
          tick={body.tick}
          xTicks={body.xTicks}
          gap={target.kind === 'co2' ? 1.5 : 1}
          dots={target.kind === 'vital' && days <= 31}
          idle={body.idle}
          ariaLabel={body.aria}
        />

        <dl className="sheet-stats">
          {body.stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <p className="sheet-note">{body.note}</p>
      </div>
    </dialog>
  )
}

interface Body {
  title: string
  now: string
  domain: [number, number]
  yDomain?: [number, number]
  usual: number | null
  usualText?: string
  format: (v: number) => string
  tick: (v: number) => string
  xTicks: (n: number) => XTick[]
  idle: string
  aria: string
  stats: [string, string][]
  note: string
}

const dayTicks = (from: number, to: number) => (n: number) =>
  niceTicks(from, to, n)
    .filter((d) => Number.isInteger(d))
    .map((d) => ({ x: d, label: `Day ${d}` }))

function vitalBody(key: IndicatorKey, v: Vital, series: Series, st: ReturnType<typeof stats>, from: number, to: number, days: number): Body {
  const unit = v.unit
  const scale10 = unit === '/10'
  const f = (x: number) => (key === 'reaction' ? `${Math.round(x)}` : key === 'sleepHours' ? x.toFixed(1) : `${Math.round(x * 10) / 10}`)
  const format = (x: number) => (scale10 ? `${f(x)} / 10` : `${f(x)} ${unit}`)
  const usual = v.usual === null ? null : Number(v.usual)
  const worse = v.direction === 'lowBad' ? 'lower' : 'higher'
  return {
    title: v.label,
    now: `${v.value === '–' ? 'No check-in today' : `Today ${scale10 ? `${v.value} / 10` : `${v.value} ${unit}`}`} · ${v.usual === null ? 'learning your normal' : `usual ${scale10 ? v.usual : `${v.usual} ${unit}`}`}`,
    domain: [from, to],
    yDomain: scale10 ? [0, 10] : undefined,
    usual,
    format,
    tick: (x) => (key === 'reaction' ? `${Math.round(x)}` : `${Math.round(x * 10) / 10}`),
    xTicks: dayTicks(from, to),
    idle: `One check-in a day · ${worse} is worse · tap or hover for a day`,
    aria: `${v.label}, days ${from} to ${to}${st.n ? `, average ${format(st.mean!)}, from ${format(st.min!)} to ${format(st.max!)}` : ', no check-ins'}, ${series.flags.length} flagged days`,
    stats: [
      ['Average', st.mean === null ? '–' : format(st.mean)],
      ['Range', st.n ? `${f(st.min!)}–${f(st.max!)}` : '–'],
      ['Check-ins', `${st.n} of ${days} days`],
      ['Flagged days', `${series.flags.length}`],
    ],
    note:
      SPEC[key].privacy === 'private'
        ? 'Only you see this. It is compared with your own normal and never used in the ship rule.'
        : 'Compared with your own normal. Shaded days were off your usual that day. Shipshape says "likely" and never diagnoses.',
  }
}

function co2Body(series: Series, st: ReturnType<typeof stats>, from: number, to: number, baseline: number | null, range: RangeKey): Body {
  const limit = RULES.co2LimitMmHg
  const pts = series.points
  const max = Math.max(limit + 1, ...pts.map((p) => p.v ?? 0)) * 1.08
  const domain: [number, number] = pts.length ? [pts[0].x, pts[pts.length - 1].x] : [0, 1]
  const over = pts.filter((p) => p.v !== null && p.v > limit).length
  const peak = pts.reduce<(typeof pts)[number] | null>((a, p) => (p.v !== null && (a === null || p.v > a.v!) ? p : a), null)
  const xTicks = (n: number): XTick[] => {
    if (range === '1d') {
      const hour = (x: number) => ((Math.round(x) % 24) + 24) % 24
      return pts.filter((p) => hour(p.x) % 6 === 0).map((p) => ({ x: p.x, label: `${String(hour(p.x)).padStart(2, '0')}:00` }))
    }
    return dayTicks(from, to)(n).flatMap((t) => {
      const first = pts.find((p) => p.day === t.x)
      return first ? [{ x: first.x, label: t.label }] : []
    })
  }
  return {
    title: 'Cabin CO₂',
    now: `${range === '1d' ? '24 h before the check-in' : RANGE_NAME[range]} · hourly averages · usual ${baseline?.toFixed(1) ?? '–'} mmHg`,
    domain,
    yDomain: [0, max],
    usual: baseline,
    usualText: baseline === null ? undefined : `${baseline.toFixed(1)} mmHg`,
    format: (x) => `${x.toFixed(2)} mmHg`,
    tick: (x) => `${Math.round(x * 10) / 10}`,
    xTicks,
    idle: `Hourly average · limit ${limit} mmHg for any 1 hour · tap or hover for an hour`,
    aria: `Cabin CO2, days ${from} to ${to}${st.n ? `, average ${st.mean!.toFixed(2)} mmHg, peak ${st.max!.toFixed(2)} mmHg` : ', no readings'}, limit ${limit} mmHg, ${over} hours above it`,
    stats: [
      ['Average', st.mean === null ? '–' : `${st.mean.toFixed(2)} mmHg`],
      ['Peak hour', peak ? `${peak.v!.toFixed(2)} · day ${peak.day}` : '–'],
      ['Hours over limit', `${over} of ${st.n}`],
      ['Flagged days', `${series.flags.length}`],
    ],
    note: 'Real ISS telemetry (NASA OSDR, RR-7), replayed on the mission calendar. Hours with no valid samples are left as gaps, not filled in.',
  }
}
