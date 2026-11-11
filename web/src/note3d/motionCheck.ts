import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { GEARS, ROUND, resolveAssembly } from './assembly'
import { buildPartGeometry } from './builder'
import { buildKinematics, playbackPace } from './kinematics'
import { evalDim, evalVec3, type NotePartSpec, type NoteSceneSpec } from './schema'
import { JOINT_PIECE } from './jointPieces'

/**
 * The machine checked while it moves, not only at rest: it is turned through one cycle in steps, every part
 * placed exactly as the renderer places it, and at each step points on each moving part's real surface are
 * tested against every other part's actual solid (holes, bores and slots cut out). A part that runs into
 * something it was not already in at rest (a slider block whose corners sweep through the edges of its slot),
 * or comes away from something it touched (a ram leaving its guide), is named. Faults that only exist in
 * motion pass every check made at rest.
 */

const STEPS = 10
/** sample points per moving part, taken from its drawn surface */
const POINTS = 200

interface Placed {
  part: NotePartSpec
  /** the part's own frame in the world, at rest */
  base: THREE.Matrix4
  geo: THREE.BufferGeometry
  bvh: MeshBVH | null
  /** points on its surface (its own frame), pulled a little inwards so a touching contact is not counted */
  samples: THREE.Vector3[]
  /** the top-level part it moves with (itself, or the part carrying it as a child) */
  mover: string
  /** its frame relative to the mover's (identity for a top-level part) */
  local: THREE.Matrix4
}

const leadOf = (part: NotePartSpec) => {
  const adds = part.shapes.filter((s) => s.op !== 'subtract')
  return adds.find((s) => GEARS.has(s.kind)) ?? adds.find((s) => ROUND.has(s.kind))
}

/** how a part's motion group moves (its own frame), as the renderer does it */
function motionMatrix(part: NotePartSpec, scope: Record<string, number>, kin: ReturnType<typeof buildKinematics>, t: number): THREE.Matrix4 {
  const lead = leadOf(part)
  let spinAxis: THREE.Vector3 | null = null
  let pivot = new THREE.Vector3()
  if (lead) {
    const r = evalVec3(lead.rotation, scope, [0, 0, 0])
    spinAxis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')).normalize()
    const big = Math.abs(spinAxis.x) >= Math.abs(spinAxis.y) && Math.abs(spinAxis.x) >= Math.abs(spinAxis.z) ? spinAxis.x : Math.abs(spinAxis.y) >= Math.abs(spinAxis.z) ? spinAxis.y : spinAxis.z
    if (big < 0) spinAxis.negate()
    pivot = new THREE.Vector3(...evalVec3(lead.position, scope, [0, 0, 0]))
  }
  if (!lead && part.shapes.some((s) => s.op !== 'subtract' && evalDim(s.radialCount, scope, 0) > 1)) spinAxis = new THREE.Vector3(0, 1, 0)
  const m = new THREE.Matrix4()
  if (kin.derived.has(part.id)) {
    const mv = kin.move(part.id)
    if (!mv) return m
    const r = spinAxis ? new THREE.Quaternion().setFromAxisAngle(spinAxis, mv.spin) : new THREE.Quaternion()
    const q = mv.quat.clone().multiply(r)
    const p = mv.pos.clone().add(pivot.clone().sub(pivot.clone().applyQuaternion(r)).applyQuaternion(mv.quat))
    return m.compose(p, q, new THREE.Vector3(1, 1, 1))
  }
  if (!part.motion) return m
  const { kind, axis, phase = 0 } = part.motion
  const speed = evalDim(part.motion.speed, scope, 1)
  let amp = evalDim(part.motion.amplitude, scope, 0.35)
  if (kind === 'oscillate' && Math.abs(amp) > Math.PI) amp = (amp * Math.PI) / 180
  if (kind === 'rotate' && spinAxis) {
    const q = new THREE.Quaternion().setFromAxisAngle(spinAxis, t * speed + phase)
    return m.compose(pivot.clone().sub(pivot.clone().applyQuaternion(q)), q, new THREE.Vector3(1, 1, 1))
  }
  const e = new THREE.Euler()
  const p = new THREE.Vector3()
  if (kind === 'rotate') e[axis] = t * speed + phase
  else if (kind === 'oscillate') e[axis] = Math.sin(t * speed * Math.PI * 2 + phase) * amp
  else if (kind === 'translate') p[axis] = Math.sin(t * speed * Math.PI * 2 + phase) * amp
  return m.compose(p, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1))
}

