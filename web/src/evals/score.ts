import { resolveAssembly } from '@/note3d/assembly'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { evaluateCalculations, evaluateChart, type NoteSceneSpec } from '@/note3d/schema'
import type { EvalCase } from './cases'

export interface EvalCheck {
  name: string
  ok: boolean
  detail?: string
}

/** test equipment that should only appear when a test rig is asked for */
const RIG = /dial|gauge|indicator|extensometer|load cell|test bed|machine bed|test frame|grip|hanger|dead ?weight/i

/** a known answer may come back in other units (kN·m as N·m, mm as m): accept it at any power of a thousand */
const matches = (got: number, want: number, tol: number) => [1e-6, 1e-3, 1, 1e3, 1e6].some((k) => Math.abs(got * k - want) <= Math.abs(want) * tol)

/**
 * Scores one build against its case, the way the app would see it: the answer is cleaned as the client
 * cleans it, laid out by the assembly solver, and its calculations and charts worked out from the default
 * sizes. Score = the share of checks that pass, 0 to 100.
 */
export function scoreBuild(c: EvalCase, reply: Record<string, unknown>, seconds: number): { score: number; checks: EvalCheck[] } {
  const checks: EvalCheck[] = []
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(detail ? { detail: detail.slice(0, 300) } : {}) })
  const spec: NoteSceneSpec | null = sanitizeGeneratedSpec(reply, c.prompt)
  add('builds', !!spec, spec ? undefined : 'the answer could not be turned into a model')
  if (!spec) return { score: 0, checks }

  const params = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
  const { results, scope } = evaluateCalculations(spec.calculations, params)
  const raw = (reply.spec ?? reply) as { parts?: { shapes?: unknown[] }[] }
  const rawShapes = (raw.parts ?? []).reduce((n, p) => n + (Array.isArray(p.shapes) ? p.shapes.length : 0), 0)
  const keptShapes = spec.parts.reduce((n, p) => n + p.shapes.length, 0)

  if (c.parts) add('part count', spec.parts.length >= c.parts[0] && spec.parts.length <= c.parts[1], `${spec.parts.length} parts (expected ${c.parts[0]} to ${c.parts[1]})`)
  add('every shape drawable', keptShapes === rawShapes, keptShapes === rawShapes ? undefined : `${rawShapes - keptShapes} of ${rawShapes} shapes dropped`)

  const { issues } = resolveAssembly(spec, scope)
  add('layout', issues.length === 0, issues.map((i) => i.message).join('; ') || undefined)
  if (spec.parts.length >= 3) {
    const mounted = spec.parts.filter((p) => p.mount).length
    add('assembled by relation', mounted >= 0.6 * (spec.parts.length - 1), `${mounted} of ${spec.parts.length - 1} non-anchor parts mounted`)
  }

  const bad = results.filter((r) => !Number.isFinite(r.value))
  add('calculations work', results.length > 0 && bad.length === 0, results.length ? (bad.length ? `${bad.map((r) => r.spec.label).join(', ')} not a number` : undefined) : 'no calculations')

  if (c.charts) {
    const drawn = (spec.charts ?? []).map((ch) => evaluateChart(ch, scope)).filter((ch) => ch && ch.series.some((s) => s.ys.some((y) => Math.abs(y) > 1e-12)))
    add('charts', drawn.length > 0, drawn.length ? undefined : `${spec.charts?.length ?? 0} charts, none drawable`)
  }
  if (c.arrows) {
    const loads = (spec.annotations ?? []).filter((a) => a.kind === 'force' || a.kind === 'moment')
    const loose = loads.filter((a) => !a.anchor)
    add('loads as attached arrows', loads.length > 0 && loose.length === 0, loads.length ? (loose.length ? `${loose.length} of ${loads.length} not attached to a part` : undefined) : 'no load arrows')
  }
  if (c.noRig) {
    const rig = spec.parts.filter((p) => RIG.test(p.name))
    add('no test rig', rig.length === 0, rig.length ? `has ${rig.map((p) => p.name).join(', ')}` : undefined)
  }
  if (c.answer) {
    const a = c.answer
    const hits = results.filter((r) => a.label.test(r.spec.label))
    const ok = hits.some((r) => matches(r.value, a.value, a.tol))
    add('right answer', ok, ok ? undefined : hits.length ? `${hits.map((r) => `${r.spec.label} = ${r.formatted} ${r.spec.unit}`).join('; ')}; expected ${a.value}` : `no calculation matching ${a.label}`)
  }
  add('under two minutes', seconds <= 120, `${Math.round(seconds)} s`)

  const passed = checks.filter((x) => x.ok).length
  return { score: Math.round((100 * passed) / checks.length), checks }
}
