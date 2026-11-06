import * as THREE from 'three'
import { buildPartGeometry } from './builder'
import { evalDim, evalVec3, type AxisDir, type NoteAnnotationSpec, type NotePartSpec, type NoteSceneSpec, type NoteShapeSpec } from './schema'

/**
 * Assembly by relation. A part with a `mount` is placed from its relation to another part (on a shaft,
 * meshing with a gear, sitting on a face, centred in a housing), worked out from both parts' real geometry
 * every time the model is drawn, so mated parts stay together as the sizes change. Then the result is
 * checked for parts left floating or buried in another, so the student (or Gemini) can fix them.
 */

export type Vec3 = [number, number, number]
export interface Placement {
  position: Vec3
  /** Euler angles, XYZ order, as the renderer takes them */
  rotation: Vec3
}
/** a placed part in world space: what arrows and dimensions attach to */
export interface PartFrame {
  box: THREE.Box3
  center: THREE.Vector3
  /** its own axis, pointing the low-to-high way */
  axis: THREE.Vector3
  length: number
}

export interface AssemblyIssue {
  partId: string
  kind: 'floating' | 'buried' | 'missing-target' | 'cycle'
  message: string
}

/** shapes that turn about their own axis (local Y before the shape's rotation) */
const ROUND = new Set(['cylinder', 'tube', 'cone', 'gear', 'bevelGear', 'pulley', 'sprocket', 'spring', 'hexNut', 'hexBolt', 'torus'])
const GEARS = new Set(['gear', 'bevelGear', 'sprocket'])

interface LocalInfo {
  box: THREE.Box3
  center: THREE.Vector3
  /** the part's own axis in its local frame */
  axis: THREE.Vector3
  /** extent along that axis */
  length: number
  /** gear pitch radius (or pulley radius), 0 when it has none */
  pitchR: number
}

const cache = new Map<string, LocalInfo>()

function shapeAxis(sh: NoteShapeSpec, scope: Record<string, number>) {
  const r = evalVec3(sh.rotation, scope, [0, 0, 0])
  return new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')).normalize()
}

function localInfo(part: NotePartSpec, scope: Record<string, number>): LocalInfo {
  const key = JSON.stringify([part.shapes, scope])
  const hit = cache.get(key)
  if (hit) return hit
  const geom = buildPartGeometry(part.shapes, scope)
  geom.computeBoundingBox()
  const box = geom.boundingBox?.clone() ?? new THREE.Box3(new THREE.Vector3(-0.02, -0.02, -0.02), new THREE.Vector3(0.02, 0.02, 0.02))
  geom.dispose()
  const size = box.getSize(new THREE.Vector3())
  const adds = part.shapes.filter((s) => s.op !== 'subtract')
  // the axis: a gear's if there is one, else the main round shape's, else the longest side
  const lead = adds.find((s) => GEARS.has(s.kind)) ?? adds.find((s) => ROUND.has(s.kind))
  const axis = lead
    ? shapeAxis(lead, scope)
    : size.x >= size.y && size.x >= size.z
      ? new THREE.Vector3(1, 0, 0)
      : size.y >= size.z
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const length = Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z
  const gear = adds.find((s) => GEARS.has(s.kind))
  const pulley = adds.find((s) => s.kind === 'pulley')
  const pitchR = gear
    ? (Math.max(6, Math.round(evalDim(gear.teeth, scope, 20))) * evalDim(gear.module, scope, 0.004)) / 2
    : pulley
      ? evalDim(pulley.rOuter ?? pulley.r, scope, 0.06)
      : 0
  const info = { box, center: box.getCenter(new THREE.Vector3()), axis, length, pitchR }
  if (cache.size > 200) cache.clear()
  cache.set(key, info)
  return info
}

const DIRS: Record<AxisDir, Vec3> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+y': [0, 1, 0], '-y': [0, -1, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] }

/** the axis-aligned box of a local box once rotated (and moved) */
function worldBox(box: THREE.Box3, quat: THREE.Quaternion, pos = new THREE.Vector3()) {
  const out = new THREE.Box3()
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(quat).add(pos))
  return out
}