/** n points spread evenly over a mesh's surface by area, pulled 6 % towards its middle */
function surfaceSamples(geo: THREE.BufferGeometry, n: number): THREE.Vector3[] {
  const pos = geo.getAttribute('position')
  if (!pos?.count) return []
  const idx = geo.getIndex()
  const tri = (k: number) => (idx ? [idx.getX(3 * k), idx.getX(3 * k + 1), idx.getX(3 * k + 2)] : [3 * k, 3 * k + 1, 3 * k + 2])
  const count = Math.floor((idx ? idx.count : pos.count) / 3)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const areas: number[] = []
  let total = 0
  for (let k = 0; k < count; k++) {
    const [i, j, l] = tri(k)
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, j)
    c.fromBufferAttribute(pos, l)
    total += new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2
    areas.push(total)
  }
  if (total <= 0) return []
  const middle = geo.boundingBox!.getCenter(new THREE.Vector3())
  const out: THREE.Vector3[] = []
  let k = 0
  for (let s = 0; s < n; s++) {
    // evenly spaced along the running total of area, with a fixed spread inside each triangle
    const target = ((s + 0.5) / n) * total
    while (k < count - 1 && areas[k] < target) k++
    const [i, j, l] = tri(k)
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, j)
    c.fromBufferAttribute(pos, l)
    const u = ((s * 0.618034) % 1) * 0.8 + 0.1
    const v = ((s * 0.414214) % 1) * (0.9 - u)
    out.push(a.clone().multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v).lerp(middle, 0.06))
  }
  return out
}

/** whether a point (in the part's own frame) is inside its solid: an odd number of crossings along a ray */
function inside(p: Placed, point: THREE.Vector3, ray: THREE.Ray): boolean {
  if (!p.bvh) return false
  if (!p.geo.boundingBox!.containsPoint(point)) return false
  ray.origin.copy(point)
  const hits = p.bvh.raycast(ray, THREE.DoubleSide)
  // two faces of one surface hit at nearly the same distance count once
  let n = 0
  let last = -1
  for (const h of hits.sort((a, b) => a.distance - b.distance)) {
    if (h.distance - last > 1e-6) n++
    last = h.distance
  }
  return n % 2 === 1
}

