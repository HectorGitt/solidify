import * as THREE from 'three'
import { GEARS, partInfo, resolveAssembly } from './assembly'
import { buildPartGeometry } from './builder'
import type { NotePartSpec, NoteSceneSpec, NoteShapeSpec } from './schema'

/**
 * Checks that match the eye, on a model at rest. The layout check in the assembly compares each part's whole
 * bounding box with its neighbours', which passes things a person sees at once: a gear and its shaft floating
 * together above the base (they touch each other), a worm wheel standing outside its gearbox, two gears whose
 * teeth run through each other. These look at the shapes a part is made of, and at the model as one assembly:
 *
 * - every part is held: joined to the rest by real contact, shape against shape, all the way to the main body;
 * - gears and worms sit inside the gearbox that is drawn round them;
 * - gears on parallel shafts in one plane are a proper centre distance apart: neither cutting into each other
 *   nor just short of touching.
 */

const boxCache = new Map<string, THREE.Box3>()
/** the box of one shape in its part's frame (its own position, rotation and circular pattern applied) */
function shapeBox(sh: NoteShapeSpec, scope: Record<string, number>): THREE.Box3 {
  const key = JSON.stringify([sh, scope])
  const hit = boxCache.get(key)
  if (hit) return hit
  const g = buildPartGeometry([{ ...sh, op: 'add' }], scope)
  g.computeBoundingBox()
  const box = g.boundingBox?.clone() ?? new THREE.Box3()
  g.dispose()
  if (boxCache.size > 600) boxCache.clear()
  boxCache.set(key, box)
  return box
}

function toWorld(box: THREE.Box3, quat: THREE.Quaternion, pos: THREE.Vector3) {
  const out = new THREE.Box3()
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(quat).add(pos))
  return out
}

const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

const GEARBOX = /gear ?box|gear ?case|housing|casing|crank ?case/i
const NOT_A_GEARBOX = /bearing|pedestal|hub|pump|motor|carrier/i

