import * as THREE from 'three'
import { bevelSize, buildPartGeometry, rackModule } from './builder'
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
export const ROUND = new Set(['cylinder', 'tube', 'cone', 'gear', 'bevelGear', 'pulley', 'sprocket', 'spring', 'hexNut', 'hexBolt', 'torus', 'bearing', 'worm'])
export const GEARS = new Set(['gear', 'bevelGear', 'sprocket'])

export interface LocalInfo {
  box: THREE.Box3
  center: THREE.Vector3
  /** the part's own axis in its local frame */
  axis: THREE.Vector3
  /** extent along that axis */
  length: number
  /** the axis comes from a round shape or a gear, not just the longest side */
  round: boolean
  /** a ring, tube or bored part: others sit inside it by design (a ring gear round its planets) */
  hollow: boolean
  /** gear pitch radius (or pulley radius), 0 when it has none */
  pitchR: number
  /**
   * The middle of the part's axis: on the line of its main round shape (not the middle of its whole box, which
   * a base plate, a pedestal or a crank pin pulls off that line), half way along the round shapes on that line.
   * A frame's bearing boss, a crank's shaft and disc. What "coaxial" lines up. The box centre when nothing is round.
   */
  axisCenter: THREE.Vector3
  /** the extent, along the axis, of the round shapes on that line (the whole part when nothing is round) */
  axisLength: number
}

const cache = new Map<string, LocalInfo>()

function shapeAxis(sh: NoteShapeSpec, scope: Record<string, number>) {
  const r = evalVec3(sh.rotation, scope, [0, 0, 0])
  return new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')).normalize()
}

/** a part's own frame: its box, centre, axis, length, pitch radius; what the motion is worked out from */
/** a part's shape by its feature name (its children's too) */
function featureOf(part: NotePartSpec, name: string): NoteShapeSpec | undefined {
  const want = name.trim().toLowerCase()
  return part.shapes.find((s) => s.name?.trim().toLowerCase() === want)
}

/** a shape's own frame in its part: centre, axis (its Y, turned), length along that axis, turn and local box */
function shapeFrame(s: NoteShapeSpec, scope: Record<string, number>) {
  const r = evalVec3(s.rotation, scope, [0, 0, 0])
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ'))
  const g = buildPartGeometry([{ ...s, position: undefined, rotation: undefined, op: 'add' }], scope)
  g.computeBoundingBox()
  const box = g.boundingBox?.clone() ?? new THREE.Box3(new THREE.Vector3(-0.01, -0.01, -0.01), new THREE.Vector3(0.01, 0.01, 0.01))
  g.dispose()
  const centre = new THREE.Vector3(...evalVec3(s.position, scope, [0, 0, 0])).add(box.getCenter(new THREE.Vector3()).applyQuaternion(quat))
  return { centre, axis: new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize(), length: box.max.y - box.min.y, quat, box }
}

/** a part's bevel gear shape, if it is one */
const bevelOf = (p: NotePartSpec) => p.shapes.find((s) => s.kind === 'bevelGear' && s.op !== 'subtract')
/** a part's worm shape, if it is one */
const wormOf = (p: NotePartSpec) => p.shapes.find((s) => s.kind === 'worm' && s.op !== 'subtract')

