import { lazy, Suspense } from 'react'
import FACTS from './rigFacts.json'

/**
 * Each rig's own figures and equations, read from its controls panel at the default settings by
 * scripts/harvest-rig-facts.mjs (never typed in by hand). Shown on the home page and the Labs page.
 */
export interface RigReading {
  label: string
  value: string
  unit: string
}
export interface RigEquation {
  label: string
  tex: string
}
export interface RigFacts {
  readings: RigReading[]
  equations: RigEquation[]
}

const ALL = FACTS as Record<string, RigFacts>

export function rigFacts(moduleId: string, sceneId: string): RigFacts | null {
  return ALL[`${moduleId}/${sceneId}`] ?? null
}

/** every rig with facts, for picking a rig of the day */
export const RIGS_WITH_FACTS = Object.keys(ALL).filter((k) => ALL[k].readings.length || ALL[k].equations.length)

// KaTeX stays out of the home page's first load: equations draw once it arrives
const Tex = lazy(() => import('./Tex').then((m) => ({ default: m.Tex })))

/** a rig's readings as compact figures: value, unit, and what it measures */
export function RigReadings({ readings, max = 2, size = 'sm' }: { readings: RigReading[]; max?: number; size?: 'sm' | 'lg' }) {
  if (!readings.length) return null
  return (
    <dl className={`flex flex-wrap ${size === 'lg' ? 'gap-3' : 'gap-x-4 gap-y-1'}`}>
      {readings.slice(0, max).map((r) =>
        size === 'lg' ? (
          <div key={r.label} className="min-w-28 rounded-2xl border border-line-2 bg-[var(--color-scrim)] px-4 py-3 backdrop-blur-xl">
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-dim">{r.label}</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] font-medium tracking-tight text-ink">{r.value}</span>
              {r.unit ? <span className="text-[12px] text-mute">{r.unit}</span> : null}
            </dd>
          </div>
        ) : (
          <div key={r.label} className="min-w-0">
            <dd className="font-mono text-[14px] font-medium text-ink">
              {r.value}
              {r.unit ? <span className="ml-1 font-sans text-[11px] text-mute">{r.unit}</span> : null}
            </dd>
            <dt className="truncate text-[10.5px] uppercase tracking-wider text-dim">{r.label}</dt>
          </div>
        ),
      )}
    </dl>
  )
}

/** a rig's first equations, each with what it works out */
export function RigEquations({ equations, max = 2 }: { equations: RigEquation[]; max?: number }) {
  if (!equations.length) return null
  return (
    <ul className="space-y-2">
      {equations.slice(0, max).map((e) => (
        <li key={e.label}>
          <div className="text-[11px] text-dim">{e.label}</div>
          <div className="overflow-x-auto text-[13px] text-ink [scrollbar-width:none]">
            <Suspense fallback={<code className="text-[11.5px] text-mute">{e.tex}</code>}>
              <Tex tex={e.tex} />
            </Suspense>
          </div>
        </li>
      ))}
    </ul>
  )
}
