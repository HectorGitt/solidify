import * as THREE from 'three'
import { GEARS, ROUND, canonical, partInfo, resolveAssembly, type LocalInfo } from './assembly'
import { evalDim, evalVec3, type NotePartSpec, type NoteSceneSpec, type NoteShapeSpec } from './schema'

/**
 * How a generated machine moves, worked out from how its parts are mounted, not from a speed written on every
 * part. One part per mechanism drives it (a motor, a crank, a handwheel: the part given a `motion`); every
 * other part follows from its relation:
 *
 * - on a shaft (coaxial, both moving): turns with it, the same angle;
 * - meshed external gears: θ₂ = −(T₁/T₂)·θ₁ + φ, with φ chosen so the teeth interleave; inside a ring gear the
 *   same way round; a rack meshing with a pinion slides r·θ along its length;
 * - a universal joint's output: tan θ₂ = tan θ₁ / cos β (Hooke's law);
 * - sliders, connecting rods, slotted levers and followers: placed afresh every frame by the assembly solver
 *   from their crank's real angle, so a piston, a lever or a ram moves exactly as the crank drives it.
 *
 * A model that writes a speed on every part (as the drafts did) still works: the first driver found in each
 * mechanism (a part named like a motor, input, crank or handwheel, else the first with a motion) drives it, and
 * the speeds written on the others are not used. Parts in no mechanism keep their own motion.
 */

const DRIVER_NAME = /\b(motor|input|crank|driv|hand ?wheel|handle|worm|prime|pinion ?1)/i
const LINKAGE = new Set(['slider', 'link', 'lever', 'follower'])

/** how one part moves now, in its own frame: a pose change (linkages, racks) and a spin about its own axis */
export interface PartMove {
  /** the part's pose now relative to where it was drawn (identity when it only spins) */
  quat: THREE.Quaternion
  pos: THREE.Vector3
  /** its spin, radians about its own (canonical, local) axis; 0 if it doesn't spin */
  spin: number
}

export interface Kinematics {
  /** parts whose motion is worked out here; their own `motion` is not used */
  derived: Set<string>
  /** works the mechanism out at time t (seconds of model time) */
  update(t: number): void
  /** how a part moves now (after update), or null if it doesn't move by relation */
  move(id: string): PartMove | null
}

const lead = (part: NotePartSpec): NoteShapeSpec | undefined => {
  const adds = part.shapes.filter((s) => s.op !== 'subtract')
  return adds.find((s) => GEARS.has(s.kind)) ?? adds.find((s) => ROUND.has(s.kind))
}

/** the signed angle from a to b about n (all in world space) */
const signedAngle = (a: THREE.Vector3, b: THREE.Vector3, n: THREE.Vector3) => {
  const pa = a.clone().addScaledVector(n, -a.dot(n))
  const pb = b.clone().addScaledVector(n, -b.dot(n))
  return Math.atan2(n.dot(new THREE.Vector3().crossVectors(pa, pb)), pa.dot(pb))
}

/** atan2 wraps; keep the output within half a turn of a reference so it turns continuously */
const near = (raw: number, ref: number) => raw + 2 * Math.PI * Math.round((ref - raw) / (2 * Math.PI))

type Link =
  | { kind: 'rigid' }
  /** θ_to = k·θ_from + φ */
  | { kind: 'gear'; k: number; phase: number }
  /** Hooke's joint, input → output (or back) */
  | { kind: 'hooke'; beta: number; forward: boolean }

