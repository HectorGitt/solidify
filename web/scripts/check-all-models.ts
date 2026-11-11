// runs every saved model (admin drafts and library, dumped to a folder) through the layout and motion checks
import fs from 'node:fs'
import path from 'node:path'
import { sanitizeGeneratedSpec } from '../src/note3d/sanitize'
import { resolveAssembly } from '../src/note3d/assembly'
import { buildKinematics, mechanismProblems, playbackPace } from '../src/note3d/kinematics'
import { fixedParts } from '../src/evals/score'
import { heldProblems } from '../src/note3d/held'
import { evalDim, evaluateCalculations, type NotePartSpec } from '../src/note3d/schema'
const dir = process.argv[2]
const tally: Record<string, string[]> = {}
const note = (k: string, t: string) => (tally[k] ??= []).push(t)
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const spec = sanitizeGeneratedSpec(d.spec, d.title)
  if (!spec) { console.log(f, 'UNDRAWABLE'); continue }
  const params = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
  const { scope } = evaluateCalculations(spec.calculations, params)
  const res = resolveAssembly(spec, scope)
  const kin = buildKinematics(spec, scope)
  const mech = mechanismProblems(spec, scope)
  const all: NotePartSpec[] = []
  const walk = (l: NotePartSpec[]) => l.forEach((p) => { all.push(p); walk(p.children ?? []) })
  walk(spec.parts)
  const motions = all.filter((p) => p.motion)
  const fastest = Math.max(0, ...motions.map((p) => Math.abs(evalDim(p.motion!.speed, scope, 1)) * (p.motion!.kind === 'rotate' ? 1 : 2 * Math.PI)))
  const flags: string[] = []
  const tag = `${d.col === 'library' ? 'LIB' : 'draft'} ${d.title}`
  if (res.issues.length) { flags.push(`layout: ${res.issues.map((i) => i.message).join('; ')}`); note(res.issues.some((i) => i.kind === 'floating') ? 'floating parts' : 'buried parts', tag) }
  if (mech.problems.length) { flags.push(`motion: ${mech.problems.join('; ')}`); note('mechanism not driven by mounts', tag) }
  if (fastest > 12) { flags.push(`too fast to see: ${fastest.toFixed(0)} rad/s (now played at ${(fastest * playbackPace(spec.parts, scope)).toFixed(1)})`); note('real speed too fast for the screen', tag) }
  const hp = heldProblems(spec, scope)
  if (hp.length) { flags.push(`held: ${hp.join('; ')}`); note('parts not held, outside their gearbox, or gears at the wrong distance', tag) }
  const fx = fixedParts(spec, scope)
  if (fx.problems.length) { flags.push(`fixed parts: ${fx.problems.join('; ')}`); note('keys/sleeves that do not ride with their part', tag) }
  const extra = motions.filter((p) => kin.derived.has(p.id))
  if (extra.length) { flags.push(`own motion ignored on ${extra.length} mounted part(s)`); note('motion written on mounted parts', tag) }
  const osc = motions.filter((p) => p.motion!.kind !== 'rotate' && !kin.derived.has(p.id))
  if (osc.length) { flags.push(`animated by oscillate/translate: ${osc.map((p) => p.name).join(', ')}`); note('oscillate/translate instead of a linkage mount', tag) }
  const axial = all.filter((p) => p.mount?.kind === 'coaxial' && p.mount.shift && /key|screw|pin|bolt|stud/i.test(p.name) && !p.motion && kin.drivers.size > 0)
  if (axial.length) { flags.push(`fixed to a turning part by a shifted mount, not as a child: ${axial.map((p) => p.name).join(', ')}`); note('keys/pins/screws mounted with a shift instead of as children', tag) }
  const ag = all.filter((p) => p.mount?.kind === 'against' && p.mount.shift && (p.mount.shift as unknown[]).some((v) => typeof v === 'string' || Math.abs(Number(v)) > 0.03))
  if (ag.length) { flags.push(`placed by "against" plus a large shift: ${ag.map((p) => p.name).join(', ')}`); note('"against" with a large hand shift (really coordinates)', tag) }
  const tex = spec.annotations.filter((a) => a.label.includes('{') || a.label.includes(String.fromCharCode(92)))
  if (tex.length) { flags.push(`LaTeX in a 3D label: ${tex.map((a) => a.label).join(', ')}`); note('LaTeX in 3D labels', tag) }
  console.log(`\n${tag}  [score ${d.score}, ${all.length} parts]${flags.length ? '' : '  OK'}`)
  for (const x of flags) console.log('   - ' + x)
}
console.log('\n===== TALLY =====')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1].length - a[1].length)) console.log(`${v.length}  ${k}`)
