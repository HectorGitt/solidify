import type { Citation } from '@/content/citations'
import { useAcademic } from './audience'
import { Badge } from './controls'
import { Tex } from './Tex'

export interface WorkingStep {
  label: string
  /** symbolic formula (KaTeX) */
  tex: string
  /** the same formula with numbers substituted (KaTeX) */
  sub?: string
  /** result (KaTeX), e.g. "= 60.2\\,\\%" */
  result?: string
  cite?: Citation
  /** added from standard texts, not in the notes */
  beyond?: boolean
  /** the notes / marking guide differ here */
  errata?: string
}

/** "Show working": formula → substituted numbers → result, with the source. */
export function Working({ steps }: { steps: WorkingStep[] }) {
  const academic = useAcademic()
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="rounded-md border border-line bg-panel-2/60 px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-medium text-ink/90">{s.label}</span>
            {academic && s.beyond ? (
              <Badge tone="info" title="Standard engineering result, added beyond the course notes">
                beyond notes
              </Badge>
            ) : null}
            {academic && s.errata ? (
              <Badge tone="warn" title={s.errata}>
                note discrepancy
              </Badge>
            ) : null}
          </div>
          <div className="text-[13px] text-ink">
            <Tex tex={s.tex} display />
          </div>
          {s.sub ? (
            <div className="text-[12.5px] text-mute">
              <Tex tex={s.sub} display />
            </div>
          ) : null}
          {s.result ? (
            <div className="text-[13px] text-accent">
              <Tex tex={s.result} display />
            </div>
          ) : null}
          {academic && s.errata ? <p className="mt-1 text-[11.5px] leading-snug text-warn/90">{s.errata}</p> : null}
        </li>
      ))}
    </ol>
  )
}

/** Format a number for KaTeX with sensible precision. */
export function n(v: number, digits = 4) {
  if (!Number.isFinite(v)) return '\\text{—}'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
    const [m, e] = v.toExponential(Math.max(0, digits - 1)).split('e')
    return `${m}\\times10^{${parseInt(e, 10)}}`
  }
  const s = digits < 1 ? String(Math.round(v)) : Number(v.toPrecision(digits)).toString()
  // thin-space thousands
  const [int, frac] = s.split('.')
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')
  return frac ? `${withSep}.${frac}` : withSep
}
