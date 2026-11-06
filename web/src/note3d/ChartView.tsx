import { useMemo, useRef, useState, type PointerEvent } from 'react'
import type { EvaluatedChart } from './schema'

/** round tick steps: 1, 2 or 5 times a power of ten */
function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target)
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)))
  const n = raw / mag
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag
}

function ticks(min: number, max: number, target: number) {
  const step = niceStep(max - min || 1, target)
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v)
  return out
}

export const fmtNum = (v: number) => {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 10000) return v.toExponential(2)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  if (a >= 1) return v.toFixed(2)
  return Number(v.toPrecision(3)).toString()
}

const COLORS = ['var(--color-accent)', 'var(--color-info, #3b82f6)', 'var(--color-warn)', 'var(--color-mute)']
const W = 360
const H = 220
const PAD = { l: 46, r: 14, t: 14, b: 34 }

/**
 * A graph from the model, drawn properly: axes in real units, a zero line, the peak marked with its value,
 * and a readout that follows the pointer. It redraws as the sliders move.
 */
export function ChartView({ chart }: { chart: EvaluatedChart }) {
  const { spec, xs, series } = chart
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const geo = useMemo(() => {
    const x0 = xs[0]
    const x1 = xs[xs.length - 1]
    // a little headroom, and zero always in view (diagrams are read from zero)
    const span = chart.yMax - chart.yMin || Math.abs(chart.yMax) || 1
    const y0 = chart.yMin - span * 0.08
    const y1 = chart.yMax + span * 0.12
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r)
    const sy = (y: number) => PAD.t + (1 - (y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b)
    return { x0, x1, y0, y1, sx, sy, xt: ticks(Math.min(x0, x1), Math.max(x0, x1), 5), yt: ticks(y0, y1, 4) }
  }, [xs, chart.yMin, chart.yMax])

  const { sx, sy } = geo
  const zeroY = sy(0)
  // the series' largest value by size: what a diagram is read for
  const peak = series[0] ? (Math.abs(series[0].max.y) >= Math.abs(series[0].min.y) ? series[0].max : series[0].min) : null

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    const px = ((e.clientX - r.left) / r.width) * W
    const t = (px - PAD.l) / (W - PAD.l - PAD.r)
    setHover(t < -0.02 || t > 1.02 ? null : Math.max(0, Math.min(xs.length - 1, Math.round(t * (xs.length - 1)))))
  }

  return (
    <figure className="rounded-2xl border border-line-2 p-3">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{spec.title}</span>
        {series.length > 1 ? (
          <span className="flex flex-wrap gap-x-3 text-[11.5px] text-mute">
            {series.map((s, i) => (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3 rounded" style={{ background: COLORS[i] }} />
                {s.label}
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`${spec.title}: ${series.map((s) => `${s.label} from ${fmtNum(s.min.y)} to ${fmtNum(s.max.y)} ${spec.y.unit}`).join('; ')}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* grid and ticks */}
        <g className="text-dim" fontSize="9.5" fill="currentColor">
          {geo.yt.map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--color-line)" strokeWidth="0.6" />
              <text x={PAD.l - 5} y={sy(v) + 3} textAnchor="end" className="font-mono">
                {fmtNum(v)}
              </text>
            </g>
          ))}
          {geo.xt.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-line)" strokeWidth="0.6" />
              <text x={sx(v)} y={H - PAD.b + 12} textAnchor="middle" className="font-mono">
                {fmtNum(v)}
              </text>
            </g>
          ))}
          <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" className="text-mute" fill="currentColor" fontSize="10">
            {spec.x.label}
            {spec.x.unit ? ` (${spec.x.unit})` : ''}
          </text>
          <text transform={`translate(10 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" className="text-mute" fill="currentColor" fontSize="10">
            {spec.y.label}
            {spec.y.unit ? ` (${spec.y.unit})` : ''}
          </text>
        </g>
        {/* the zero line, which a diagram is read from */}
        {zeroY >= PAD.t && zeroY <= H - PAD.b ? <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY} stroke="var(--color-ink)" strokeOpacity="0.55" strokeWidth="1" /> : null}

        {series.map((s, i) => {
          const line = s.ys.map((y, k) => `${k ? 'L' : 'M'}${sx(xs[k]).toFixed(1)},${sy(y).toFixed(1)}`).join(' ')
          const area = `${line} L${sx(xs[xs.length - 1]).toFixed(1)},${zeroY.toFixed(1)} L${sx(xs[0]).toFixed(1)},${zeroY.toFixed(1)} Z`
          return (
            <g key={s.id}>
              {i === 0 ? <path d={area} fill={COLORS[i]} fillOpacity="0.14" /> : null}
              <path d={line} fill="none" stroke={COLORS[i]} strokeWidth="1.8" strokeLinejoin="round" />
            </g>
          )
        })}

        {/* the peak, labelled */}
        {peak && hover === null ? (
          <g>
            <circle cx={sx(peak.x)} cy={sy(peak.y)} r="3.2" fill={COLORS[0]} stroke="var(--color-bg)" strokeWidth="1.2" />
            <text
              x={Math.min(W - PAD.r - 2, Math.max(PAD.l + 2, sx(peak.x)))}
              y={sy(peak.y) + (peak.y >= 0 ? -7 : 14)}
              textAnchor={sx(peak.x) > W * 0.7 ? 'end' : sx(peak.x) < W * 0.3 ? 'start' : 'middle'}
              fontSize="10"
              className="font-mono"
              fill="var(--color-ink)"
            >
              {fmtNum(peak.y)} {spec.y.unit} at {fmtNum(peak.x)} {spec.x.unit}
            </text>
          </g>
        ) : null}

        {/* the readout under the pointer */}
        {hover !== null ? (
          <g>
            <line x1={sx(xs[hover])} x2={sx(xs[hover])} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-ink)" strokeOpacity="0.4" strokeDasharray="3 3" />
            {series.map((s, i) => (
              <circle key={s.id} cx={sx(xs[hover])} cy={sy(s.ys[hover])} r="3" fill={COLORS[i]} stroke="var(--color-bg)" strokeWidth="1.2" />
            ))}
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex min-h-[18px] flex-wrap gap-x-3 font-mono text-[11.5px] text-mute">
        {hover !== null ? (
          <>
            <span className="text-ink">
              {spec.x.label} {fmtNum(xs[hover])} {spec.x.unit}
            </span>
            {series.map((s, i) => (
              <span key={s.id} style={{ color: COLORS[i] }}>
                {series.length > 1 ? `${s.label} ` : ''}
                {fmtNum(s.ys[hover])} {spec.y.unit}
              </span>
            ))}
          </>
        ) : (
          <span>
            {series.map((s) => `${series.length > 1 ? `${s.label}: ` : ''}max ${fmtNum(s.max.y)}, min ${fmtNum(s.min.y)} ${spec.y.unit}`).join(' · ')}
          </span>
        )}
      </div>
    </figure>
  )
}