export function partInfo(part: NotePartSpec, scope: Record<string, number>): LocalInfo {
  return localInfo(part, scope)
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
  // shapes set out in a ring (a bearing's balls, a bolt circle) turn about the ring's axis, the part's Y: taking
  // the longest side instead laid a ring of balls on its side when it was mounted on its race
  const ring = !lead && adds.some((s) => evalDim(s.radialCount, scope, 0) > 1)
  const axis = lead
    ? shapeAxis(lead, scope)
    : ring
      ? new THREE.Vector3(0, 1, 0)
      : size.x >= size.y && size.x >= size.z
      ? new THREE.Vector3(1, 0, 0)
      : size.y >= size.z
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  const length = Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z
  const gear = adds.find((s) => GEARS.has(s.kind))
  const pulley = adds.find((s) => s.kind === 'pulley')
  const wormShape = adds.find((s) => s.kind === 'worm')
  const pitchR = gear
    ? (Math.max(6, Math.round(evalDim(gear.teeth, scope, 20))) * evalDim(gear.module, scope, 0.004)) / 2
    : wormShape
      ? Math.max(2 * evalDim(wormShape.module, scope, 0.004), evalDim(wormShape.r ?? wormShape.rOuter, scope, 5 * evalDim(wormShape.module, scope, 0.004)))
      : pulley
      ? evalDim(pulley.rOuter ?? pulley.r, scope, 0.06)
      : 0
  const hollow = lead?.kind === 'tube' || part.shapes.some((s) => s.op === 'subtract' && ROUND.has(s.kind)) || /\b(ring gear|annulus|ring)\b/i.test(part.name)
  const center = box.getCenter(new THREE.Vector3())
  let axisCenter = center.clone()
  let axisLength = length
  if (lead) {
    const at = (s: NoteShapeSpec) => new THREE.Vector3(...evalVec3(s.position, scope, [0, 0, 0]))
    const p0 = at(lead)
    // every round shape turning the same way, and which of them lie on the main one's line
    const parallel = adds.filter((s) => s === lead || (ROUND.has(s.kind) && Math.abs(shapeAxis(s, scope).dot(axis)) > 0.999))
    const sized = parallel.map((s) => {
      const g = buildPartGeometry([{ ...s, op: 'add' }], scope)
      g.computeBoundingBox()
      const b = g.boundingBox?.clone() ?? new THREE.Box3()
      g.dispose()
      const d = at(s).sub(p0)
      const sz = b.getSize(new THREE.Vector3())
      return { b, vol: Math.max(1e-12, sz.x * sz.y * sz.z), on: evalDim(s.radialCount, scope, 0) <= 1 && d.addScaledVector(axis, -d.dot(axis)).length() < 1e-3 }
    })
    const on = sized.filter((x) => x.on)
    // one axis only when the shapes on that line are most of the round material: a shaft with its collars, a disc
    // with its hub, a boss. A row of rivets or a bolt circle has no single axis, and keeps its middle
    const dominant = on.reduce((t, x) => t + x.vol, 0) >= 0.6 * sized.reduce((t, x) => t + x.vol, 0)
    if (dominant && on.length) {
      const off = center.clone().sub(p0)
      const along = off.dot(axis)
      const lateral = off.clone().addScaledVector(axis, -along).length()
      if (lateral > 0.05 * Math.max(size.x, size.y, size.z)) {
        // a body with a round feature off its middle (a frame and its bearing boss, a pedestal and its bore):
        // the feature is the axis, end to end
        let lo = Infinity
        let hi = -Infinity
        for (const { b } of on) for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const k = new THREE.Vector3(x, y, z).sub(p0).dot(axis)
          lo = Math.min(lo, k)
          hi = Math.max(hi, k)
        }
        axisCenter = p0.clone().addScaledVector(axis, (lo + hi) / 2)
        axisLength = hi - lo
      } else {
        // round about its own middle (a shaft, a gear, a yoke on its shaft): the whole part, on that line
        axisCenter = p0.clone().addScaledVector(axis, along)
      }
    }
  }
  const info = { box, center, axis, round: !!lead || ring, hollow, length, pitchR, axisCenter, axisLength }
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
export function canonical(v: THREE.Vector3) {
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

export interface AssemblyOptions {
  /** each turning part's angle now (radians about its axis): cranks drive their sliders, links and levers */
  angles?: Map<string, number>
  /** look for floating and buried parts (off while the mechanism is moving, every frame) */
  checks?: boolean
}

export function resolveAssembly(
  spec: Pick<NoteSceneSpec, 'parts'> | null,
  scope: Record<string, number>,
  opts: AssemblyOptions = {},
): { placements: Map<string, Placement>; issues: AssemblyIssue[]; frames: Map<string, PartFrame>; poses: Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }> } {
  const placements = new Map<string, Placement>()
  const issues: AssemblyIssue[] = []
  const frames = new Map<string, PartFrame>()
  if (!spec?.parts?.length) return { placements, issues, frames, poses: new Map() }
  const byId = new Map(spec.parts.map((p) => [p.id, p]))
  const done = new Map<string, { pos: THREE.Vector3; quat: THREE.Quaternion }>()
  const visiting = new Set<string>()

  // a crank's angle: where it was drawn (`angle`, degrees) plus how far it has turned since
  const crankAngle = (m: { angle?: unknown }, crankId: string) => (evalDim(m.angle as never, scope, 0) * Math.PI) / 180 + (opts.angles?.get(crankId) ?? 0)
  /**
   * The crank pin as drawn, if the model drew one: a part mounted on the crank off its axis (a die block, a
   * slide block), else a round shape on the crank off its axis (the pin itself). Its offset from the crank's
   * axis, at rest. A lever or rod aimed at this always goes through the block, whatever throw and angle the
   * mount says (they can disagree with the drawing).
   */
  const drawnPins = new Map<string, THREE.Vector3 | null>()
  const drawnPin = (crank: NotePartSpec, ti: LocalInfo, T: { pos: THREE.Vector3; quat: THREE.Quaternion }) => {
    if (drawnPins.has(crank.id)) return drawnPins.get(crank.id)!
    drawnPins.set(crank.id, null)
    const axis = canonical(ti.axis.clone().applyQuaternion(T.quat).normalize())
    const center = ti.center.clone().applyQuaternion(T.quat).add(T.pos)
    const radial = (w: THREE.Vector3) => {
      const v = w.clone().sub(center)
      return v.addScaledVector(axis, -v.dot(axis))
    }
    const minR = Math.max(0.004, 0.08 * Math.max(...ti.box.getSize(new THREE.Vector3()).toArray()))
    let found: THREE.Vector3 | null = null
    for (const q of spec.parts) {
      if (q.id === crank.id || q.mount?.kind !== 'coaxial' || q.mount.target !== crank.id || visiting.has(q.id)) continue
      place(q)
      const Q = done.get(q.id)!
      const v = radial(localInfo(q, scope).center.clone().applyQuaternion(Q.quat).add(Q.pos))
      if (v.length() > minR) {
        found = v
        break
      }
    }
    if (!found) {
      const adds = crank.shapes.filter((s) => s.op !== 'subtract' && ROUND.has(s.kind))
      for (const s of adds.slice(1)) {
        const v = radial(new THREE.Vector3(...evalVec3(s.position, scope, [0, 0, 0])).applyQuaternion(T.quat).add(T.pos))
        if (v.length() > minR && v.length() < 0.9 * Math.max(...ti.box.getSize(new THREE.Vector3()).toArray())) {
          found = v
          break
        }
      }
    }
    drawnPins.set(crank.id, found)
    return found
  }
  const crankPin = (ti: LocalInfo, T: { pos: THREE.Vector3; quat: THREE.Quaternion }, m: { throw?: unknown; angle?: unknown; direction?: AxisDir }, crankId: string) => {
    const crank = byId.get(crankId)
    const drawn = crank ? drawnPin(crank, ti, T) : null
    if (drawn) {
      const axis = canonical(ti.axis.clone().applyQuaternion(T.quat).normalize())
      const center = ti.center.clone().applyQuaternion(T.quat).add(T.pos)
      return center.add(drawn.clone().applyAxisAngle(axis, opts.angles?.get(crankId) ?? 0))
    }
    const { center, slide, across } = crankFrame(ti, T, m.direction)
    const r = evalDim(m.throw as never, scope, 0.04)
    const th = crankAngle(m, crankId)
    return center.clone().addScaledVector(slide, r * Math.cos(th)).addScaledVector(across, r * Math.sin(th))
  }
  /** a part's longest side, in its own frame, and its length along it */
  const longSide = (i: LocalInfo) => {
    const size = i.box.getSize(new THREE.Vector3())
    const v = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
    return { v, len: Math.max(size.x, size.y, size.z) }
  }
  /** where each lever's pivot is and which way it points, for followers of its tip */
  const levers = new Map<string, { pivot: THREE.Vector3; dir: THREE.Vector3; len: number }>()

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
      const tMid = ti.axisCenter.clone().applyQuaternion(T.quat).add(T.pos)
      point = tMid.addScaledVector(tAxis, (at - 0.5) * ti.axisLength + evalDim(m.offset, scope, 0))
      // the part's own line goes on that line: its axis through its main round shape, its middle along it
      const own = si.axisCenter.clone().addScaledVector(si.axis, si.center.clone().sub(si.axisCenter).dot(si.axis))
      const pos = point.sub(own.applyQuaternion(quat)).add(new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0])))
      done.set(p.id, { pos, quat })
      return
    } else if (m.kind === 'mesh' && bevelOf(p) && bevelOf(target)) {
      // two bevel gears: axes at 90°, their pitch cones' apexes at one point, so the teeth meet along the cones
      const tLead = bevelOf(target)!
      const pLead = bevelOf(p)!
      const tAx = shapeAxis(tLead, scope)
      const tPos = new THREE.Vector3(...evalVec3(tLead.position, scope, [0, 0, 0]))
      const apex = tPos.clone().addScaledVector(tAx, bevelSize(tLead, scope).apex).applyQuaternion(T.quat).add(T.pos)
      const aT = tAx.clone().applyQuaternion(T.quat).normalize()
      const up = new THREE.Vector3(0, 1, 0)
      let side = m.side ? new THREE.Vector3(...DIRS[m.side]) : Math.abs(aT.dot(up)) > 0.9 ? new THREE.Vector3(0, 0, 1) : up.clone()
      side.addScaledVector(aT, -side.dot(aT))
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0).addScaledVector(aT, -aT.x)
      side.normalize()
      const turn = evalDim(m.angle, scope, 0)
      if (turn) side.applyAxisAngle(aT, (turn * Math.PI) / 180)
      // this gear stands on that side, its cone pointing back at the shared apex
      const pAx = shapeAxis(pLead, scope)
      const q = new THREE.Quaternion().setFromUnitVectors(pAx, side.clone().negate())
      const centre = apex.clone().addScaledVector(side, bevelSize(pLead, scope).apex)
      const pPos = new THREE.Vector3(...evalVec3(pLead.position, scope, [0, 0, 0])).applyQuaternion(q)
      const pos = centre.sub(pPos).add(new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0])))
      done.set(p.id, { pos, quat: q })
      return
    } else if (m.kind === 'mesh' && (wormOf(p) || wormOf(target))) {
      // a worm and its wheel: axes square to each other, centres the two pitch radii apart
      const up = new THREE.Vector3(0, 1, 0)
      let side = m.side ? new THREE.Vector3(...DIRS[m.side]) : Math.abs(tAxis.dot(up)) > 0.9 ? new THREE.Vector3(0, 0, 1) : up.clone().negate()
      side.addScaledVector(tAxis, -side.dot(tAxis))
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0).addScaledVector(tAxis, -tAxis.x)
      side.normalize()
      // its axis square to the target's and to the line between them
      const own = new THREE.Vector3().crossVectors(tAxis, side).normalize()
      quat = new THREE.Quaternion().setFromUnitVectors(si.axis.clone().normalize(), own)
      point = tCenter.clone().addScaledVector(side, (si.pitchR || 0.02) + (ti.pitchR || 0.02))
    } else if (m.kind === 'mesh') {
      quat = alignment(si.axis, tAxis)
      const up = new THREE.Vector3(0, 1, 0)
      let side = m.side ? new THREE.Vector3(...DIRS[m.side]) : Math.abs(tAxis.dot(up)) > 0.9 ? new THREE.Vector3(0, 0, 1) : up
      side = side.clone().addScaledVector(tAxis, -side.dot(tAxis))
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(1, 0, 0).addScaledVector(tAxis, -tAxis.x)
      side.normalize()
      // turned about the target's axis: planets round a sun at 0, 120 and 240 degrees
      const turn = evalDim(m.angle, scope, 0)
      if (turn) side.applyAxisAngle(tAxis, (turn * Math.PI) / 180)
      // no gear data: fall back to the parts' sizes across the axis
      const radial = (i: LocalInfo) => i.pitchR || Math.max(...i.box.getSize(new THREE.Vector3()).toArray()) / 2
      // inside a ring gear (an annulus): the planet's centre sits the difference of the radii from the ring's
      const ring = ti.hollow && /\b(ring|annulus|internal)\b/i.test(`${target.id.replace(/_/g, ' ')} ${target.name}`) && radial(ti) > radial(si) * 1.2
      point = tCenter.clone().addScaledVector(side, ring ? radial(ti) - radial(si) : radial(si) + radial(ti))
      // a rack lies along the pinion's turning direction, teeth (its +Y) towards the pinion, its pitch line
      // touching the pitch circle. Placed like a gear it lay along the shaft, half its own length away
      const rack = p.shapes.find((s) => s.kind === 'rack' && s.op !== 'subtract')
      if (rack) {
        const along = new THREE.Vector3().crossVectors(tAxis, side).normalize()
        quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, side.clone().negate(), new THREE.Vector3().crossVectors(along, side.clone().negate())))
        const sy = Math.max(0.008, evalDim(rack.sy, scope, 0.024))
        point = tCenter.clone().addScaledVector(side, radial(ti) + sy / 2 - rackModule(rack, scope))
      }
    } else if (m.kind === 'slider') {
      // piston position for crank radius r, rod length l, crank angle θ from top dead centre
      // (from the pin: r cos θ along the line, r sin θ across it; the pin as drawn when there is one)
      const { center, slide, across } = crankFrame(ti, T, m.direction)
      const pin = crankPin(ti, T, m, target.id).sub(center)
      const along = pin.dot(slide)
      const off = pin.dot(across)
      const r = Math.hypot(along, off)
      const l = Math.max(r * 1.05, evalDim(m.rod, scope, 0.15))
      point = center.clone().addScaledVector(slide, along + Math.sqrt(l * l - off * off))
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
      const pin = crankPin(ti, T, m, target.id)
      const D = done.get(toPart.id)!
      const end = localInfo(toPart, scope).center.clone().applyQuaternion(D.quat).add(D.pos)
      const line = end.clone().sub(pin)
      // a link lines up by its length (a rod's eyes are round but point across it, so not by its round parts)
      const size = si.box.getSize(new THREE.Vector3())
      const long = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1)
      if (line.lengthSq() > 1e-9) quat = alignment(long, line.clone().normalize())
      point = pin.clone().add(end).multiplyScalar(0.5)
    } else if (m.kind === 'lever') {
      // a slotted lever: from its pivot, always through the crank pin
      const pivotPart = byId.get(m.pivot)
      if (!pivotPart || pivotPart === p) {
        issues.push({ partId: p.id, kind: 'missing-target', message: `${p.name} pivots on "${m.pivot}", which is not a part of this model` })
        return void done.set(p.id, base(p))
      }
      visiting.add(p.id)
      place(pivotPart)
      visiting.delete(p.id)
      const PV = done.get(pivotPart.id)!
      const pivot = localInfo(pivotPart, scope).center.clone().applyQuaternion(PV.quat).add(PV.pos)
      const pin = crankPin(ti, T, m, target.id)
      const dir = pin.clone().sub(pivot)
      if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0)
      dir.normalize()
      const { v, len } = longSide(si)
      quat = new THREE.Quaternion().setFromUnitVectors(v, dir)
      point = pivot.clone().addScaledVector(dir, len / 2)
      levers.set(p.id, { pivot, dir, len })
    } else if (m.kind === 'follower') {
      // slides along its guide with a point of the target (a crank's pin, a lever's tip); stays put across it
      const d = new THREE.Vector3(...DIRS[m.direction])
      let F: THREE.Vector3
      const lever = levers.get(target.id)
      if ((m.of === 'tip' || (!m.of && lever && m.throw === undefined)) && lever) F = lever.pivot.clone().addScaledVector(lever.dir, lever.len)
      else if (m.throw !== undefined) F = crankPin(ti, T, m, target.id)
      else F = tCenter.clone()
      const b = base(p)
      const own = si.center.clone().applyQuaternion(b.quat).add(b.pos)
      point = own.addScaledVector(d, F.clone().sub(own).dot(d) + evalDim(m.offset, scope, 0))
      quat = b.quat
    } else if (m.kind === 'fit') {
      // fitted by named features: the target's shape named `feature`, this part's shape `own` (or its main round
      // shape), their axes on one line, or this part against a face of the feature. No offsets to work out by hand
      const F = featureOf(target, m.feature)
      if (!F) {
        issues.push({ partId: p.id, kind: 'missing-target', message: `${p.name} fits to "${m.feature}" on ${target.name}, which has no shape of that name` })
        return void done.set(p.id, base(p))
      }
      const fFrame = shapeFrame(F, scope)
      const fCentre = fFrame.centre.clone().applyQuaternion(T.quat).add(T.pos)
      const fAxis = fFrame.axis.clone().applyQuaternion(T.quat).normalize()
      if (m.face) {
        // against a face of the feature (its own box, turned with it), centred on it
        quat = base(p).quat
        const n = new THREE.Vector3(...DIRS[m.face]).applyQuaternion(fFrame.quat).applyQuaternion(T.quat).normalize()
        const half = (box: THREE.Box3, dir: THREE.Vector3) => {
          const s = box.getSize(new THREE.Vector3()).multiplyScalar(0.5)
          return Math.abs(dir.x) * s.x + Math.abs(dir.y) * s.y + Math.abs(dir.z) * s.z
        }
        const fBoxLocal = fFrame.box
        const nLocal = new THREE.Vector3(...DIRS[m.face])
        const sb = worldBox(si.box, quat)
        const sc = sb.getCenter(new THREE.Vector3())
        point = fCentre.clone().addScaledVector(n, half(fBoxLocal, nLocal) + half(sb, n) + evalDim(m.offset, scope, 0))
        const pos = point.sub(sc).add(new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0])))
        done.set(p.id, { pos, quat })
        return
      }
      const O = m.own ? featureOf(p, m.own) : (p.shapes.find((s) => s.op !== 'subtract' && GEARS.has(s.kind)) ?? p.shapes.find((s) => s.op !== 'subtract' && ROUND.has(s.kind)))
      const oFrame = O ? shapeFrame(O, scope) : { centre: si.center.clone(), axis: si.axis.clone(), length: si.length, quat: new THREE.Quaternion(), box: si.box }
      quat = alignment(oFrame.axis, fAxis)
      const turn = evalDim(m.turn, scope, 0)
      if (turn) quat = new THREE.Quaternion().setFromAxisAngle(fAxis, (turn * Math.PI) / 180).multiply(quat)
      const at = Math.min(1, Math.max(0, evalDim(m.at, scope, 0.5)))
      point = fCentre.clone().addScaledVector(fAxis, (at - 0.5) * fFrame.length + evalDim(m.offset, scope, 0))
      const pos = point.sub(oFrame.centre.clone().applyQuaternion(quat)).add(new THREE.Vector3(...evalVec3(m.shift, scope, [0, 0, 0])))
      done.set(p.id, { pos, quat })
      return
    } else if (m.kind === 'keyed') {
      // a key in the shaft's keyway: long side along the shaft, thin side radial, its middle at the shaft's surface
      // (half in the shaft, half in the hub), worked out here so it cannot end up at the centre or lying across
      const size = si.box.getSize(new THREE.Vector3())
      const dims = [size.x, size.y, size.z]
      const iLong = dims.indexOf(Math.max(...dims))
      const rest = [0, 1, 2].filter((k) => k !== iLong)
      const iThin = dims[rest[0]] <= dims[rest[1]] ? rest[0] : rest[1]
      const unit = (k: number) => new THREE.Vector3(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0)
      const eL = unit(iLong)
      const eS = unit(iThin)
      const eT = new THREE.Vector3().crossVectors(eL, eS)
      let up = new THREE.Vector3(0, 1, 0)
      if (Math.abs(up.dot(tAxis)) > 0.9) up = new THREE.Vector3(0, 0, 1)
      up.addScaledVector(tAxis, -up.dot(tAxis)).normalize()
      const turn = evalDim(m.angle, scope, 0)
      if (turn) up.applyAxisAngle(tAxis, (turn * Math.PI) / 180)
      const wT = new THREE.Vector3().crossVectors(tAxis, up)
      const world = new THREE.Matrix4().makeBasis(tAxis, up, wT)
      const local = new THREE.Matrix4().makeBasis(eL, eS, eT)
      quat = new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose()))
      // the shaft's radius where the key sits; without one, the slimmest the shaft is across its axis
      const tb = ti.box.getSize(new THREE.Vector3())
      const across = [tb.x, tb.y, tb.z].filter((_, k) => Math.abs([ti.axis.x, ti.axis.y, ti.axis.z][k]) < 0.5)
      const r = evalDim(m.r, scope, Math.min(...(across.length ? across : [tb.x, tb.y, tb.z])) / 2)
      const at = Math.min(1, Math.max(0, evalDim(m.at, scope, 0.5)))
      const mid = ti.axisCenter.clone().applyQuaternion(T.quat).add(T.pos)
      point = mid.addScaledVector(tAxis, (at - 0.5) * ti.axisLength + evalDim(m.offset, scope, 0)).addScaledVector(up, r)
    } else if (m.kind === 'hooke') {
      // a universal joint: the output leaves the end of the input shaft, its axis turned by the joint angle
      const beta = (evalDim(m.angle, scope, 30) * Math.PI) / 180
      let perp = new THREE.Vector3().crossVectors(tAxis, new THREE.Vector3(0, 1, 0))
      if (perp.lengthSq() < 1e-6) perp = new THREE.Vector3().crossVectors(tAxis, new THREE.Vector3(0, 0, 1))
      perp.normalize()
      const out = tAxis.clone().applyAxisAngle(perp, beta)
      const joint = tCenter.clone().addScaledVector(tAxis, ti.length / 2)
      quat = new THREE.Quaternion().setFromUnitVectors(si.axis.clone().normalize(), out)
      point = joint.addScaledVector(out, si.length / 2)
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
  if (opts.checks !== false && spec.parts.length > 1) {
    const boxes = spec.parts.map((p) => {
      const d = done.get(p.id)!
      return { p, box: worldBox(localInfo(p, scope).box, d.quat, d.pos) }
    })
    const vol = (b: THREE.Box3) => {
      const s = b.getSize(new THREE.Vector3())
      return Math.max(1e-12, s.x * s.y * s.z)
    }
    const linked = (a: NotePartSpec, b: NotePartSpec) =>
      (a.mount?.target === b.id && a.mount.kind !== 'against') || (a.mount?.kind === 'link' && a.mount.to === b.id) || (a.mount?.kind === 'lever' && a.mount.pivot === b.id)
    const related = (a: NotePartSpec, b: NotePartSpec) => linked(a, b) || linked(b, a)
    // parts on one axis (a gear on its shaft, a bearing on its journal) overlap by design, however they were placed
    const pos = new Map(spec.parts.map((p) => [p.id, done.get(p.id)!]))
    const sameAxis = (a: string, b: string) => {
      const A = localInfo(spec.parts.find((p) => p.id === a)!, scope)
      const B = localInfo(spec.parts.find((p) => p.id === b)!, scope)
      const pa = pos.get(a)!, pb = pos.get(b)!
      const ax = A.axis.clone().applyQuaternion(pa.quat).normalize()
      const bx = B.axis.clone().applyQuaternion(pb.quat).normalize()
      if (!A.round || !B.round || Math.abs(ax.dot(bx)) < 0.995) return false
      const ca = A.center.clone().applyQuaternion(pa.quat).add(pa.pos)
      const cb = B.center.clone().applyQuaternion(pb.quat).add(pb.pos)
      const d = cb.sub(ca)
      return d.addScaledVector(ax, -d.dot(ax)).length() < 0.003
    }
    /** whether a point lies in one of a part's cut-outs (a slot, a pocket, a bore) */
    const inCutOut = (host: NotePartSpec, point: THREE.Vector3) => {
      const d = done.get(host.id)!
      return host.shapes.some((s) => {
        if (s.op !== 'subtract') return false
        const g = buildPartGeometry([{ ...s, op: 'add' }], scope)
        g.computeBoundingBox()
        const b = g.boundingBox ? worldBox(g.boundingBox, d.quat, d.pos) : null
        g.dispose()
        return !!b && b.containsPoint(point)
      })
    }
    for (const { p, box } of boxes) {
      const size = box.getSize(new THREE.Vector3()).length()
      const tol = 0.004 + size * 0.02
      const touching = boxes.some((o) => o.p !== p && o.box.clone().expandByScalar(tol).intersectsBox(box))
      if (!touching) issues.push({ partId: p.id, kind: 'floating', message: `${p.name} is floating: it does not touch any other part` })
      if (p.role === 'housing') continue
      for (const o of boxes) {
        if (o.p === p || o.p.role === 'housing' || related(p, o.p) || sameAxis(p.id, o.p.id) || localInfo(o.p, scope).hollow) continue
        // in a cut-out made for it (a die block in a lever's slot, a roller in a yoke's): not buried
        if (inCutOut(o.p, box.getCenter(new THREE.Vector3()))) continue
        const overlap = box.clone().intersect(o.box)
        if (overlap.isEmpty()) continue
        if (vol(overlap) / vol(box) > 0.6 && vol(box) < vol(o.box)) {
          issues.push({ partId: p.id, kind: 'buried', message: `${p.name} is buried inside ${o.p.name}` })
          break
        }
      }
    }
  }
  return { placements, issues, frames, poses: done }
}