/** turns `from` onto `to`, keeping a part that is already lined up (either way round) as it is */
function alignment(from: THREE.Vector3, to: THREE.Vector3) {
  const d = from.dot(to)
  if (d > 0.9999) return new THREE.Quaternion()
  if (d < -0.9999) return new THREE.Quaternion() // reversed along the same line: the same fit for a round part
  return new THREE.Quaternion().setFromUnitVectors(from, to)
}

/** one way round for every axis: low to high (left to right, bottom to top, back to front) */
function canonical(v: THREE.Vector3) {
  const big = Math.abs(v.x) >= Math.abs(v.y) && Math.abs(v.x) >= Math.abs(v.z) ? v.x : Math.abs(v.y) >= Math.abs(v.z) ? v.y : v.z
  return big < 0 ? v.negate() : v
}

/** the crank's centre, its axis, and the direction the slider runs (square to the axis) */
function crankFrame(ti: LocalInfo, T: { pos: THREE.Vector3; quat: THREE.Quaternion }, direction?: AxisDir) {
  const center = ti.center.clone().applyQuaternion(T.quat).add(T.pos)
  const axis = canonical(ti.axis.clone().applyQuaternion(T.quat).normalize())
  let slide = new THREE.Vector3(...DIRS[direction ?? '+y'])
  slide.addScaledVector(axis, -slide.dot(axis))
  if (slide.lengthSq() < 1e-6) slide = new THREE.Vector3(0, 0, 1).addScaledVector(axis, -axis.z)
  slide.normalize()
  const across = new THREE.Vector3().crossVectors(axis, slide).normalize()
  return { center, axis, slide, across }
}

