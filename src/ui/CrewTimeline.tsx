import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { RULES } from '../engine/config.ts'
import { SPEC } from '../engine/deviation.ts'
import { crewTimeline, type TimelineCell, type TimelineMark, type Viewer } from '../engine/privacy.ts'
import { useStore } from '../state.tsx'
import { Mark, type Tone } from './bits.tsx'
import { checkInAt, houstonTime, shipTime } from './clock.ts'
import { boardWords, delayText, mmHg } from './text.ts'

// The crew timeline: cabin CO2, how many crew drift on CO2-linked indicators, and one row per
// person, on one shared day axis. A column that lights up for everyone looks like the ship; a row
// that keeps lighting up looks like the person. What fills it comes from privacy.ts per viewer.

const DAYS = 14
const LABEL_W = 76
const PAD_R = 6
const BAND_Y = 0
const CO2_Y = 20
const CO2_H = 78
const DRIFT_Y = CO2_Y + CO2_H + 16
const DRIFT_H = 46
const ROWS_Y = DRIFT_Y + DRIFT_H + 14
const ROW_H = 30

const TONE: Record<TimelineMark, Tone> = { ok: 'ok', off: 'watch', persist: 'alert', absent: 'idle', shield: 'idle', safety: 'alert', unknown: 'idle' }

const LEGEND: { mark: TimelineMark; word: string }[] = [
  { mark: 'ok', word: 'Within own usual' },
  { mark: 'off', word: 'Off own usual' },
  { mark: 'persist', word: `Day ${RULES.persistDays} or later` },
  { mark: 'absent', word: 'No check-in' },
  { mark: 'shield', word: 'Shielded day' },
  { mark: 'safety', word: 'Safety answer' },
  { mark: 'unknown', word: 'Nothing received' },
]

/** One day's symbol. The shape carries the status; colour only supports it. */
function Sym({ mark, x, y, s }: { mark: TimelineMark; x: number; y: number; s: number }) {
  const cls = `tl-sym tl-sym-${mark}`
  switch (mark) {
    case 'ok':
      return <circle className={cls} cx={x} cy={y} r={s * 0.32} />
    case 'off':
      return <path className={cls} d={`M${x},${y - s}L${x + s * 0.98},${y + s * 0.72}H${x - s * 0.98}Z`} />
    case 'persist':
      return <path className={cls} d={`M${x},${y - s}L${x + s},${y}L${x},${y + s}L${x - s},${y}Z`} />
    case 'absent':
      return <circle className={cls} cx={x} cy={y} r={s * 0.55} />
    case 'shield':
      return (
        <path
          className={cls}
          d={`M${x},${y - s * 0.85}L${x + s * 0.72},${y - s * 0.55}V${y}C${x + s * 0.72},${y + s * 0.5} ${x + s * 0.35},${y + s * 0.75} ${x},${y + s * 0.9}C${x - s * 0.35},${y + s * 0.75} ${x - s * 0.72},${y + s * 0.5} ${x - s * 0.72},${y}V${y - s * 0.55}Z`}
        />
      )
    case 'safety':
      return <rect className={cls} x={x - s * 0.72} y={y - s * 0.72} width={s * 1.44} height={s * 1.44} rx={1.5} />
    default:
      return <line className={cls} x1={x - s * 0.45} x2={x + s * 0.45} y1={y} y2={y} />
  }
}

function LegendSym({ mark }: { mark: TimelineMark }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <Sym mark={mark} x={7} y={7} s={6} />
    </svg>
  )
}

