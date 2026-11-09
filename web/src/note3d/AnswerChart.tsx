import { ChartView, fmtNum } from './ChartView'
import { evaluateChart, type NoteChartSpec } from './schema'

/**
 * A chart inside a written answer, as Gemini writes it in a ```chart block (JSON):
 * - a curve: { "title", "x": { "label", "unit", "from", "to" }, "y": { "label", "unit" }, "series": [{ "label", "formula" }] }
 *   with each formula in x and numbers only, drawn like a model's charts;
 * - data: { "type": "bar", "title", "x": { "label" }, "y": { "label", "unit" }, "categories": [...], "series": [{ "label", "values": [...] }] }.
 * Anything malformed is not drawn (the text around it still is).
 */
export type AnswerChartSpec =
  | { kind: 'curve'; chart: NoteChartSpec }
  | { kind: 'bar'; title: string; xLabel: string; yLabel: string; unit: string; categories: string[]; series: { label: string; values: number[] }[] }

const str = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function readAnswerChart(json: string): AnswerChartSpec | null {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(json)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const x = (o.x ?? {}) as Record<string, unknown>
  const y = (o.y ?? {}) as Record<string, unknown>
  const series = Array.isArray(o.series) ? (o.series as Record<string, unknown>[]).filter((s) => s && typeof s === 'object').slice(0, 4) : []
  if (!series.length) return null
  if (o.type === 'bar') {
    const categories = (Array.isArray(o.categories) ? o.categories : []).map((c) => str(c, 40)).slice(0, 24)
    const ss = series
      .map((s) => ({ label: str(s.label, 40), values: (Array.isArray(s.values) ? s.values : []).map(Number).slice(0, categories.length) }))
      .filter((s) => s.values.length === categories.length && s.values.every(Number.isFinite))
    if (!categories.length || !ss.length) return null
    return { kind: 'bar', title: str(o.title, 120), xLabel: str(x.label), yLabel: str(y.label), unit: str(y.unit, 20), categories, series: ss }
  }
  const chart: NoteChartSpec = {
    id: 'answer',
    title: str(o.title, 120) || 'Graph',
    x: { label: str(x.label, 60) || 'x', unit: str(x.unit, 20), from: typeof x.from === 'number' || typeof x.from === 'string' ? x.from : 0, to: typeof x.to === 'number' || typeof x.to === 'string' ? x.to : 1 },
    y: { label: str(y.label, 60) || 'y', unit: str(y.unit, 20) },
    series: series.map((s, i) => ({ id: `s${i}`, label: str(s.label, 60) || `Series ${i + 1}`, formula: str(s.formula, 300) })).filter((s) => s.formula),
  }
  if (!chart.series.length) return null
  return { kind: 'curve', chart }
}

const COLORS = ['var(--color-accent)', 'var(--color-info, #3b82f6)', 'var(--color-warn)', 'var(--color-mute)']

export function AnswerChart({ spec }: { spec: AnswerChartSpec }) {
  if (spec.kind === 'curve') {
    const ev = evaluateChart(spec.chart, {})
    if (!ev || !ev.series.some((s) => s.ys.some((v) => Number.isFinite(v) && v !== 0))) return null
    // a readable size in a wide answer column, as in the model view's panel
    return (
      <div className="max-w-lg">
        <ChartView chart={ev} />
      </div>
    )
  }
  const W = 360
  const H = 220
  const pad = { l: 44, r: 8, t: 26, b: 40 }
  const all = spec.series.flatMap((s) => s.values)
  const top = Math.max(0, ...all)
  const bottom = Math.min(0, ...all)
  const span = top - bottom || 1
  const yOf = (v: number) => pad.t + ((top - v) / span) * (H - pad.t - pad.b)
  const slot = (W - pad.l - pad.r) / spec.categories.length
  const barW = Math.max(3, (slot * 0.7) / spec.series.length)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => bottom + span * k)
  return (
    <figure className="max-w-lg rounded-2xl border border-line bg-panel-2/40 p-3">
      <figcaption className="mb-1 text-[12.5px] font-semibold text-ink">{spec.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={spec.title}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={yOf(t)} y2={yOf(t)} stroke="var(--color-line)" strokeWidth={0.6} />
            <text x={pad.l - 4} y={yOf(t) + 3} textAnchor="end" fontSize={8.5} fill="var(--color-mute)">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {spec.categories.map((c, i) => (
          <g key={c + i}>
            {spec.series.map((s, j) => {
              const v = s.values[i]
              const x = pad.l + slot * i + (slot - barW * spec.series.length) / 2 + barW * j
              const y0 = yOf(Math.max(0, v))
              const h = Math.abs(yOf(v) - yOf(0))
              return (
                <rect key={j} x={x} y={y0} width={barW} height={Math.max(0.5, h)} rx={1.5} fill={COLORS[j % COLORS.length]}>
                  <title>{`${s.label ? `${s.label}, ` : ''}${c}: ${fmtNum(v)}${spec.unit ? ` ${spec.unit}` : ''}`}</title>
                </rect>
              )
            })}
            <text x={pad.l + slot * i + slot / 2} y={H - pad.b + 12} textAnchor="middle" fontSize={8.5} fill="var(--color-ink)">
              {c.length > 10 ? `${c.slice(0, 9)}…` : c}
            </text>
          </g>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--color-mute)">
          {spec.xLabel}
        </text>
        <text x={10} y={pad.t - 10} fontSize={9} fill="var(--color-mute)">
          {spec.yLabel}
          {spec.unit ? ` (${spec.unit})` : ''}
        </text>
      </svg>
      {spec.series.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-mute">
          {spec.series.map((s, j) => (
            <span key={j} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: COLORS[j % COLORS.length] }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  )
}
