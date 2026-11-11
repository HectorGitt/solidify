import * as THREE from 'three'
import { resolveAnnotation, resolveAssembly, type PartFrame } from '@/note3d/assembly'
import { heldProblems } from '@/note3d/held'
import { buildKinematics, mechanismProblems } from '@/note3d/kinematics'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import { evalVec3, evaluateCalculations, evaluateChart, type NoteSceneSpec } from '@/note3d/schema'
import type { EvalCase } from './cases'

export interface EvalCheck {
  name: string
  ok: boolean
  detail?: string
}

/** test equipment that should only appear when a test rig is asked for */
const RIG = /dial|gauge(?! ?(mark|length))|indicator|extensometer|load cell|test bed|machine bed|test frame|grip|hanger|dead ?weight/i

/** a known answer may come back in other units (kN·m as N·m, mm as m): accept it at any power of a thousand */
const matches = (got: number, want: number, tol: number) => [1e-6, 1e-3, 1, 1e3, 1e6].some((k) => Math.abs(got * k - want) <= Math.abs(want) * tol)

const PISTON = /piston|plunger|crosshead/i
const CONROD = /connecting rod|conrod|con-rod|coupler/i
/** parts that turn on a shaft and must be mounted on it (a flywheel set by coordinates ends up tilted through the casing) */
const ON_SHAFT = /flywheel|pulley|sprocket|impeller|sheave|cam\b|disc\b|disk\b/i
/** named after one but not one: a cam follower, a pulley guard, the shaft itself */
const NOT_ON_SHAFT = /follower|shaft|guard|cover|casing|housing|brake pad|caliper/i

/**
 * A mechanism is only a mechanism if its moving parts are joined the way they move: a connecting rod linked to
 * the crank, the piston it drives sliding on the crank's line, a flywheel or pulley on its shaft. Each part
 * placed by coordinates instead is named. `checked` is false when the model has none of these parts.
 */
export function looseMovingParts(spec: NoteSceneSpec): { checked: boolean; problems: string[] } {
  const problems: string[] = []
  let checked = false
  const rods = spec.parts.filter((p) => CONROD.test(p.name))
  for (const p of rods) {
    checked = true
    if (p.mount?.kind !== 'link') problems.push(`${p.name} is not linked to the crank`)
  }
  // a piston needs a slider mount when a rod drives it; a hydraulic piston (no crank, no rod) may sit on its cylinder's axis
  if (rods.length) {
    for (const p of spec.parts.filter((x) => PISTON.test(x.name) && !CONROD.test(x.name))) {
      checked = true
      if (p.mount?.kind !== 'slider') problems.push(`${p.name} does not slide on the crank`)
    }
  }
  const hasShaft = spec.parts.some((x) => /shaft|axle|crank|spindle|hub/i.test(x.name))
  for (const p of spec.parts.filter((x) => hasShaft && ON_SHAFT.test(x.name) && !NOT_ON_SHAFT.test(x.name))) {
    checked = true
    if (p.mount?.kind !== 'coaxial' && p.mount?.kind !== 'mesh') problems.push(`${p.name} is not mounted on its shaft`)
  }
  return { checked, problems }
}

const FIXED_IN = /\b(key|set ?screw|grub screw|dowel|circlip|rivet|split pin|cotter)\b/i
const CARRIES = /sleeve|muff|coupling|hub|flange|collar/i

/**
 * Small parts fixed in another part (a key, a setscrew, a dowel) must ride with it, and a sleeve or hub fixed on
 * a shaft must turn with the shaft. A key given a motion of its own spins on the spot at the shaft's centre;
 * a coupling sleeve left still has its shafts turning inside it. `checked` is false when there are none.
 */
export function fixedParts(spec: NoteSceneSpec, scope: Record<string, number>): { checked: boolean; problems: string[] } {
  const problems: string[] = []
  let checked = false
  const kin = buildKinematics(spec, scope)
  const turns = (id: string) => kin.drivers.has(id) || kin.derived.has(id)
  for (const p of spec.parts) {
    if (FIXED_IN.test(p.name)) {
      checked = true
      if (p.motion) problems.push(`${p.name} has a motion of its own: fix it in the part it sits in (its children)`)
      else if (p.mount && turns(p.mount.target) && !turns(p.id)) problems.push(`${p.name} does not turn with ${spec.parts.find((q) => q.id === p.mount!.target)?.name ?? 'its part'}: fix it in that part (its children) or key it on`)
    } else if (CARRIES.test(p.name) && !/shaft|bearing/i.test(p.name) && !turns(p.id) && !p.motion) {
      const inside = spec.parts.filter((q) => q.id !== p.id && turns(q.id) && (q.mount?.target === p.id || p.mount?.target === q.id))
      if (inside.length) {
        checked = true
        problems.push(`${p.name} stands still while ${inside[0].name} turns in it`)
      }
    }
  }
  return { checked, problems }
}

/**
 * Labels drawn on top of each other: each arrow or label's text sits at its tail, about as wide as a line of
 * text and one line high, so two tails closer than that (seen from the front) collide.
 */
export function overlappingLabels(spec: NoteSceneSpec, frames: Map<string, PartFrame>, scope: Record<string, number>): string[] {
  const size = new THREE.Box3()
  for (const f of frames.values()) size.union(f.box)
  const extent = Math.max(0.05, ...size.getSize(new THREE.Vector3()).toArray())
  const spots = (spec.annotations ?? [])
    .filter((a) => a.kind !== 'dimension')
    .map((a) => {
      const at = resolveAnnotation(a, frames, scope)?.from ?? (a.from ? evalVec3(a.from, scope, [0, 0, 0]) : null)
      return at ? { label: a.label, x: at[0], y: at[1] } : null
    })
    .filter((s): s is { label: string; x: number; y: number } => !!s)
  const clashes: string[] = []
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i], b = spots[j]
      if (Math.abs(a.x - b.x) < 0.25 * extent && Math.abs(a.y - b.y) < 0.05 * extent) clashes.push(`“${a.label}” and “${b.label}”`)
    }
  return clashes
}