export function motionProblems(spec: Pick<NoteSceneSpec, 'parts' | 'calculations' | 'parameters'>, scope: Record<string, number>): string[] {
  const parts = spec.parts ?? []
  if (parts.length < 2) return []
  let kin: ReturnType<typeof buildKinematics>
  let rest: ReturnType<typeof resolveAssembly>
  try {
    kin = buildKinematics(spec, scope)
    rest = resolveAssembly(spec, scope, { checks: false })
  } catch {
    return []
  }
  const moving = (p: NotePartSpec) => !!p.motion || kin.derived.has(p.id)
  if (!parts.some(moving)) return []

  // every part (children too), placed at rest
  const placed: Placed[] = []
  const add = (p: NotePartSpec, parentWorld: THREE.Matrix4 | null, mover: string, local: THREE.Matrix4) => {
    if (p.role === 'fluid') return
    const pl = rest.placements.get(p.id)
    const own = new THREE.Matrix4().compose(
      new THREE.Vector3(...(pl?.position ?? evalVec3(p.position, scope, [0, 0, 0]))),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(pl?.rotation ?? evalVec3(p.rotation, scope, [0, 0, 0])), 'XYZ')),
      new THREE.Vector3(1, 1, 1),
    )
    const base = parentWorld ? parentWorld.clone().multiply(own) : own
    let geo: THREE.BufferGeometry
    try {
      geo = buildPartGeometry(p.shapes, scope)
    } catch {
      return
    }
    geo.computeBoundingBox()
    let bvh: MeshBVH | null = null
    try {
      if (geo.getAttribute('position')?.count) bvh = new MeshBVH(geo)
    } catch {
      bvh = null
    }
    // points spread evenly over the surface by area (vertices crowd where the surface curves: a block's bore
    // would get most of them and its corners, the parts that hit, almost none)
    const samples = surfaceSamples(geo, POINTS)
    const me: Placed = { part: p, base, geo, bvh, samples, mover, local: parentWorld ? local.clone().multiply(own) : new THREE.Matrix4() }
    placed.push(me)
    for (const ch of p.children ?? []) add(ch, base, mover, me.local)
  }
  // a universal joint is drawn by the app (HookeJoint); the yokes and cross a model drew for it are not shown
  const joint = parts.some((p) => p.mount?.kind === 'hooke')
  for (const p of parts) if (!(joint && JOINT_PIECE.test(p.name) && !/shaft/i.test(p.name) && p.mount?.kind !== 'hooke')) add(p, null, p.id, new THREE.Matrix4())

  // one cycle of the fastest driver (a slow model: two seconds)
  let w = 0
  for (const p of parts) {
    if (p.motion) w = Math.max(w, Math.abs(evalDim(p.motion.speed, scope, 1)) * (p.motion.kind === 'rotate' ? 1 : 2 * Math.PI))
  }
  void playbackPace
  const period = w > 1e-6 ? (2 * Math.PI) / w : 2
  const top = new Map(parts.map((p) => [p.id, p]))
  const worldAt = (t: number) => {
    kin.update(t)
    const motion = new Map<string, THREE.Matrix4>()
    for (const p of parts) motion.set(p.id, motionMatrix(p, scope, kin, t))
    return placed.map((x) => {
      const moverBase = placed.find((y) => y.part.id === x.mover)!.base
      return moverBase.clone().multiply(motion.get(x.mover) ?? new THREE.Matrix4()).multiply(x.local)
    })
  }
  void top

  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0.577, 0.577, 0.577).normalize())
  const pairs: [number, number][] = []
  for (let i = 0; i < placed.length; i++) for (let j = 0; j < placed.length; j++) if (i !== j && placed[i].mover !== placed[j].mover && moving(top.get(placed[i].mover)!)) pairs.push([i, j])
  /** how many of part i's points are inside part j's solid, with the parts placed by `world` */
  const tmp = new THREE.Vector3()
  const into = (world: THREE.Matrix4[], i: number, j: number) => {
    if (!boxOf(world, i).intersectsBox(boxOf(world, j))) return 0
    const toJ = world[j].clone().invert().multiply(world[i])
    let n = 0
    for (const s of placed[i].samples) if (inside(placed[j], tmp.copy(s).applyMatrix4(toJ), ray)) n++
    return n
  }
  const boxOf = (world: THREE.Matrix4[], i: number) => placed[i].geo.boundingBox!.clone().applyMatrix4(world[i])
  const gap = (a: THREE.Box3, b: THREE.Box3) => {
    const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x)
    const dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y)
    const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z)
    return Math.hypot(dx, dy, dz)
  }

  const w0 = worldAt(0)
  const atRest = new Map(pairs.map(([i, j]) => [`${i}:${j}`, into(w0, i, j)]))
  const touching = new Map(pairs.map(([i, j]) => [`${i}:${j}`, gap(boxOf(w0, i), boxOf(w0, j))]))
  const hits = new Map<string, number>()
  const apart = new Set<string>()
  for (let k = 1; k <= STEPS; k++) {
    const wk = worldAt((k / STEPS) * period)
    for (const [i, j] of pairs) {
      const key = `${i}:${j}`
      const n = into(wk, i, j)
      const extra = n - atRest.get(key)!
      // clearly more than at rest (faceted round parts turning against each other add a few points of noise to
      // a contact that was already there), and at two steps or more
      const rest0 = atRest.get(key)!
      if (extra >= 3 && extra > 0.04 * placed[i].samples.length && extra > 0.75 * rest0) hits.set(key, (hits.get(key) ?? 0) + 1)
      const size = Math.min(placed[i].geo.boundingBox!.getSize(tmp).length(), placed[j].geo.boundingBox!.getSize(new THREE.Vector3()).length())
      if (touching.get(key)! < 0.002 && gap(boxOf(wk, i), boxOf(wk, j)) > Math.max(0.004, 0.05 * size)) apart.add(i < j ? `${i}:${j}` : `${j}:${i}`)
    }
  }
  const out: string[] = []
  const said = new Set<string>()
  for (const [key, steps] of hits) {
    if (steps < 2) continue
    const [i, j] = key.split(':').map(Number)
    const k = [placed[i].part.name, placed[j].part.name].sort().join('|')
    if (said.has(k)) continue
    said.add(k)
    out.push(`${placed[i].part.name} runs into ${placed[j].part.name} as it moves`)
  }
  for (const key of apart) {
    const [i, j] = key.split(':').map(Number)
    // two parts joined by a mount, or one in the other, that part company: only those that were meant to stay together
    const a = placed[i].part
    const b = placed[j].part
    const joined = a.mount?.target === b.id || b.mount?.target === a.id
    if (joined) out.push(`${a.name} comes away from ${b.name} as it moves`)
  }
  for (const x of placed) x.geo.dispose()
  return out
}
