import * as THREE from 'three'
import { resolveAnnotation, resolveAssembly, type PartFrame } from './assembly'
import { evalDim, evaluateCalculations, type NoteAnnotationSpec, type NoteSceneSpec } from './schema'

/**
 * Checks a model's load arrows the way an engineer reads them: each is drawn at all (its part exists among the
 * parts that are placed), its value is a number, it touches its part rather than ending buried in its middle,
 * and it acts the way its name says: an axial or thrust force along the part's axis, a radial one across it, a
 * tangential one across both the axis and the radius, a reaction against the load it carries, and a moment
 * about the axis the part turns or bends about (never about a beam's own length).
 */

const DIRS: Record<string, THREE.Vector3> = { '+x': new THREE.Vector3(1, 0, 0), '-x': new THREE.Vector3(-1, 0, 0), '+y': new THREE.Vector3(0, 1, 0), '-y': new THREE.Vector3(0, -1, 0), '+z': new THREE.Vector3(0, 0, 1), '-z': new THREE.Vector3(0, 0, -1) }

const words = (a: NoteAnnotationSpec) => `${a.label} ${a.id}`.replace(/[_{}]/g, ' ')
const AXIAL = /\b(F ?a\d?|axial|thrust)\b/i
const RADIAL = /\b(F ?r\d?|radial)\b/i
const TANGENTIAL = /\b(F ?t\d?|tangential)\b/i
const REACTION = /^(R|reaction)/i

export function annotationProblems(spec: Pick<NoteSceneSpec, 'parts' | 'annotations' | 'calculations' | 'parameters'>): string[] {
  const out: string[] = []
  const anns = spec.annotations ?? []
  if (!anns.length) return out
  const params = Object.fromEntries((spec.parameters ?? []).map((p) => [p.id, p.value]))
  const { scope } = evaluateCalculations(spec.calculations ?? [], params)
  let frames: Map<string, PartFrame>
  try {
    frames = resolveAssembly(spec, scope, { checks: false }).frames
  } catch {
    return out
  }
  const children = new Set<string>()
  const walk = (list: NoteSceneSpec['parts']) => list.forEach((p) => (p.children?.length ? (p.children.forEach((c) => children.add(c.id)), walk(p.children)) : null))
  walk(spec.parts ?? [])
  const loads = anns.filter((a) => a.kind === 'force')
  // the main applied load: the biggest force that is not a reaction
  const applied = loads.filter((a) => !REACTION.test(a.label)).sort((a, b) => Math.abs(evalDim(b.magnitude, scope, 0)) - Math.abs(evalDim(a.magnitude, scope, 0)))[0]

  for (const a of anns) {
    const name = `"${a.label}"`
    if (a.kind !== 'force' && a.kind !== 'moment') continue
    if (a.magnitude !== undefined && !Number.isFinite(evalDim(a.magnitude, scope, NaN))) out.push(`${name} has no value: its magnitude does not work out to a number`)
    if (!a.anchor) continue
    const fr = frames.get(a.anchor.part)
    if (!fr) {
      out.push(`${name} is not drawn: it is attached to "${a.anchor.part}", ${children.has(a.anchor.part) ? 'a part carried inside another (attach it to that part)' : 'which is not a part of this model'}`)
      continue
    }
    const at = a.anchor.at ?? 'center'
    if (a.kind === 'force') {
      const dir = DIRS[a.direction ?? '-y']
      const w = words(a)
      const ax = fr.axis
      if (at === 'center' && a.anchor.along === undefined) out.push(`${name} ends in the middle of its part, hidden inside it: attach it to a face`)
      else {
        const r = resolveAnnotation(a, frames, scope)
        const inner = fr.box.clone().expandByScalar(-0.002)
        if (r && !inner.isEmpty() && inner.containsPoint(new THREE.Vector3(...r.from).lerp(new THREE.Vector3(...r.to), 0.5))) out.push(`${name} is drawn through its part`)
      }
      if (AXIAL.test(w) && Math.abs(dir.dot(ax)) < 0.9) out.push(`${name} is an axial force but does not act along the part's axis`)
      if (RADIAL.test(w) && Math.abs(dir.dot(ax)) > 0.1) out.push(`${name} is a radial force but acts along the part's axis`)
      if (TANGENTIAL.test(w)) {
        if (Math.abs(dir.dot(ax)) > 0.1) out.push(`${name} is a tangential force but acts along the part's axis`)
        else {
          const r = resolveAnnotation(a, frames, scope)
          if (r) {
            const tip = new THREE.Vector3(...r.to).sub(fr.center)
            tip.addScaledVector(ax, -tip.dot(ax))
            if (tip.length() > 1e-4 && Math.abs(tip.normalize().dot(dir)) > 0.5) out.push(`${name} is a tangential force but points along the radius (towards or away from the centre)`)
          }
        }
      }
      if (REACTION.test(a.label) && applied && applied !== a) {
        const ad = DIRS[applied.direction ?? '-y']
        if (dir.dot(ad) > 0.5) out.push(`${name} is a reaction but acts the same way as the load ${`"${applied.label}"`}`)
      }
    } else {
      // a moment turns about the part's axis, or the direction given; a beam bends about an axis across it
      const axis = a.direction ? DIRS[a.direction] : fr.axis
      const size = fr.box.getSize(new THREE.Vector3())
      const long = Math.max(size.x, size.y, size.z)
      const along = Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z
      const bending = /\b(M|moment|bending)\b/i.test(words(a)) && !/\b(T|torque|twist)\b/i.test(words(a))
      if (bending && along > 0.9 * long && long > 3 * Math.min(size.x, size.y, size.z)) out.push(`${name} is a bending moment but turns about the member's own length: give it a direction across the member`)
    }
  }
  return [...new Set(out)]
}