export function resolveAssembly(
  spec: Pick<NoteSceneSpec, 'parts'> | null,
  scope: Record<string, number>,
): { placements: Map<string, Placement>; issues: AssemblyIssue[]; frames: Map<string, PartFrame> } {
  const placements = new Map<string, Placement>()
  const issues: AssemblyIssue[] = []
  const frames = new Map<string, PartFrame>()
  if (!spec?.parts?.length) return { placements, issues, frames }
  const byId = new Map(spec.parts.map((p) => [p.id, p]))
  const done = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>()
  const visiting = new Set<string>()

  const base = (p: NotePartSpec) => {
    const r = evalVec3(p.rotation, scope, [0, 0, 0])
    return { pos: new THREE.Vector3(...evalVec3(p.position, scope, [0, 0, 0])), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')) }
  }

  const place = (p: NotePartSpec) => {
    if (done.has(p.id)) return
    const m = p.mount
    const target = m ? byId.get(m.target) : undefined
    if (!m) return void done.set(p.id, base(p))
    if (!target || target === p) {
      issues.push({ partId: p.id, kind: 'missing-target', message: `${p.name} is mounted on "${m.target}", which is not a part of this model` })
      return void done.set(p.id, base(p))
    }
    if (visiting.has(p.id)) {
      issues.push({ partId: p.id, kind: 'cycle', message: `${p.name} and ${target.name} are each placed relative to the other` })
      return void done.set(p.id, base(p))
    }
    visiting.add(p.id)
    place(target)
    visiting.delete(p.id)

    const T = done.get(target.id)!
    const ti = localInfo(target, scope)
    const si = localInfo(p, scope)
    // `at` runs from the low end to the high end, whichever way the shape happens to point
    const tAxis = canonical(ti.axis.clone().applyQuaternion(T.quat).normalize())
    const tCenter = ti.center.clone().applyQuaternion(T.quat).add(T.pos)
    let quat = base(p).quat
    let point = tCenter.clone()

    if (m.kind === 'coaxial') {
      quat = alignment(si.axis, tAxis)
      const at = Math.min(1, Math.max(0, evalDim(m.at, scope, 0.5)))
      point = tCenter.clone().addScaledVector(tAxis, (at - 0.5) * ti.length + evalDim(m.offset, scope, 0))
    } else if (m.kind === 'mesh') {
      quat = alignment(si.axis, tAxis)
      const up = new THREE.Vector3(0, 1, 0)
      let side = m.side ? new THREE.Vector3(...DIRS[m.side]) : Math.abs(tAxis.dot(up)) > 0.9 ? new THREE.Vector3(0, 0, 1) : up
      side = side.clone().addScaledVector(tAxis, -side.dot(tAxis))
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0).addScaledVector(tAxis, -tAxis.x)
      side.normalize()
      // no gear data: fall back to the parts' sizes across the axis
      const radial = (i: LocalInfo) => i.pitchR || Math.max(...i.box.getSize(new THREE.Vector3()).toArray()) / 2
      point = tCenter.clone().addScaledVector(side, radial(si) + radial(ti))
    } else if (m.kind === 'slider') {
      // piston position for crank radius r, rod length l, crank angle θ from top dead centre
      const { center, slide } = crankFrame(ti, T, m.direction)
      const r = evalDim(m.throw, scope, 0.04)
      const l = Math.max(r * 1.05, evalDim(m.rod, scope, 0.15))
      const th = (evalDim(m.angle, scope, 0) * Math.PI) / 180
      point = center.clone().addScaledVector(slide, r * Math.cos(th) + Math.sqrt(l * l - r * r * Math.sin(th) ** 2))
    } else if (m.kind === 'link') {
      // a connecting rod from the crank pin to the centre of the part it drives
      const toPart = byId.get(m.to)
      if (!toPart || toPart === p) {
        issues.push({ partId: p.id, kind: 'missing-target', message: `${p.name} links to "${m.to}", which is not a part of this model` })
        return void done.set(p.id, base(p))
      }
      visiting.add(p.id)
      place(toPart)
      visiting.delete(p.id)
      const { center, slide, across } = crankFrame(ti, T, m.direction)
      const r = evalDim(m.throw, scope, 0.04)
      const th = (evalDim(m.angle, scope, 0) * Math.PI) / 180
      const pin = center.clone().addScaledVector(slide, r * Math.cos(th)).addScaledVector(across, r * Math.sin(th))
      const D = done.get(toPart.id)!
      const end = localInfo(toPart, scope).center.clone().applyQuaternion(D.quat).add(D.pos)
      const line = end.clone().sub(pin)
      // a link lines up by its length (a rod's eyes are round but point across it, so not by its round parts)
      const size = si.box.getSize(new THREE.Vector3())
      const long = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
      if (line.lengthSq() > 1e-9) quat = alignment(long, line.clone().normalize())
      point = pin.clone().add(end).multiplyScalar(0.5)
    } else if (m.kind === 'against') {
      const tb = worldBox(ti.box, T.quat, T.pos)
      const sb = worldBox(si.box, quat)
      const sc = sb.getCenter(new THREE.Vector3())
      const n = DIRS[m.face]
      const k = n[0] ? 0 : n[1] ? 1 : 2
      const pos = tCenter.clone().sub(sc)
      const sign = n[k]
      pos.setComponent(k, sign > 0 ? tb.max.getComponent(k) - sb.min.getComponent(k) : tb.min.getComponent(k) - sb.max.getComponent(k))
      const shift = new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0]))
      done.set(p.id, { pos: pos.add(shift), quat })
      return
    }
    // put the part's own centre on the point
    const pos = point.sub(si.center.clone().applyQuaternion(quat)).add(new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0])))
    done.set(p.id, { pos, quat })
  }

  for (const p of spec.parts) place(p)
  for (const p of spec.parts) {
    const d = done.get(p.id)!
    const e = new THREE.Euler().setFromQuaternion(d.quat, 'XYZ')
    placements.set(p.id, { position: [d.pos.x, d.pos.y, d.pos.z], rotation: [e.x, e.y, e.z] })
    const li = localInfo(p, scope)
    frames.set(p.id, {
      box: worldBox(li.box, d.quat, d.pos),
      center: li.center.clone().applyQuaternion(d.quat).add(d.pos),
      axis: canonical(li.axis.clone().applyQuaternion(d.quat).normalize()),
      length: li.length,
    })
  }

  // checks: floating and buried parts
  if (spec.parts.length > 1) {
    const boxes = spec.parts.map((p) => {
      const d = done.get(p.id)!
      return { p, box: worldBox(localInfo(p, scope).box, d.quat, d.pos) }
    })
    const vol = (b: THREE.Box3) => {
      const s = b.getSize(new THREE.Vector3())
      return Math.max(1e-12, s.x * s.y * s.z)
    }
    const linked = (a: NotePartSpec, b: NotePartSpec) => (a.mount?.target === b.id && a.mount.kind !== 'against') || (a.mount?.kind === 'link' && a.mount.to === b.id)
    const related = (a: NotePartSpec, b: NotePartSpec) => linked(a, b) || linked(b, a)
    for (const { p, box } of boxes) {
      const size = box.getSize(new THREE.Vector3()).length()
      const tol = 0.004 + size * 0.02
      const touching = boxes.some((o) => o.p !== p && o.box.clone().expandByScalar(tol).intersectsBox(box))
      if (!touching) issues.push({ partId: p.id, kind: 'floating', message: `${p.name} is floating: it does not touch any other part` })
      if (p.role === 'housing') continue
      for (const o of boxes) {
        if (o.p === p || o.p.role === 'housing' || related(p, o.p)) continue
        const overlap = box.clone().intersect(o.box)
        if (overlap.isEmpty()) continue
        if (vol(overlap) / vol(box) > 0.6 && vol(box) < vol(o.box)) {
          issues.push({ partId: p.id, kind: 'buried', message: `${p.name} is buried inside ${o.p.name}` })
          break
        }
      }
    }
  }
  return { placements, issues, frames }
}

