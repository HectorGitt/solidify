import { useState } from 'react'
import { fmtNum } from '@/note3d/ChartView'
import type { EvaluatedCalculation, NoteParameterSpec, NoteQuestionSpec } from '@/note3d/schema'
import { Tex } from '@/ui/Tex'

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g
const FUNCS = new Set(['pi', 'PI', 'sqrt', 'sin', 'cos', 'tan', 'atan', 'exp', 'log', 'abs', 'min', 'max', 'step', 'mac'])

/** a formula with the numbers it uses put in, e.g. "R_B * L" → "6 × 4.5" */
export function workedFormula(formula: string, scope: Record<string, number>) {
  return formula
    .replace(IDENT, (id) => (FUNCS.has(id) ? id : scope[id] !== undefined ? fmtNum(scope[id]) : id))
    .replace(/\*/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** a given as the question states it: its own unit, not converted */
const given = (v: number, unit: string) => `${Number(v.toPrecision(6))}${unit ? ` ${unit}` : ''}`

/**
 * A pasted problem, solved: the question as given, its givens (the sliders, so their values are live), what
 * it asks for, the worked solution step by step (what each step does, the formula, the numbers put in, the
 * result) and the answers. Every number is worked out here from the model's own formulas, so moving a slider
 * re-solves the whole problem.
 */
export function WorkedSolution({
  question,
  parameters,
  scope,
  results,
  onExplain,
  disabled,
}: {
  question: NoteQuestionSpec
  parameters: NoteParameterSpec[]
  scope: Record<string, number>
  results: EvaluatedCalculation[]
  onExplain: (label: string) => void
  disabled?: boolean
}) {
  const long = question.text.length > 420
  const [open, setOpen] = useState(!long)
  const answers = results.some((r) => r.spec.answer) ? results.filter((r) => r.spec.answer) : results.slice(-1)
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-dim">Question</h3>
        <p className={`whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90 ${open ? '' : 'line-clamp-5'}`}>{question.text}</p>
        {long ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[12px] font-medium text-accent hover:underline">
            {open ? 'Show less' : 'Show the whole question'}
          </button>
        ) : null}
      </div>

      {parameters.length ? (
        <div>
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-dim">Given</h3>
          <ul className="space-y-1 text-[12.5px]">
            {parameters.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-0.5">
                <span className="min-w-0 truncate text-mute">
                  {p.label}
                  {p.symbol ? <span className="ml-1 text-dim">({p.symbol})</span> : null}
                </span>
                <span className="shrink-0 font-mono text-ink">{given(scope[p.id] ?? p.value, p.unit)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.find.length ? (
        <div>
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-dim">Find</h3>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink/90">
            {question.find.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {results.length ? (
        <div>
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-dim">Solution</h3>
          <ol className="space-y-2.5">
            {results.map((r, i) => {
              const c = r.spec
              return (
                <li key={c.id} className={`rounded-xl border px-3 py-2.5 ${c.answer ? 'border-accent/50 bg-accent/5' : 'border-line-2'}`}>
                  <div className="flex gap-2.5">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${c.answer ? 'bg-accent text-accent-ink' : 'bg-panel-2 text-mute'}`}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-snug text-ink">{c.step ?? c.label}</p>
                      {c.latex ? (
                        <div className="mt-1.5 overflow-x-auto text-[12px] text-ink/85">
                          <Tex tex={c.latex} />
                        </div>
                      ) : null}
                      <p className="mt-1 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-mute">
                        {c.symbol || c.label} = {workedFormula(c.formula, scope)} = <span className="font-semibold text-ink">{r.formatted}</span> {c.unit}
                      </p>
                      <div className="mt-1 flex items-center gap-3">
                        {c.step ? <span className="text-[11px] text-dim">{c.label}</span> : null}
                        <button type="button" disabled={disabled} onClick={() => onExplain(c.label)} className="text-[11.5px] font-medium text-accent hover:underline disabled:opacity-50">
                          Explain this step
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      {answers.length ? (
        <div className="rounded-2xl border-2 border-accent/60 bg-accent/5 px-3.5 py-3">
          <h3 className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-accent">Answer</h3>
          <ul className="space-y-1">
            {answers.map((r) => (
              <li key={r.spec.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-ink/90">{r.spec.label}</span>
                <span className="shrink-0 font-mono text-[15px] font-semibold text-ink">
                  {r.formatted} <span className="text-[12px] font-normal text-mute">{r.spec.unit}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-dim">Move the givens to see how the answer changes.</p>
        </div>
      ) : null}
    </div>
  )
}
