import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// One small SVG line chart, used for the cabin CO2 trace and the personal trends.
// Single series, one y-axis, recessive grid, direct labels on reference lines, hover crosshair.

export interface Point {
  x: number
  y: number | null
}

export interface RefLine {
  y: number
  label: string
  tone: 'usual' | 'limit'
}

interface Props {
  points: Point[]
  /** The "normal" band, drawn behind the line. */
  band?: { x: number; lo: number; hi: number }[]
  refLines?: RefLine[]
  /** Points to mark with a triangle (days judged off). */
  marks?: { x: number; y: number }[]
  /** x-range to shade, e.g. today's 24 h window. */
  shade?: [number, number]
  xTicks: { x: number; label: string }[]
  yDomain?: [number, number]
  height?: number
  /** Break the line where neighbouring points are further apart than this. */
  maxGap?: number
  yFormat: (y: number) => string
  tooltip: (p: { x: number; y: number }) => { title: string; value: string }
  ariaLabel: string
  children?: ReactNode
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

export function LineChart(p: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [hover, setHover] = useState<number | null>(null)
  const height = p.height ?? 220

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(220, el.clientWidth)))
    ro.observe(el)
    setWidth(Math.max(220, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const real = useMemo(() => p.points.filter((d): d is { x: number; y: number } => d.y !== null), [p.points])
  const m = { top: 12, right: 12, bottom: 24, left: 34 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom

  const xs = real.map((d) => d.x)
  const x0 = Math.min(...xs, ...(p.xTicks.length ? [p.xTicks[0].x] : []))
  const x1 = Math.max(...xs, ...(p.shade ? [p.shade[1]] : []))
  let [y0, y1] = p.yDomain ?? [Infinity, -Infinity]
  if (!p.yDomain) {
    for (const d of real) {
      y0 = Math.min(y0, d.y)
      y1 = Math.max(y1, d.y)
    }
    for (const b of p.band ?? []) {
      y0 = Math.min(y0, b.lo)
      y1 = Math.max(y1, b.hi)
    }
    for (const r of p.refLines ?? []) {
      y0 = Math.min(y0, r.y)
      y1 = Math.max(y1, r.y)
    }
    const pad = (y1 - y0 || 1) * 0.12
    y0 -= pad
    y1 += pad
  }
  const sx = (x: number) => m.left + ((x - x0) / (x1 - x0 || 1)) * iw
  const sy = (y: number) => m.top + (1 - (y - y0) / (y1 - y0 || 1)) * ih

  const path = useMemo(() => {
    let d = ''
    let prev: number | null = null
    for (const pt of real) {
      const jump = prev === null || (p.maxGap !== undefined && pt.x - prev > p.maxGap)
      d += `${jump ? 'M' : 'L'}${sx(pt.x).toFixed(1)},${sy(pt.y).toFixed(1)}`
      prev = pt.x
    }
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [real, width, height, y0, y1, x0, x1])

  const bandPath = useMemo(() => {
    const b = p.band ?? []
    if (b.length < 2) return ''
    const top = b.map((d, i) => `${i ? 'L' : 'M'}${sx(d.x).toFixed(1)},${sy(d.hi).toFixed(1)}`).join('')
    const bottom = [...b].reverse().map((d) => `L${sx(d.x).toFixed(1)},${sy(d.lo).toFixed(1)}`).join('')
    return `${top}${bottom}Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.band, width, height, y0, y1, x0, x1])

  if (real.length === 0) return <div ref={wrap} className="chart chart-empty">No data in this range.</div>

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = 0
    let bestDist = Infinity
    real.forEach((d, i) => {
      const dist = Math.abs(sx(d.x) - px)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setHover(best)
  }
  const h = hover !== null ? real[Math.min(hover, real.length - 1)] : null
  const tip = h ? p.tooltip(h) : null
  const yTicks = niceTicks(y0, y1, Math.max(2, Math.floor(ih / 44)))
  // Thin the x labels until they have room; the last one always stays.
  const every = Math.max(1, Math.ceil((p.xTicks.length * 64) / iw))
  const xTicks = p.xTicks.filter((_, i) => (p.xTicks.length - 1 - i) % every === 0)

  return (
    <div ref={wrap} className="chart">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={p.ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {p.shade && (
          <rect className="chart-shade" x={sx(p.shade[0])} y={m.top} width={Math.max(0, sx(p.shade[1]) - sx(p.shade[0]))} height={ih} />
        )}
        {yTicks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={m.left} x2={width - m.right} y1={sy(t)} y2={sy(t)} />
            <text className="chart-tick" x={m.left - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle">
              {p.yFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text
            key={t.x}
            className="chart-tick"
            x={sx(t.x)}
            y={height - 6}
            textAnchor={sx(t.x) > width - m.right - 24 ? 'end' : sx(t.x) < m.left + 24 ? 'start' : 'middle'}
          >
            {t.label}
          </text>
        ))}
        {bandPath && <path className="chart-band" d={bandPath} />}
        {(p.refLines ?? []).map((r) => (
          <g key={r.label}>
            <line className={`chart-ref chart-ref-${r.tone}`} x1={m.left} x2={width - m.right} y1={sy(r.y)} y2={sy(r.y)} />
            <text className="chart-ref-label" x={m.left + 4} y={sy(r.y) + (r.tone === 'limit' ? -6 : 14)}>
              {r.label}
            </text>
          </g>
        ))}
        <path className="chart-line" d={path} />
        {(p.marks ?? []).map((k) => (
          <path
            key={k.x}
            className="chart-mark"
            d={`M${sx(k.x)},${sy(k.y) - 7}l6,10h-12z`}
          />
        ))}
        {h && (
          <g>
            <line className="chart-cross" x1={sx(h.x)} x2={sx(h.x)} y1={m.top} y2={m.top + ih} />
            <circle className="chart-dot" cx={sx(h.x)} cy={sy(h.y)} r={4.5} />
          </g>
        )}
      </svg>
      {h && tip && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(sx(h.x), 70), width - 70), top: Math.max(sy(h.y) - 14, 34) }}
        >
          <strong>{tip.value}</strong>
          <span>{tip.title}</span>
        </div>
      )}
      {p.children}
    </div>
  )
}