export function heldProblems(spec: Pick<NoteSceneSpec, 'parts'>, scope: Record<string, number>): string[] {
  const parts = (spec.parts ?? []).filter((p) => p.role !== 'fluid')
  if (parts.length < 2) return []
  const problems: string[] = []
  let poses: Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>
  try {
    poses = resolveAssembly(spec, scope, { checks: false }).poses
  } catch {
    return []
  }
  const solid = (p: NotePartSpec) => p.shapes.filter((s) => s.op !== 'subtract' && s.op !== 'intersect')
  const placed = parts
    .filter((p) => poses.has(p.id))
    .map((p) => {
      const d = poses.get(p.id)!
      const boxes = solid(p).map((s) => toWorld(shapeBox(s, scope), d.quat, d.pos))
      const whole = boxes.reduce((b, x) => b.union(x), new THREE.Box3())
      const size = whole.getSize(new THREE.Vector3())
      return { p, boxes, whole, big: Math.max(size.x, size.y, size.z), volume: Math.max(1e-12, size.x * size.y * size.z) }
    })
    .filter((x) => x.boxes.length)

  // --- every part held: shapes in contact, joined all the way to the main body ---
  const group = placed.map((_, i) => i)
  const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])))
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      // a small gap still reads as touching (a bearing's clearance, a tooth's backlash); scaled to the smaller part
      const tol = Math.max(0.0025, 0.03 * Math.min(a.big, b.big))
      if (!a.whole.clone().expandByScalar(tol).intersectsBox(b.whole)) continue
      if (a.boxes.some((x) => b.boxes.some((y) => x.clone().expandByScalar(tol).intersectsBox(y)))) group[find(i)] = find(j)
    }
  }
  const groups = new Map<number, typeof placed>()
  placed.forEach((x, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), x]))
  if (groups.size > 1) {
    const sorted = [...groups.values()].sort((a, b) => b.reduce((t, x) => t + x.volume, 0) - a.reduce((t, x) => t + x.volume, 0))
    const main = sorted[0]
    const anchor = main.find((x) => !x.p.mount) ?? main[0]
    for (const g of sorted.slice(1)) {
      const names = g.map((x) => x.p.name)
      problems.push(`${list(names)} ${names.length === 1 ? 'is' : 'are'} not held by anything: nothing joins ${names.length === 1 ? 'it' : 'them'} to ${anchor.p.name}`)
    }
  }

  // --- fixed parts held by fixed parts: a bearing block or pedestal that only hangs on a turning shaft is in mid-air ---
  const still = placed.map((x, i) => ({ x, i })).filter(({ x }) => (x.p.role === 'static' || x.p.role === 'housing') && !x.p.motion)
  if (still.length > 1 && groups.size === 1) {
    const g2 = still.map((_, k) => k)
    const f2 = (k: number): number => (g2[k] === k ? k : (g2[k] = f2(g2[k])))
    for (let a = 0; a < still.length; a++) {
      for (let b = a + 1; b < still.length; b++) {
        const A = still[a].x
        const B = still[b].x
        const tol = Math.max(0.0025, 0.03 * Math.min(A.big, B.big))
        if (A.boxes.some((x) => B.boxes.some((y) => x.clone().expandByScalar(tol).intersectsBox(y)))) g2[f2(a)] = f2(b)
      }
    }
    const sets = new Map<number, typeof placed>()
    still.forEach(({ x }, k) => sets.set(f2(k), [...(sets.get(f2(k)) ?? []), x]))
    if (sets.size > 1) {
      const sorted = [...sets.values()].sort((a, b) => b.reduce((t, x) => t + x.volume, 0) - a.reduce((t, x) => t + x.volume, 0))
      const ground = sorted[0].find((x) => !x.p.mount) ?? sorted[0][0]
      for (const g of sorted.slice(1)) {
        const names = g.map((x) => x.p.name)
        problems.push(`${list(names)} ${names.length === 1 ? 'is' : 'are'} fixed to nothing: ${names.length === 1 ? 'it only hangs' : 'they only hang'} on moving parts, not joined to ${ground.p.name}`)
      }
    }
  }

  // --- gears and worms inside the gearbox drawn round them ---
  const hollow = (p: NotePartSpec) => p.shapes.some((s) => s.op === 'subtract')
  const gearish = (p: NotePartSpec) => solid(p).some((s) => GEARS.has(s.kind)) || /\bworm\b/i.test(p.name)
  for (const h of placed.filter((x) => x.p.role === 'housing' && hollow(x.p) && GEARBOX.test(x.p.name) && !NOT_A_GEARBOX.test(x.p.name))) {
    const room = h.whole.clone().expandByScalar(0.05 * h.big)
    for (const g of placed) {
      if (g === h || !gearish(g.p) || /shaft/i.test(g.p.name)) continue
      if (!room.containsPoint(g.whole.getCenter(new THREE.Vector3()))) problems.push(`${g.p.name} is outside ${h.p.name}`)
    }
  }

  // --- gears on parallel shafts in one plane: a proper centre distance apart ---
  const gears = placed
    .map((x) => {
      const info = partInfo(x.p, scope)
      const d = poses.get(x.p.id)!
      return { ...x, r: info.pitchR, len: info.length, hollow: info.hollow, axis: info.axis.clone().applyQuaternion(d.quat).normalize(), center: info.center.clone().applyQuaternion(d.quat).add(d.pos), isGear: solid(x.p).some((s) => GEARS.has(s.kind)) }
    })
    .filter((g) => g.isGear && g.r > 0)
  for (let i = 0; i < gears.length; i++) {
    for (let j = i + 1; j < gears.length; j++) {
      const a = gears[i]
      const b = gears[j]
      if (Math.abs(a.axis.dot(b.axis)) < 0.995) continue
      const d = b.center.clone().sub(a.center)
      const along = Math.abs(d.dot(a.axis))
      if (along > (a.len + b.len) / 2) continue
      const apart = d.addScaledVector(a.axis, -d.dot(a.axis)).length()
      const want = a.r + b.r
      // on one axis (a cluster gear), or one inside the other (a ring gear and its planet): not this check
      if (apart < 1e-3 || apart < Math.max(a.r, b.r)) continue
      const mm = (v: number) => `${(v * 1000).toFixed(0)} mm`
      if (apart < 0.93 * want) problems.push(`the teeth of ${a.p.name} and ${b.p.name} cut into each other (centres ${mm(apart)} apart, their pitch radii add to ${mm(want)})`)
      else if (apart > 1.05 * want && apart < 1.22 * want) problems.push(`${a.p.name} and ${b.p.name} do not reach each other (centres ${mm(apart)} apart, their pitch radii add to ${mm(want)})`)
    }
  }
  return [...new Set(problems)]
}