/**
 * Where an arrow or dimension attached to a part goes, from the part's frame: a force ends on the point and
 * acts along its direction; a moment turns about the part's axis; a dimension spans the part's length,
 * drawn just below it. Null when it is not attached (its own from / to stand).
 */
export function resolveAnnotation(ann: NoteAnnotationSpec, frames: Map<string, PartFrame>, scope: Record<string, number>): { from: Vec3; to: Vec3 } | null {
  const a = ann.anchor
  const fr = a ? frames.get(a.part) : undefined
  if (!a || !fr) return null
  const at = a.at ?? 'center'
  const point = fr.center.clone()
  // where along the part (along, or its start / end), then which face (both may be given: "on top, at the far end")
  if (a.along !== undefined) point.addScaledVector(fr.axis, (Math.min(1, Math.max(0, evalDim(a.along, scope, 0.5))) - 0.5) * fr.length)
  else if (at === 'start' || at === 'end') point.addScaledVector(fr.axis, (at === 'start' ? -0.5 : 0.5) * fr.length)
  if (at !== 'center' && at !== 'start' && at !== 'end') {
    const n = DIRS[at]
    const k = n[0] ? 0 : n[1] ? 1 : 2
    point.setComponent(k, n[k] > 0 ? fr.box.max.getComponent(k) : fr.box.min.getComponent(k))
  }
  const v = (x: THREE.Vector3): Vec3 => [x.x, x.y, x.z]
  if (ann.kind === 'force') {
    const dir = new THREE.Vector3(...DIRS[ann.direction ?? '-y'])
    const len = Math.max(0.02, evalDim(ann.length, scope, 0.12))
    return { from: v(point.clone().addScaledVector(dir, -len)), to: v(point) }
  }
  if (ann.kind === 'moment') {
    const axis = ann.direction ? new THREE.Vector3(...DIRS[ann.direction]) : fr.axis
    return { from: v(point), to: v(point.clone().addScaledVector(axis, 0.08)) }
  }
  if (ann.kind === 'dimension') {
    const size = fr.box.getSize(new THREE.Vector3())
    const vertical = Math.abs(fr.axis.y) > 0.9
    const off = vertical ? new THREE.Vector3(size.x / 2 + 0.03, 0, 0) : new THREE.Vector3(0, -(size.y / 2 + 0.03), 0)
    return { from: v(fr.center.clone().addScaledVector(fr.axis, -fr.length / 2).add(off)), to: v(fr.center.clone().addScaledVector(fr.axis, fr.length / 2).add(off)) }
  }
  return { from: v(point), to: v(point.clone().add(new THREE.Vector3(0, 0.06, 0))) }
}
