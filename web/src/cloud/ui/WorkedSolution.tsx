import { useEffect, useState } from 'react'
import { fmtNum } from '@/note3d/ChartView'
import { exprTex, nameTex } from '@/note3d/exprTex'
import { RichInline, RichText } from '@/ui/RichText'
import type { EvaluatedCalculation, NoteParameterSpec, NoteQuestionSpec } from '@/note3d/schema'
import { useProgress } from '@/study/progress'
import { checkAnswer, parseAnswer } from '@/study/types'
import { Tex } from '@/ui/Tex'

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g
const FUNCS = new Set(['pi', 'PI', 'sqrt', 'sin', 'cos', 'tan', 'atan', 'asin', 'acos', 'atan2', 'exp', 'log', 'ln', 'log10', 'pow', 'sinh', 'cosh', 'tanh', 'hypot', 'floor', 'ceil', 'round', 'abs', 'min', 'max', 'step', 'mac'])

/** a formula with the numbers it uses put in, e.g. "R_B * L" → "6 × 4.5" */
export function workedFormula(formula: string, scope: Record<string, number>) {
  return formula
    .replace(IDENT, (id) => (FUNCS.has(id) ? id : scope[id] !== undefined ? fmtNum(scope[id]) : id))
    .replace(/\*/g, ' × ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** a symbol as written in an equation: one that is already LaTeX ("\beta_{rad}") as it is, else R_B → R_{B} */
const symTex = (s: string) => (/[\\{}]/.test(s) ? s : nameTex(s))

/** a given as the question states it: its own unit, not converted */
const given = (v: number, unit: string) => `${Number(v.toPrecision(6))}${unit ? ` ${unit}` : ''}`

const H = ({ children, tone = 'text-dim' }: { children: string; tone?: string }) => <h3 className={`mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide ${tone}`}>{children}</h3>

/**
 * A pasted problem, solved: the question as given, its givens (the sliders, so their values are live), what
 * it asks for, the worked solution step by step (what each step does, the formula, the numbers put in, the
 * result) and the answers. Every number is worked out here from the model's own formulas, so moving a slider
 * re-solves the whole problem.
 *
 * "Try it yourself" turns it into practice, as in Exam practice: the solution hides, the student answers what
 * is asked, Check marks each answer (within 1 % of the live result) and records it in Progress; "New numbers"
 * gives the same problem with fresh givens.
 */
export function WorkedSolution({
  question,
  parameters,
  scope,
  results,
  onExplain,
  disabled,
  practiceId,
  onNewNumbers,
  startTrying = false,
}: {
  question: NoteQuestionSpec
  parameters: NoteParameterSpec[]
  scope: Record<string, number>
  results: EvaluatedCalculation[]
  onExplain: (label: string) => void
  disabled?: boolean
  /** where attempts are recorded in Progress */
  practiceId: string
  /** fresh givens for the same problem; false when none could be found */
  onNewNumbers?: () => boolean
  /** open as practice (answers first), as from Exam practice's "Your questions" */
  startTrying?: boolean
}) {
  const long = question.text.length > 420
  const [open, setOpen] = useState(!long)
  const [trying, setTrying] = useState(startTrying)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [marks, setMarks] = useState<Record<string, boolean> | null>(null)
  const [stale, setStale] = useState('')
  const record = useProgress((s) => s.recordAnswer)
  const stat = useProgress((s) => s.questions[practiceId])
  const answers = results.some((r) => r.spec.answer) ? results.filter((r) => r.spec.answer) : results.slice(-1)
  const usable = answers.filter((r) => !r.broken)
  // how each name is written in an equation (a calculation by its symbol), and the numbers to put in
  const symbols = Object.fromEntries([...parameters.map((p) => [p.id, p.symbol || p.id]), ...results.map((r) => [r.spec.id, r.spec.symbol || r.spec.id])])
  // a negative number put in is bracketed: 6 − (−2), not 6 − −2
  // an earlier result goes in exactly as it is shown in its own step (21.67, not 21.7)
  const shown = new Map(results.map((r) => [r.spec.id, r.formatted]))
  const values = Object.fromEntries(Object.entries(scope).map(([k, v]) => {
    const s = shown.get(k) ?? fmtNum(v)
    return [k, s.startsWith('-') ? `\\left(${s}\\right)` : s]
  }))

  // new givens: the old answers and marks no longer apply
  const key = parameters.map((p) => scope[p.id]).join('|')
  useEffect(() => {
    if (stale && stale !== key) {
      setInputs({})
      setMarks(null)
    }
    setStale(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const check = () => {
    const m = Object.fromEntries(
      usable.map((r) => [r.spec.id, checkAnswer({ key: r.spec.id, label: r.spec.label, unit: r.spec.unit, expected: r.value }, r.value, parseAnswer(inputs[r.spec.id] ?? ''))]),
    )
    setMarks(m)
    const got = Object.values(m).filter(Boolean).length
    record(practiceId, got === usable.length, usable.length ? got / usable.length : 0)
  }
  const fresh = () => {
    if (onNewNumbers && !onNewNumbers()) return
    setInputs({})
    setMarks(null)
  }
  const got = marks ? Object.values(marks).filter(Boolean).length : 0

  // a derivation with no numbers given: shown in symbols only (the sliders' values just draw the model)
  const symbolic = !!question.symbolic
  return (
    <div className="space-y-4">
      {symbolic ? (
        <p className="rounded-xl border border-line-2 bg-panel-2/60 px-3 py-2 text-[12px] leading-relaxed text-mute">
          Worked in symbols: the result holds for any values. The sliders only size the 3D model.
        </p>
      ) : null}
      <div className={`flex flex-wrap items-center gap-2 ${symbolic ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => {
            setTrying((t) => !t)
            setMarks(null)
          }}
          className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${trying ? 'border border-line-2 text-ink hover:border-ink/40' : 'bg-accent text-accent-ink hover:brightness-110'}`}
        >
          {trying ? 'Show the solution' : 'Try it yourself'}
        </button>
        {onNewNumbers ? (
          <button type="button" disabled={disabled} onClick={fresh} className="rounded-full border border-line-2 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40 disabled:opacity-50" title="The same problem with different givens">
            New numbers
          </button>
        ) : null}
        {stat ? (
          <span className="text-[11.5px] text-dim">
            {stat.correct}/{stat.attempts} tries right
          </span>
        ) : null}
      </div>

      <div>
        <H>Question</H>
        <div className={`text-[13px] leading-relaxed text-ink/90 ${open ? '' : 'line-clamp-5'}`}>
          <RichText text={question.text} />
        </div>
        {long ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[12px] font-medium text-accent hover:underline">
            {open ? 'Show less' : 'Show the whole question'}
          </button>
        ) : null}
      </div>

      {parameters.length ? (
        <div>
          <H>{trying ? 'Given (these numbers)' : 'Given'}</H>
          <ul className="space-y-1 text-[12.5px]">
            {parameters.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-0.5">
                <span className="min-w-0 truncate text-mute">
                  <RichInline text={p.label} />
                  {p.symbol ? <span className="ml-1 text-dim">({p.symbol})</span> : null}
                </span>
                {symbolic ? null : <span className="shrink-0 font-mono text-ink">{given(scope[p.id] ?? p.value, p.unit)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.find.length ? (
        <div>
          <H>Find</H>
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink/90">
            {question.find.map((f) => (
              <li key={f}>
                <RichInline text={f} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trying ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
          className="space-y-2"
        >
          <H>Your answers</H>
          {usable.map((r) => {
            const m = marks?.[r.spec.id]
            return (
              <label key={r.spec.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${m === undefined ? 'border-line-2' : m ? 'border-accent/60 bg-accent/5' : 'border-danger/50 bg-danger/5'}`}>
                <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                  <RichInline text={r.spec.label} />
                </span>
                <input
                  inputMode="decimal"
                  value={inputs[r.spec.id] ?? ''}
                  onChange={(e) => setInputs({ ...inputs, [r.spec.id]: e.target.value })}
                  aria-label={`${r.spec.label} in ${r.spec.unit || 'no unit'}`}
                  className="w-24 rounded-md border border-line-2 bg-bg px-2 py-1 text-right font-mono text-[13px] text-ink outline-none focus:border-accent"
                />
                <span className="w-12 shrink-0 text-[12px] text-mute">{r.spec.unit}</span>
                {m !== undefined ? <span className={`w-4 shrink-0 text-[13px] font-semibold ${m ? 'text-accent' : 'text-danger'}`}>{m ? '✓' : '✗'}</span> : null}
              </label>
            )
          })}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" disabled={!usable.length} className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:brightness-110 disabled:opacity-50">
              Check
            </button>
            {marks ? (
              <span className={`text-[12.5px] font-medium ${got === usable.length ? 'text-accent' : 'text-warn'}`}>
                {got === usable.length ? 'All correct' : `${got} of ${usable.length} correct`}
              </span>
            ) : null}
            {marks && got < usable.length ? (
              <button type="button" onClick={() => setTrying(false)} className="text-[12.5px] font-medium text-accent hover:underline">
                See how it is worked out
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-dim">Answers are accepted within about 1 % of the worked value.</p>
        </form>
      ) : (
        <>
          {results.length ? (
            <div>
              <H>Solution</H>
              <ol className="space-y-2.5">
                {results.map((r, i) => {
                  const c = r.spec
                  return (
                    <li key={c.id} className={`rounded-xl border px-3 py-2.5 ${r.broken ? 'border-warn/60 bg-warn/5' : c.answer ? 'border-accent/50 bg-accent/5' : 'border-line-2'}`}>
                      <div className="flex gap-2.5">
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${c.answer ? 'bg-accent text-accent-ink' : 'bg-panel-2 text-mute'}`}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          {/* the step's sentence may name symbols in LaTeX ($R_B$) */}
                          <RichText text={c.step ?? c.label} className="text-[12.5px] leading-snug text-ink" />
                          {/* the equation: as the model wrote it, else its formula written out as maths */}
                          {c.latex || exprTex(c.formula, { symbols }) ? (
                            <div className="mt-1.5 overflow-x-auto text-[12.5px] text-ink/85">
                              {/* full-size fractions, as a textbook writes a working step */}
                              <Tex tex={`\\displaystyle ${c.latex || `${symTex(c.symbol || c.label)} = ${exprTex(c.formula, { symbols })}`}`} />
                            </div>
                          ) : null}
                          {/* the same with the numbers put in, then the result */}
                          <p className={`mt-1 overflow-x-auto text-[12px] leading-relaxed text-mute ${symbolic ? 'hidden' : ''}`}>
                            {exprTex(c.formula, { values }) ? (
                              <Tex tex={`\\displaystyle = ${exprTex(c.formula, { values })} = \\mathbf{${r.broken ? '—' : r.formatted}}`} />
                            ) : (
                              <span className="font-mono">= {workedFormula(c.formula, scope)} = <span className="font-semibold text-ink">{r.formatted}</span></span>
                            )}{' '}
                            {r.broken ? null : <span className="text-ink/80">{c.unit}</span>}
                          </p>
                          {r.broken ? <p className="mt-1 text-[11.5px] text-warn">This step can’t be worked out with these numbers (a root of a negative, a division by zero, or something it doesn’t know).</p> : null}
                          <div className="mt-1 flex items-center gap-3">
                            {c.step ? (
                              <span className="text-[11px] text-dim">
                                <RichInline text={c.label} />
                              </span>
                            ) : null}
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
              <H tone="text-accent">Answer</H>
              <ul className="space-y-1">
                {answers.map((r) => (
                  <li key={r.spec.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-ink/90">
                      <RichInline text={r.spec.label} />
                    </span>
                    {symbolic ? (
                      // the result in symbols, as derived
                      <span className="min-w-0 overflow-x-auto text-[14px] text-ink">
                        <Tex tex={`\\displaystyle ${r.spec.latex || `${symTex(r.spec.symbol || r.spec.label)} = ${exprTex(r.spec.formula, { symbols }) ?? r.spec.formula}`}`} />
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-[15px] font-semibold text-ink">
                        {r.formatted} <span className="text-[12px] font-normal text-mute">{r.broken ? '' : r.spec.unit}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {symbolic ? null : <p className="mt-2 text-[11.5px] text-dim">Move the givens to see how the answer changes.</p>}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