export function buildKinematics(spec: Pick<NoteSceneSpec, 'parts'> | null, scope: Record<string, number>): Kinematics {
  const empty: Kinematics = { derived: new Set(), update: () => {}, move: () => null }
  if (!spec?.parts?.length) return empty
  const parts = spec.parts
  const byId = new Map(parts.map((p) => [p.id, p]))
  const base = resolveAssembly(spec, scope, { checks: false }).poses
  const info = new Map<string, LocalInfo>(parts.map((p) => [p.id, partInfo(p, scope)]))
  const moving = (p: NotePartSpec) => p.role === 'moving' || !!p.motion
  const round = (p: NotePartSpec) => info.get(p.id)!.round

  // each round part's axis in the world (one way round), and which way its own local axis points along it
  const worldAxis = new Map<string, THREE.Vector3>()
  const sense = new Map<string, number>()
  for (const p of parts) {
    const q = base.get(p.id)?.quat
    if (!q || !round(p)) continue
    const local = canonical(info.get(p.id)!.axis.clone())
    const w = local.clone().applyQuaternion(q).normalize()
    const c = canonical(w.clone())
    worldAxis.set(p.id, c)
    sense.set(p.id, Math.sign(w.dot(c)) || 1)
  }
  const centerOf = (id: string) => {
    const q = base.get(id)!
    return info.get(id)!.center.clone().applyQuaternion(q.quat).add(q.pos)
  }
  const teethOf = (p: NotePartSpec) => {
    const l = lead(p)
    return l && GEARS.has(l.kind) ? Math.max(6, Math.round(evalDim(l.teeth, scope, 20))) : 0
  }
  /** where a gear's first tooth points, in the world, at angle 0 */
  const toothDir = (p: NotePartSpec) => {
    const l = lead(p)!
    const r = evalVec3(l.rotation, scope, [0, 0, 0])
    return new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')).applyQuaternion(base.get(p.id)!.quat).normalize()
  }

  // the links between parts that turn together
  const links = new Map<string, { to: string; link: Link }[]>()
  const addLink = (from: string, to: string, link: Link) => {
    if (!links.has(from)) links.set(from, [])
    links.get(from)!.push({ to, link })
  }
  /** racks: slide along `dir` by r·θ of their pinion */
  const racks = new Map<string, { gear: string; r: number; dir: THREE.Vector3 }>()
  /** parts running free on a turning part (a spider gear on its carrier's cross pin): their own spin, carried round */
  const freeOn = new Map<string, string>()

  for (const p of parts) {
    const m = p.mount
    const t = m ? byId.get(m.target) : undefined
    if (!m || !t || !moving(p) || !moving(t)) continue
    if (m.kind === 'coaxial' && round(t)) {
      // fixed to a turning part: a gear on its shaft, or a pin, a block, a cam carried round with it. Unless the
      // model wrote it a clearly different speed: then it runs free on a bearing (a differential's side gears)
      const own = (x: NotePartSpec) => (x.motion?.kind === 'rotate' ? Math.abs(evalDim(x.motion.speed, scope, NaN)) : NaN)
      const [wp, wt] = [own(p), own(t)]
      if (Number.isFinite(wp) && Number.isFinite(wt) && Math.abs(wp - wt) > 0.02 * Math.max(wp, wt)) {
        freeOn.set(p.id, t.id)
        continue
      }
      addLink(t.id, p.id, { kind: 'rigid' })
      if (round(p)) addLink(p.id, t.id, { kind: 'rigid' })
    } else if (m.kind === 'mesh') {
      const ip = info.get(p.id)!
      const it = info.get(t.id)!
      if (round(p) && round(t) && ip.pitchR > 0 && it.pitchR > 0) {
        // inside a ring gear both turn the same way; otherwise the opposite way. A ring is told by where the other
        // gear sits (inside it: centres closer than the bigger pitch radius), not by a bore, which most gears have
        const dc = centerOf(p.id).sub(centerOf(t.id))
        const ax = worldAxis.get(t.id)!
        dc.addScaledVector(ax, -dc.dot(ax))
        const internal = dc.length() < Math.max(ip.pitchR, it.pitchR) * 0.98
        const k = ((internal ? 1 : -1) * it.pitchR) / ip.pitchR
        // the teeth interleave: when the driving gear has a tooth on the line of centres, the driven one has a gap
        let phase = 0
        const Tp = teethOf(p)
        const Tt = teethOf(t)
        if (!internal && Tp && Tt) {
          const a = worldAxis.get(t.id)!
          const u = centerOf(p.id).sub(centerOf(t.id))
          u.addScaledVector(a, -u.dot(a)).normalize()
          const psiT = signedAngle(toothDir(t), u, a)
          const psiP = signedAngle(toothDir(p), u.clone().negate(), a)
          phase = psiP - Math.PI / Tp - k * psiT
        }
        addLink(t.id, p.id, { kind: 'gear', k, phase })
        addLink(p.id, t.id, { kind: 'gear', k: 1 / k, phase: -phase / k })
      } else if (round(t) !== round(p)) {
        // a rack and its pinion: the rack slides along the pinion's turning direction at the contact
        const gear = round(t) ? t : p
        const rack = gear === t ? p : t
        const a = worldAxis.get(gear.id)!
        const n = centerOf(rack.id).sub(centerOf(gear.id))
        n.addScaledVector(a, -n.dot(a)).normalize()
        racks.set(rack.id, { gear: gear.id, r: info.get(gear.id)!.pitchR || Math.max(...info.get(gear.id)!.box.getSize(new THREE.Vector3()).toArray()) / 2, dir: new THREE.Vector3().crossVectors(a, n).normalize() })
      }
    } else if (m.kind === 'hooke' && round(p) && round(t)) {
      const beta = (evalDim(m.angle, scope, 30) * Math.PI) / 180
      addLink(t.id, p.id, { kind: 'hooke', beta, forward: true })
      addLink(p.id, t.id, { kind: 'hooke', beta, forward: false })
    }
  }

  // each mechanism (parts joined by those links) is driven by one part
  const order: { id: string; from: string | null; link: Link | null }[] = []
  const reached = new Set<string>()
  /** the part whose axis each part turns about: its own, or (fixed to it off that axis) the part carrying it round */
  const anchor = new Map<string, string>()
  const onLine = (id: string, a: string) => {
    const wa = worldAxis.get(a)
    const wi = worldAxis.get(id)
    if (!wa || !wi || Math.abs(wa.dot(wi)) < 0.999) return false
    const off = centerOf(id).sub(centerOf(a))
    return off.addScaledVector(wa, -off.dot(wa)).length() < 5e-4
  }
  const drivers = parts.filter((p) => p.motion?.kind === 'rotate' && round(p))
  const ranked = [...drivers.filter((p) => DRIVER_NAME.test(`${p.id} ${p.name}`)), ...drivers]
  const speed = new Map<string, { w: number; phase: number }>()
  for (const d of ranked) {
    if (reached.has(d.id)) continue
    reached.add(d.id)
    speed.set(d.id, { w: evalDim(d.motion!.speed, scope, 1), phase: d.motion!.phase ?? 0 })
    order.push({ id: d.id, from: null, link: null })
    anchor.set(d.id, d.id)
    const queue = [d.id]
    while (queue.length) {
      const id = queue.shift()!
      for (const { to, link } of links.get(id) ?? []) {
        if (reached.has(to)) continue
        reached.add(to)
        const a = anchor.get(id)!
        anchor.set(to, link.kind === 'rigid' && !onLine(to, a) ? a : to)
        order.push({ id: to, from: id, link })
        queue.push(to)
      }
    }
  }
  const spinning = new Set(order.map((o) => o.id))
  /** the part each one is carried round by, when that is not its own axis */
  const carrier = new Map<string, string>()
  for (const [id, a] of anchor) if (a !== id) carrier.set(id, a)
  for (const [id, on] of freeOn) {
    const a = anchor.get(on)
    if (spinning.has(id) && a && !onLine(id, a)) carrier.set(id, a)
  }
  const centers = new Map([...new Set(carrier.values())].map((a) => [a, centerOf(a)]))

  // parts the assembly re-places as the mechanism turns: linkages, and anything mounted on one
  const linkage = parts.filter((p) => p.mount && LINKAGE.has(p.mount.kind))
  const derived = new Set<string>([...spinning, ...racks.keys(), ...linkage.map((p) => p.id)])
  if (!derived.size) return empty

  const angles = new Map<string, number>()
  const moves = new Map<string, PartMove>()
  const ident = () => ({ quat: new THREE.Quaternion(), pos: new THREE.Vector3(), spin: 0 })

  const kin: Kinematics = {
    derived,
    update(t: number) {
      angles.clear()
      for (const o of order) {
        let th = 0
        if (!o.from) {
          const s = speed.get(o.id)!
          th = s.w * t + s.phase
        } else {
          const a = angles.get(o.from)!
          const l = o.link!
          if (l.kind === 'rigid') th = a
          else if (l.kind === 'gear') th = l.k * a + l.phase
          else if (l.forward) th = near(Math.atan2(Math.sin(a), Math.cos(a) * Math.cos(l.beta)), a)
          else th = near(Math.atan2(Math.sin(a) * Math.cos(l.beta), Math.cos(a)), a)
        }
        angles.set(o.id, th)
      }
      moves.clear()
      for (const id of spinning) {
        const m = ident()
        const a = carrier.get(id)
        // its own turning: about its own axis (a part fixed off its carrier's axis has none of its own)
        if (anchor.get(id) === id) m.spin = (sense.get(id) ?? 1) * (angles.get(id) ?? 0)
        if (a) {
          // carried round the carrier's axis: P₀⁻¹ · R · P₀, R turning θ about the carrier's line
          const R = new THREE.Quaternion().setFromAxisAngle(worldAxis.get(a)!, angles.get(a) ?? 0)
          const c = centers.get(a)!
          const b = base.get(id)!
          const inv = b.quat.clone().invert()
          m.quat = inv.clone().multiply(R).multiply(b.quat)
          m.pos = b.pos.clone().sub(c).applyQuaternion(R).add(c).sub(b.pos).applyQuaternion(inv)
        }
        moves.set(id, m)
      }
      for (const [id, r] of racks) {
        const q0 = base.get(id)!.quat
        const shift = r.dir.clone().multiplyScalar(r.r * (angles.get(r.gear) ?? 0))
        const m = moves.get(id) ?? ident()
        m.pos = shift.applyQuaternion(q0.clone().invert())
        moves.set(id, m)
      }
      if (linkage.length) {
        const now = resolveAssembly(spec, scope, { angles, checks: false }).poses
        for (const p of parts) {
          const b = base.get(p.id)
          const n = now.get(p.id)
          if (!b || !n) continue
          if (b.pos.distanceToSquared(n.pos) < 1e-14 && Math.abs(b.quat.dot(n.quat)) > 1 - 1e-10) continue
          // the part's pose now, seen from where it was drawn: P₀⁻¹ · Pₜ
          const inv = b.quat.clone().invert()
          const m = moves.get(p.id) ?? ident()
          m.quat = inv.clone().multiply(n.quat)
          m.pos = n.pos.clone().sub(b.pos).applyQuaternion(inv)
          moves.set(p.id, m)
          derived.add(p.id)
        }
      }
    },
    move: (id) => moves.get(id) ?? null,
  }
  // find every part a linkage carries along (it shows up once the mechanism has turned), then start at rest
  kin.update(0.37)
  kin.update(0)
  return kin
}