/**
 * Scores one build against its case, the way the app would see it: the answer is cleaned as the client
 * cleans it, laid out by the assembly solver, and its calculations and charts worked out from the default
 * sizes. Score = the share of checks that pass, 0 to 100.
 */
export function scoreBuild(c: EvalCase, reply: Record<string, unknown>, seconds: number): { score: number; checks: EvalCheck[]; spec: NoteSceneSpec | null } {
  const checks: EvalCheck[] = []
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, ...(detail ? { detail: detail.slice(0, 300) } : {}) })
  // nothing to build: judged as a written answer
  if (c.written) {
    const text = typeof reply.explanation === 'string' ? reply.explanation : ''
    add('written, no model', reply.answerOnly === true && !!text.trim(), reply.answerOnly === true ? undefined : 'a model was built for a problem with nothing physical to show')
    add('equations as maths', /\$[^$\s][^$]*\$/.test(text), 'no equation written in LaTeX')
    add('numbered steps', /^\s*\d+[.)]\s/m.test(text), 'no numbered steps')
    if (c.written.table) add('a table', /^\s*\|.*\|\s*\n\s*\|?\s*:?-{2,}/m.test(text), 'no Markdown table')
    add('under two minutes', seconds <= 120, `${Math.round(seconds)} s`)
    const passed = checks.filter((x) => x.ok).length
    return { score: Math.round((100 * passed) / checks.length), checks, spec: null }
  }
  const spec: NoteSceneSpec | null = sanitizeGeneratedSpec(reply, c.prompt)
  add('builds', !!spec, spec ? undefined : 'the answer could not be turned into a model')
  if (!spec) return { score: 0, checks, spec: null }

  const params = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
  const { results, scope } = evaluateCalculations(spec.calculations, params)
  const raw = (reply.spec ?? reply) as { parts?: { shapes?: unknown[] }[] }
  const rawShapes = (raw.parts ?? []).reduce((n, p) => n + (Array.isArray(p.shapes) ? p.shapes.length : 0), 0)
  const keptShapes = spec.parts.reduce((n, p) => n + p.shapes.length, 0)

  if (c.parts) add('part count', spec.parts.length >= c.parts[0] && spec.parts.length <= c.parts[1], `${spec.parts.length} parts (expected ${c.parts[0]} to ${c.parts[1]})`)
  add('every shape drawable', keptShapes === rawShapes, keptShapes === rawShapes ? undefined : `${rawShapes - keptShapes} of ${rawShapes} shapes dropped`)

  const { issues, frames } = resolveAssembly(spec, scope)
  add('layout', issues.length === 0, issues.map((i) => i.message).join('; ') || undefined)

  const loose = looseMovingParts(spec)
  if (loose.checked) add('moving parts connected', loose.problems.length === 0, loose.problems.join('; ') || undefined)
  const held = heldProblems(spec, scope)
  if (spec.parts.length > 1) add('every part held', held.length === 0, held.join('; ') || undefined)
  const fixed = fixedParts(spec, scope)
  if (fixed.checked) add('fixed parts ride along', fixed.problems.length === 0, fixed.problems.join('; ') || undefined)
  const mech = mechanismProblems(spec, scope, `${c.prompt} ${spec.title ?? ''}`)
  if (mech.checked) add('mechanism moves right', mech.problems.length === 0, mech.problems.join('; ') || undefined)

  const clash = overlappingLabels(spec, frames, scope)
  add('labels clear', clash.length === 0, clash.length ? `${clash.join('; ')} overlap` : undefined)
  if (spec.parts.length >= 3) {
    const mounted = spec.parts.filter((p) => p.mount).length
    add('assembled by relation', mounted >= 0.6 * (spec.parts.length - 1), `${mounted} of ${spec.parts.length - 1} non-anchor parts mounted`)
  }

  const bad = results.filter((r) => r.broken || !Number.isFinite(r.value))
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
  if (c.solve) {
    const steps = spec.calculations ?? []
    const q = spec.question
    const answers = steps.filter((s) => s.answer)
    const ok = !!q && q.find.length > 0 && steps.length >= 2 && steps.every((s) => s.step) && answers.length > 0
    add(
      'solved step by step',
      ok,
      ok ? undefined : !q ? 'not set up as a question' : !q.find.length ? 'what is asked is not listed' : steps.length < 2 ? 'fewer than two steps' : !answers.length ? 'no result marked as the answer' : 'a step has no explanation',
    )
  }
  if (c.symbolic) {
    // a derivation given no numbers: in symbols, every step an equation, any values marked as only illustrative
    const steps = spec.calculations ?? []
    const unmarked = spec.parameters.filter((p) => !/illustrative/i.test(p.label))
    const ok = spec.question?.symbolic === true && steps.length > 0 && steps.every((s) => !!s.latex) && unmarked.length === 0
    add('derived in symbols', ok, ok ? undefined : spec.question?.symbolic !== true ? 'not marked as symbolic' : unmarked.length ? `values presented as given: ${unmarked.map((p) => p.label).join(', ')}` : 'a step has no equation')
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
  return { score: Math.round((100 * passed) / checks.length), checks, spec }
}
