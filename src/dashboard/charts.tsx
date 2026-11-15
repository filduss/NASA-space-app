import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { niceTicks, type Flag, type Point, type Series } from './history.ts'
import { LEVEL_WORD, LevelIcon } from './LevelIcon.tsx'
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

// ---------- expanded trend chart (the chart sheet) ----------
// Still one series on one axis. Reference lines (usual, limit) are labelled on the line itself,
// flagged days are shaded and marked below the axis with the level's shape, and the readout
// names the status in words, so nothing depends on colour alone.

export interface XTick {
  x: number
  label: string
}

const SHAPE: Record<Exclude<Level, 'ok'>, (cx: number, cy: number, r: number) => string> = {
  watch: (cx, cy, r) => `M${cx},${cy - r}L${cx + r * 0.95},${cy + r * 0.75}L${cx - r * 0.95},${cy + r * 0.75}Z`,
  alert: (cx, cy, r) => {
    const k = r * 0.414
    return `M${cx - k},${cy - r}L${cx + k},${cy - r}L${cx + r},${cy - k}L${cx + r},${cy + k}L${cx + k},${cy + r}L${cx - k},${cy + r}L${cx - r},${cy + k}L${cx - r},${cy - k}Z`
  },
}

const FLAG_WORD: Record<Exclude<Level, 'ok'>, string> = { watch: 'Watch day', alert: 'Alert day' }

/** Merge consecutive flagged days of the same level so the marker row stays readable at 390 px. */
function runs(flags: Flag[]): Flag[] {
  const out: Flag[] = []
  for (const f of [...flags].sort((a, b) => a.day - b.day)) {
    const last = out[out.length - 1]
    if (last && last.level === f.level && f.day === last.day + 1) out[out.length - 1] = { ...last, day: f.day, x1: f.x1 }
    else out.push(f)
  }
  return out
}

function useWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function TrendChart({
  series,
  domain,
  yDomain,
  area = false,
  usual,
  usualText,
  limit = null,
  format,
  tick,
  xTicks,
  gap,
  dots,
  idle,
  ariaLabel,
}: {
  series: Series
  /** x range shown, in the same units as Point.x. */
  domain: [number, number]
  /** Fixed y range (e.g. 0–10 scales); otherwise fitted to the data. */
  yDomain?: [number, number]
  /** Fill under the line; only honest when the y axis starts at zero. */
  area?: boolean
  usual: number | null
  /** Label on the usual line; defaults to the formatted value. */
  usualText?: string
  limit?: number | null
  format: (v: number) => string
  tick: (v: number) => string
  xTicks: (count: number) => XTick[]
  /** Break the line where neighbouring points are further apart than this. */
  gap: number
  /** Draw a dot on every value (daily data); hourly data is too dense for it. */
  dots: boolean
  idle: ReactNode
  ariaLabel: string
}) {
  const [box, width] = useWidth<HTMLDivElement>()
  const [hi, setHi] = useState<number | null>(null)
  const gid = `trend-fill-${useId().replace(/[^\w-]/g, '')}`
  const { points, flags } = series
  const vals = points.flatMap((p) => (p.v === null ? [] : [p.v]))

  if (vals.length === 0) {
    return (
      <div className="bigchart" ref={box}>
        <p className="bigchart-empty">Nothing recorded in this range.</p>
      </div>
    )
  }

  const W = Math.max(width, 280)
  const H = W < 480 ? 220 : 260
  const narrow = W < 480

  let [lo, top] = yDomain ?? [Math.min(...vals), Math.max(...vals)]
  if (!yDomain) {
    for (const r of [usual, limit]) {
      if (r === null) continue
      lo = Math.min(lo, r)
      top = Math.max(top, r)
    }
    if (area) lo = 0
    const span = Math.max(top - lo, 1e-6)
    if (!area) lo -= span * 0.12
    top += span * 0.12
  }
  const yTicks = niceTicks(lo, top, narrow ? 3 : 4)

  const padL = 34
  const padR = 10
  const padT = 14
  const plotB = H - 42
  const stripY = plotB + 12
  const [x0, x1] = domain
  const xs = (x: number) => padL + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - padL - padR)
  const ys = (v: number) => padT + (1 - (v - lo) / (top - lo)) * (plotB - padT)

  let d = ''
  let prev: Point | null = null
  for (const p of points) {
    if (p.v === null) {
      prev = null
      continue
    }
    d += `${prev && p.x - prev.x <= gap ? 'L' : 'M'}${xs(p.x).toFixed(1)},${ys(p.v).toFixed(1)}`
    prev = p
  }
  // A lone value between gaps has no segment to draw: give it a dot so it is not lost.
  const lone = points.filter((p, i) => {
    if (p.v === null) return false
    const a = points[i - 1]
    const b = points[i + 1]
    return !(a && a.v !== null && p.x - a.x <= gap) && !(b && b.v !== null && b.x - p.x <= gap)
  })

  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    const x = x0 + (((clientX - r.left) / r.width) * W - padL) / (W - padL - padR) * (x1 - x0)
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i
    return best
  }
  const h = hi === null ? null : points[hi]
  const hFlag = h ? flags.find((f) => f.day === h.day) : undefined

  return (
    <div className="bigchart" ref={box}>
      <div className="bigchart-readout" aria-live="polite">
        {h ? (
          <>
            <strong>{h.v === null ? 'No check-in' : format(h.v)}</strong> <span>{h.when}</span>
            {hFlag && (
              <span className={`pill pill-${hFlag.level}`}>
                <LevelIcon level={hFlag.level} size={11} />
                {LEVEL_WORD[hFlag.level]}
              </span>
            )}
          </>
        ) : (
          <span>{idle}</span>
        )}
      </div>
      {width > 0 && points.length > 0 && (
        <svg
          className="bigchart-svg"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={(e) => setHi(pick(e.clientX, e.currentTarget))}
          onPointerDown={(e) => setHi(pick(e.clientX, e.currentTarget))}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setHi(null)}
          onBlur={() => setHi(null)}
          onKeyDown={(e) => {
            const n = points.length
            const cur = hi ?? n - 1
            const step = e.shiftKey ? Math.max(1, Math.round(n / 10)) : 1
            const next =
              e.key === 'ArrowLeft' ? Math.max(0, cur - (hi === null ? 0 : step))
              : e.key === 'ArrowRight' ? Math.min(n - 1, cur + (hi === null ? 0 : step))
              : e.key === 'Home' ? 0
              : e.key === 'End' ? n - 1
              : null
            if (next === null) return
            e.preventDefault()
            setHi(next)
          }}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {flags.map((f) => {
            const a = Math.max(xs(f.x0), padL)
            const b = Math.min(xs(f.x1), W - padR)
            return b > a ? <rect key={f.day} className={`bigchart-band bigchart-band-${f.level}`} x={a} y={padT} width={b - a} height={plotB - padT} /> : null
          })}
          {yTicks.map((t) => (
            <g key={t}>
              <line className="bigchart-grid" x1={padL} x2={W - padR} y1={ys(t)} y2={ys(t)} />
              <text className="bigchart-axis" x={padL - 6} y={ys(t) + 3.5} textAnchor="end">
                {tick(t)}
              </text>
            </g>
          ))}
          {xTicks(narrow ? 3 : 5).map((t) => (
            <text key={t.x} className="bigchart-axis" x={Math.min(Math.max(xs(t.x), padL + 14), W - padR - 14)} y={H - 4} textAnchor="middle">
              {t.label}
            </text>
          ))}
          {area && d && <path className="bigchart-area" fill={`url(#${gid})`} d={areaPath(points, gap, xs, ys, lo)} />}
          <path className="bigchart-line" d={d} />
          {dots && points.map((p) => (p.v === null ? null : <circle key={p.x} className="bigchart-dot" cx={xs(p.x)} cy={ys(p.v)} r={2.4} />))}
          {!dots && lone.map((p) => <circle key={p.x} className="bigchart-dot" cx={xs(p.x)} cy={ys(p.v!)} r={2.4} />)}
          {limit !== null && (
            <>
              <line className="bigchart-limit" x1={padL} x2={W - padR} y1={ys(limit)} y2={ys(limit)} />
              <text className="bigchart-tag bigchart-tag-limit" x={W - padR} y={ys(limit) - 5} textAnchor="end">
                Limit {tick(limit)}
              </text>
            </>
          )}
          {usual !== null && (
            <>
              <line className="bigchart-usual" x1={padL} x2={W - padR} y1={ys(usual)} y2={ys(usual)} />
              <text className="bigchart-tag" x={padL + 4} y={ys(usual) + (limit !== null && Math.abs(ys(usual) - ys(limit)) < 16 ? 13 : -5)}>
                Usual {usualText ?? format(usual)}
              </text>
            </>
          )}
          {runs(flags).map((f) => {
            const cx = (Math.max(xs(f.x0), padL) + Math.min(xs(f.x1), W - padR)) / 2
            return <path key={f.day} className={`bigchart-mark bigchart-mark-${f.level}`} d={SHAPE[f.level](cx, stripY, 5)} />
          })}
          {h && (
            <>
              <line className="bigchart-cross" x1={xs(h.x)} x2={xs(h.x)} y1={padT} y2={plotB} />
              {h.v !== null && <circle className="bigchart-hover" cx={xs(h.x)} cy={ys(h.v)} r={4.5} />}
            </>
          )}
        </svg>
      )}
      {flags.length > 0 && (
        <ul className="bigchart-legend" aria-label="Flagged days">
          {(['watch', 'alert'] as const)
            .filter((l) => flags.some((f) => f.level === l))
            .map((l) => (
              <li key={l}>
                <LevelIcon level={l} size={11} /> {FLAG_WORD[l]}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

function areaPath(points: Point[], gap: number, xs: (x: number) => number, ys: (v: number) => number, lo: number): string {
  // One closed shape per unbroken run of values.
  let out = ''
  let run: Point[] = []
  const close = () => {
    if (run.length > 1) {
      out += run.map((p, i) => `${i ? 'L' : 'M'}${xs(p.x).toFixed(1)},${ys(p.v!).toFixed(1)}`).join('')
      out += `L${xs(run[run.length - 1].x).toFixed(1)},${ys(lo)}L${xs(run[0].x).toFixed(1)},${ys(lo)}Z`
    }
    run = []
  }
  for (const p of points) {
    if (p.v === null || (run.length && p.x - run[run.length - 1].x > gap)) close()
    if (p.v !== null) run.push(p)
  }
  close()
  return out
}
