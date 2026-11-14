import { useState, type PointerEvent } from 'react'
import type { Level } from './model.ts'

// Two small single-series charts: a trend line for a vital tile and the 24 h cabin CO2 line.
// One series each, so the tile title names it and no legend is needed. Hover shows the value.

const W = 220
const H = 56

function nearest(e: PointerEvent<SVGSVGElement>, n: number, pad: number, width: number): number {
  const box = e.currentTarget.getBoundingClientRect()
  const x = ((e.clientX - box.left) / box.width) * width
  return Math.max(0, Math.min(n - 1, Math.round(((x - pad) / (width - pad * 2)) * (n - 1))))
}

export function Sparkline({
  series,
  usual,
  level,
  format,
  onHover,
}: {
  series: { day: number; v: number | null }[]
  usual: number | null
  level: Level
  format: (v: number) => string
  onHover: (text: string | null) => void
}) {
  const [hi, setHi] = useState<number | null>(null)
  const vals = series.flatMap((s) => (s.v === null ? [] : [s.v]))
  if (vals.length < 2) return <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />
  const all = usual === null ? vals : [...vals, usual]
  let lo = Math.min(...all)
  let hiV = Math.max(...all)
  if (hiV - lo < 1e-6) {
    lo -= 1
    hiV += 1
  }
  const pad = 4
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2)
  const y = (v: number) => H - 6 - ((v - lo) / (hiV - lo)) * (H - 14)

  // Break the line where a check-in is missing instead of drawing through the gap.
  let d = ''
  let pen = false
  series.forEach((s, i) => {
    if (s.v === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`
    pen = true
  })
  const last = series.length - 1
  const lastV = series[last].v
  const hv = hi === null ? null : series[hi]

  return (
    <svg
      className={`spark spark-${level}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Last ${series.length} days`}
      onPointerMove={(e) => {
        const i = nearest(e, series.length, pad, W)
        setHi(i)
        const s = series[i]
        onHover(`Day ${s.day} · ${s.v === null ? 'no check-in' : format(s.v)}`)
      }}
      onPointerLeave={() => {
        setHi(null)
        onHover(null)
      }}
    >
      {usual !== null && <line className="spark-usual" x1={pad} x2={W - pad} y1={y(usual)} y2={y(usual)} />}
      <path className="spark-line" d={d} vectorEffect="non-scaling-stroke" />
      {hv && <line className="spark-cross" x1={x(hi!)} x2={x(hi!)} y1={2} y2={H - 2} vectorEffect="non-scaling-stroke" />}
      {hv?.v != null && <circle className="spark-hover" cx={x(hi!)} cy={y(hv.v)} r={3.5} />}
      {lastV !== null && hi === null && <circle className="spark-now" cx={x(last)} cy={y(lastV)} r={3.5} />}
    </svg>
  )
}

const CW = 340
const CH = 120

export function Co2Chart({
  hours,
  limit,
  usual,
}: {
  hours: { t: string; co2: number }[]
  limit: number
  usual: number | null
}) {
  const [hi, setHi] = useState<number | null>(null)
  if (hours.length < 2) return <p className="dash-muted">No hourly readings for this day.</p>
  const max = Math.max(limit + 1, ...hours.map((h) => h.co2)) * 1.08
  const padL = 4
  const padR = 4
  const top = 10
  const bottom = 18
  const x = (i: number) => padL + (i / (hours.length - 1)) * (CW - padL - padR)
  const y = (v: number) => top + (1 - v / max) * (CH - top - bottom)
  const line = hours.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.co2).toFixed(1)}`).join('')
  const area = `${line}L${x(hours.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
  const time = (t: string) => `${t.slice(11, 16)} UTC`
  const h = hi === null ? null : hours[hi]

  return (
    <div className="co2">
      <div className="co2-readout" aria-live="polite">
        {h ? (
          <>
            <strong>{h.co2.toFixed(2)} mmHg</strong> <span>{time(h.t)}</span>
          </>
        ) : (
          <span>Hourly average · 24 h before check-in</span>
        )}
      </div>
      <svg
        className="co2-svg"
        viewBox={`0 0 ${CW} ${CH}`}
        role="img"
        aria-label={`Cabin CO2 over 24 hours, peak ${Math.max(...hours.map((x) => x.co2)).toFixed(1)} mmHg, limit ${limit} mmHg`}
        onPointerMove={(e) => setHi(nearest(e, hours.length, padL, CW))}
        onPointerLeave={() => setHi(null)}
      >
        <defs>
          <linearGradient id="co2-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="co2-base" x1={padL} x2={CW - padR} y1={y(0)} y2={y(0)} />
        <path className="co2-area" d={area} />
        <path className="co2-line" d={line} />
        <line className="co2-limit" x1={padL} x2={CW - padR} y1={y(limit)} y2={y(limit)} />
        <text className="co2-tag co2-tag-limit" x={CW - padR} y={y(limit) - 5} textAnchor="end">
          Limit {limit}
        </text>
        {usual !== null && (
          <>
            <line className="co2-usual" x1={padL} x2={CW - padR} y1={y(usual)} y2={y(usual)} />
            <text className="co2-tag" x={padL + 2} y={y(usual) + (usual > limit - 0.4 ? 12 : -5)}>
              Usual {usual.toFixed(1)}
            </text>
          </>
        )}
        {h && (
          <>
            <line className="co2-cross" x1={x(hi!)} x2={x(hi!)} y1={top} y2={y(0)} />
            <circle className="co2-dot" cx={x(hi!)} cy={y(h.co2)} r={4} />
          </>
        )}
        <text className="co2-axis" x={padL} y={CH - 4}>
          {time(hours[0].t)}
        </text>
        <text className="co2-axis" x={CW - padR} y={CH - 4} textAnchor="end">
          {time(hours[hours.length - 1].t)}
        </text>
      </svg>
    </div>
  )
}