/**
 * Where an arrow or dimension attached to a part goes, from the part's frame: a force ends on the point and
 * acts along its direction; a moment turns about the part's axis; a dimension spans the part's length,
 * drawn just below it. Null when it is not attached (its own from / to stand).
 */
/**
 * Where an arrow's label is drawn: a force's at the middle of its arrow, a moment's at the end of its arc (three
 * quarters of a turn round its axis), anything else at its tip. The renderer and the label-overlap check both use
 * this, so the check sees the labels where the reader does.
 */
export function labelPoint(kind: NoteAnnotationSpec['kind'], from: Vec3, to: Vec3): Vec3 {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  if (kind === 'force' || kind === 'dimension') return a.add(b).multiplyScalar(0.5).toArray() as Vec3
  if (kind !== 'moment') return to
  const d = b.clone().sub(a)
  const len = d.length()
  const axis = len > 1e-5 ? d.normalize() : new THREE.Vector3(0, 1, 0)
  const radius = Math.min(0.09, Math.max(0.035, len * 0.6))
  const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
  const w = new THREE.Vector3().crossVectors(axis, u).normalize()
  const t = Math.PI * 1.5
  return a.add(u.multiplyScalar(Math.cos(t) * radius)).add(w.multiplyScalar(Math.sin(t) * radius)).toArray() as Vec3
}

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
    // a push ends on the face it presses; a pull (pointing away from the part, a plate in tension, a shaft
    // pulled at its end) starts at the face, so neither is drawn through the part
    if (point.clone().sub(fr.center).dot(dir) > 1e-6) return { from: v(point), to: v(point.clone().addScaledVector(dir, len)) }
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