function cellWords(c: TimelineCell, shieldLabel: string | null): string {
  switch (c.mark) {
    case 'ok':
      return 'Within own usual on what is shared'
    case 'absent':
      return 'No check-in'
    case 'shield':
      return `${shieldLabel ?? 'Shielded'} day, no check-in needed`
    case 'safety':
      return 'Safety answer: medical officer and flight surgeon told at once'
    case 'unknown':
      return 'Nothing about this day reached Earth'
  }
  const words: string[] = []
  if (c.co2Linked) words.push('CO₂-linked changes, named in a ship summary')
  words.push(...boardWords(c.keys, c.symptoms).map((w) => w.word))
  for (const k of c.keys) if (SPEC[k].privacy === 'private') words.push(`${SPEC[k].label} (in the summary)`)
  const text = words.join(', ') || 'Off own usual'
  return c.mark === 'persist' ? `${text} · day ${RULES.persistDays} or later` : text
}

export function CrewTimeline({ viewer }: { viewer: Viewer }) {
  const s = useStore()
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const viewerKey = viewer.kind === 'crew' ? viewer.crewId : viewer.kind
  const earth = viewer.kind === 'surgeon'

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)))
    ro.observe(el)
    setWidth(Math.max(280, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const shieldDays = s.data.crew.shieldDays
  const t = useMemo(
    () =>
      crewTimeline(viewer, {
        window: s.results.slice(-DAYS),
        crewIds: s.data.crew.crew.map((c) => c.id),
        shielded: (id, day) => shieldDays.some((x) => x.day === day && x.crewIds.includes(id)),
        summaries: s.summaries,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewerKey, s.results, s.summaries, s.data, shieldDays],
  )

  const cols = t.days.length
  const [sel, setSel] = useState(cols - 1)
  const at = Math.min(sel, cols - 1)
  const day = t.days[at]

  const cw = (width - LABEL_W - PAD_R) / cols
  const cx = (i: number) => LABEL_W + cw * (i + 0.5)
  const rowsH = Math.max(1, t.rows.length) * ROW_H
  const axisY = ROWS_Y + rowsH + 4
  const height = axisY + 18
  const sym = Math.max(4.5, Math.min(cw * 0.34, 8))

  // Cabin CO2: one series against the cabin's usual and the 3 mmHg limit.
  const usual = t.days.at(-1)?.baseline ?? null
  const values = t.days.flatMap((d) => (d.co2Mean === null ? [] : [d.co2Mean]))
  const lo = Math.max(0, Math.min(...values, usual ?? Infinity, RULES.co2LimitMmHg) - 0.3)
  const hi = Math.max(...values, usual ?? 0, RULES.co2LimitMmHg) + 0.3
  const sy = (v: number) => CO2_Y + CO2_H - ((v - lo) / (hi - lo || 1)) * CO2_H
  let path = ''
  t.days.forEach((d, i) => {
    if (d.co2Mean === null) return
    const prev = t.days[i - 1]
    path += `${prev && prev.co2Mean !== null ? 'L' : 'M'}${cx(i)},${sy(d.co2Mean)}`
  })

  // Crew drifting: bars out of the crew size, with the rule's threshold.
  const sd = (n: number) => DRIFT_Y + DRIFT_H - (n / t.crewSize) * DRIFT_H
  const barW = Math.min(cw * 0.55, 16)
  const noCounts = t.days.every((d) => d.drifting === null)

  // Ship-alert runs, drawn as one band behind every panel.
  const runs: [number, number][] = []
  t.days.forEach((d, i) => {
    if (!d.ship) return
    const last = runs.at(-1)
    if (last && last[1] === i - 1) last[1] = i
    else runs.push([i, i])
  })

  const every = cw < 22 ? 3 : cw < 34 ? 2 : 1
  const name = (id: string) => s.nameOf(id)
  const shieldLabel = (id: string, d: number) => shieldDays.find((x) => x.day === d && x.crewIds.includes(id))?.label ?? null

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSel(Math.max(0, at - 1))
    else if (e.key === 'ArrowRight') setSel(Math.min(cols - 1, at + 1))
    else return
    e.preventDefault()
  }

  const arrival = checkInAt(s.today, s.data.cabin.meta.replay, s.commDelaySec)
  const onboard = checkInAt(s.today, s.data.cabin.meta.replay)

  return (
    <div className="tl">
      <p className="tl-clock">
        {earth ? (
          <>
            Only what reached Mission Control: the cabin telemetry, and a crew row once a summary names someone. Today's check-in, sent{' '}
            {shipTime(onboard)} ship time, arrived {delayText(s.commDelaySec)} later at <strong>{houstonTime(arrival)}</strong> ({shipTime(arrival)}).
          </>
        ) : (
          <>
            Each column is one morning check-in at <strong>{shipTime(onboard)}</strong> ship time. Tap a day to read it.
          </>
        )}
      </p>

      <div ref={wrap} className="tl-chart">
        <svg
          className="tl-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          tabIndex={0}
          role="group"
          aria-label={`Crew timeline, mission days ${t.days[0]?.day} to ${t.days.at(-1)?.day}. Selected: day ${day?.day}. Use the left and right arrow keys to change the day.`}
          onKeyDown={onKey}
        >
          {runs.map(([a, b]) => (
            <g key={a}>
              <rect className="tl-band" x={LABEL_W + cw * a} y={BAND_Y} width={cw * (b - a + 1)} height={axisY - BAND_Y} />
              <text className="tl-band-label" x={LABEL_W + cw * a + 4} y={BAND_Y + 12}>
                {cw * (b - a + 1) > 64 ? 'Ship alert' : 'Ship'}
              </text>
            </g>
          ))}
          <rect className="tl-sel" x={LABEL_W + cw * at} y={BAND_Y} width={cw} height={axisY - BAND_Y} />

          {/* Cabin CO2 */}
          <text className="tl-label" x={0} y={CO2_Y + 12}>
            Cabin CO₂
          </text>
          <text className="tl-sub" x={0} y={CO2_Y + 26}>
            mmHg · real
          </text>
          <line className="tl-ref-limit" x1={LABEL_W} x2={width - PAD_R} y1={sy(RULES.co2LimitMmHg)} y2={sy(RULES.co2LimitMmHg)} />
          <text className="tl-ref-label" x={LABEL_W + 4} y={sy(RULES.co2LimitMmHg) - 4}>
            limit {RULES.co2LimitMmHg}
          </text>
          {usual !== null && (
            <>
              <line className="tl-ref-usual" x1={LABEL_W} x2={width - PAD_R} y1={sy(usual)} y2={sy(usual)} />
              <text className="tl-ref-label" x={LABEL_W + 4} y={sy(usual) + 12}>
                usual {usual.toFixed(1)}
              </text>
            </>
          )}
          <path className="tl-line" d={path} />
          {t.days.map((d, i) =>
            d.co2Mean === null ? null : <circle key={d.day} className={i === at ? 'tl-dot tl-dot-on' : 'tl-dot'} cx={cx(i)} cy={sy(d.co2Mean)} r={i === at ? 4.5 : 2.5} />,
          )}

          {/* Crew drifting on CO2-linked indicators */}
          <line className="tl-sep" x1={0} x2={width - PAD_R} y1={DRIFT_Y - 8} y2={DRIFT_Y - 8} />
          <text className="tl-label" x={0} y={DRIFT_Y + 12}>
            Drifting
          </text>
          <text className="tl-sub" x={0} y={DRIFT_Y + 26}>
            crew, CO₂-linked
          </text>
          <line className="tl-ref-need" x1={LABEL_W} x2={width - PAD_R} y1={sd(t.needed)} y2={sd(t.needed)} />
          <line className="tl-base" x1={LABEL_W} x2={width - PAD_R} y1={DRIFT_Y + DRIFT_H} y2={DRIFT_Y + DRIFT_H} />
          {t.days.map((d, i) =>
            d.drifting === null ? null : (
              <g key={d.day}>
                {d.drifting > 0 && (
                  <rect className={d.drifting >= t.needed ? 'tl-bar tl-bar-over' : 'tl-bar'} x={cx(i) - barW / 2} y={sd(d.drifting)} width={barW} height={DRIFT_Y + DRIFT_H - sd(d.drifting)} rx={2} />
                )}
                <text className="tl-count" x={cx(i)} y={sd(d.drifting) - 3}>
                  {d.drifting}
                </text>
              </g>
            ),
          )}
          <text className="tl-ref-label" x={width - PAD_R - 2} y={sd(t.needed) - 4} textAnchor="end">
            rule needs {t.needed}
          </text>
          {noCounts && (
            <text className="tl-empty" x={LABEL_W + 4} y={DRIFT_Y + DRIFT_H - 8}>
              Counts arrive only in ship summaries
            </text>
          )}

          {/* One row per person this viewer may see */}
          <line className="tl-sep" x1={0} x2={width - PAD_R} y1={ROWS_Y - 6} y2={ROWS_Y - 6} />
          {t.rows.length === 0 && (
            <text className="tl-empty" x={LABEL_W + 4} y={ROWS_Y + ROW_H / 2 + 4}>
              No crew member named in a summary yet
            </text>
          )}
          {t.rows.map((row, r) => {
            const y = ROWS_Y + r * ROW_H + ROW_H / 2
            return (
              <g key={row.crewId}>
                <text className="tl-name" x={0} y={y + 4}>
                  {name(row.crewId)}
                </text>
                {r > 0 && <line className="tl-row-sep" x1={LABEL_W} x2={width - PAD_R} y1={y - ROW_H / 2} y2={y - ROW_H / 2} />}
                {row.cells.map((c, i) => (
                  <Sym key={c.day} mark={c.mark} x={cx(i)} y={y} s={sym} />
                ))}
              </g>
            )
          })}

          {t.days.map((d, i) =>
            (cols - 1 - i) % every === 0 || i === at ? (
              <text key={d.day} className={i === at ? 'tl-tick tl-tick-on' : 'tl-tick'} x={cx(i)} y={axisY + 13}>
                {d.day}
              </text>
            ) : null,
          )}
          {t.days.map((d, i) => (
            <rect key={d.day} className="tl-hit" x={LABEL_W + cw * i} y={BAND_Y} width={cw} height={height} onClick={() => setSel(i)}>
              <title>Mission day {d.day}</title>
            </rect>
          ))}
        </svg>
      </div>

      <ul className="tl-legend" aria-label="Symbols">
        {LEGEND.filter((l) => earth || (l.mark !== 'safety' && l.mark !== 'unknown')).map((l) => (
          <li key={l.mark}>
            <LegendSym mark={l.mark} />
            {l.word}
          </li>
        ))}
        <li>
          <span className="tl-legend-bar" aria-hidden="true" />
          At or over the rule
        </li>
      </ul>

      {day && (
        <div className="tl-detail" aria-live="polite">
          <p className="tl-detail-head">
            <strong>Mission day {day.day}</strong>
            {day.day === s.today && <span className="tl-today">today</span>}
            {day.ship && <Mark tone="watch">Ship alert</Mark>}
          </p>
          <p className="tl-detail-air">
            Cabin CO₂ {mmHg(day.co2Mean)} (usual {mmHg(day.baseline)}).{' '}
            {day.drifting === null
              ? 'No crew count reached Earth for this day.'
              : `${day.drifting} of ${t.crewSize} crew drifting on CO₂-linked indicators; a ship alert needs ${t.needed}.`}
          </p>
          {t.rows.length > 0 && (
            <ul className="tl-people">
              {t.rows.map((row) => {
                const c = row.cells[at]
                return (
                  <li key={row.crewId}>
                    <span className="tl-person">{name(row.crewId)}</span>
                    <Mark tone={TONE[c.mark]}>{cellWords(c, shieldLabel(row.crewId, c.day))}</Mark>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
