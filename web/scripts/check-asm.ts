// prints where each part of a source model ends up, and the layout problems the app finds
import fs from 'node:fs'
import { sanitizeGeneratedSpec } from '../src/note3d/sanitize'
import { fromSlfy } from '../src/note3d/slfyFormat'
import { resolveAssembly } from '../src/note3d/assembly'
import { evaluateCalculations } from '../src/note3d/schema'
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const read = fromSlfy(raw)
if (!read.ok) throw new Error(read.error)
const spec = sanitizeGeneratedSpec(read.spec, read.title)!
const params = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
const { scope } = evaluateCalculations(spec.calculations, params)
const res = resolveAssembly(spec, scope)
const f = (n: number) => n.toFixed(3)
for (const p of spec.parts) {
  const b = res.frames.get(p.id)!.box
  console.log(p.id.padEnd(22), `x ${f(b.min.x)}..${f(b.max.x)}  y ${f(b.min.y)}..${f(b.max.y)}  z ${f(b.min.z)}..${f(b.max.z)}`, p.mount ? JSON.stringify(p.mount) : `pos ${JSON.stringify(p.position)}`)
}
console.log('ISSUES:', res.issues.length ? '\n  ' + res.issues.map((i) => i.message).join('\n  ') : 'none')
