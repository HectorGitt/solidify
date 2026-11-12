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
  /** the part driving each mechanism (its own speed is used) */
  drivers: Set<string>
  /** works the mechanism out at time t (seconds of model time) */
  update(t: number): void
  /** how a part moves now (after update), or null if it doesn't move by relation */
  move(id: string): PartMove | null
  /** how much slower than real time the model is played so its motion can be followed (1 = real time) */
  pace: number
}

/**
 * How much slower than real time to play a model. Machines turn far faster than a screen can show: at 1,200 rpm
 * a shaft makes a third of a turn between two frames, so its gear teeth and its keyway each strobe their own way
 * and seem to turn at unrelated speeds (and a different way at every rpm). The whole model is slowed by one
 * factor, so ratios hold: slow motion (under 2 rad/s) is left alone; faster is squeezed in under the speed at
 * which the smallest gear's teeth (the fastest gear, as a rule) still read frame to frame, rising gently with the real speed so a faster setting
 * still looks faster.
 */
export function playbackPace(parts: NotePartSpec[], scope: Record<string, number>): number {
  let fastest = 0
  let teeth = 0
  const walk = (list: NotePartSpec[]) => {
    for (const p of list) {
      if (p.motion) {
        const s = Math.abs(evalDim(p.motion.speed, scope, 1))
        const w = p.motion.kind === 'rotate' ? s : s * 2 * Math.PI
        if (Number.isFinite(w)) fastest = Math.max(fastest, w)
      }
      for (const sh of p.shapes) if (GEARS.has(sh.kind) && sh.op !== 'subtract') teeth = Math.min(teeth || Infinity, Math.max(6, Math.round(evalDim(sh.teeth, scope, 20))))
      if (p.children?.length) walk(p.children)
    }
  }
  walk(parts)
  const EASY = 2
  if (fastest <= EASY) return 1
  // a tooth must move well under one pitch per frame (60 a second) to be seen turning the right way
  const top = teeth ? Math.min(12, (0.8 * Math.PI * 60) / teeth) : 12
  // squared, so the settings a slider usually spans (a few hundred to a few thousand rpm) spread out visibly
  const shown = top <= EASY ? top : EASY + (top - EASY) * Math.min(1, Math.log(fastest / EASY) / Math.log(500 / EASY)) ** 2
  return Math.min(1, shown / fastest)
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

const SWINGS = /slotted lever|rocker|rocking lever|quick.?return lever/i
const RIDES = /\bram\b|slotted yoke|scotch.?yoke|yoke slide|\bslide block|tool slide/i
const FIXTURE = /\b(pin|pivot|bearing|bush|bracket|shaft|frame|guide|column|housing|base)\b/i
const LINKAGE_MEMBER = /lever|rocker|\bram\b|yoke|slider|piston|crosshead|rack|follower|rod\b|link\b/i

/**
 * Whether a mechanism will move right in the 3D view, from how it is put together: gears that mesh have the
 * same tooth size, a rack meshes with its pinion, every gear is driven by something, and levers, rams and
 * yokes are driven by their crank (a mount), not animated on their own. `about` is the request (or title), for
 * the mechanisms that need a particular relation (a universal joint, a quick return, a scotch yoke).
 * `checked` is false when the model has no gears or linkages.
 */
export function mechanismProblems(spec: Pick<NoteSceneSpec, 'parts'>, scope: Record<string, number>, about = ''): { checked: boolean; problems: string[] } {
  const problems: string[] = []
  const parts = spec.parts ?? []
  const byId = new Map(parts.map((p) => [p.id, p]))
  const gearOf = (p: NotePartSpec) => {
    const l = lead(p)
    return l && GEARS.has(l.kind) ? l : undefined
  }
  const isRack = (p: NotePartSpec) => p.shapes.some((s) => s.kind === 'rack' && s.op !== 'subtract')
  const gears = parts.filter((p) => gearOf(p))
  const racks = parts.filter(isRack)
  const members = parts.filter((p) => p.role === 'moving' && LINKAGE_MEMBER.test(p.name))
  const wants = { hooke: /universal joint|hooke|cardan/i.test(about), lever: /quick.?return|slotted.?lever|whitworth|shaper/i.test(about), yoke: /scotch.?yoke/i.test(about) }
  const checked = gears.length > 0 || racks.length > 0 || members.length > 0 || wants.hooke || wants.lever || wants.yoke
  if (!checked) return { checked, problems }

  let kin: Kinematics
  try {
    kin = buildKinematics(spec, scope)
  } catch {
    return { checked, problems: ['the mechanism could not be worked out from its mounts'] }
  }

  // meshed gears: the same tooth size
  for (const p of parts) {
    if (p.mount?.kind !== 'mesh') continue
    const t = byId.get(p.mount.target)
    if (!t) continue
    const a = gearOf(p)
    const b = gearOf(t)
    const toothless = [p, t].filter((x) => !gearOf(x) && !isRack(x) && !/worm|screw|spline/i.test(x.name))
    if (toothless.length) {
      // a pulley or plain disc given a mesh is only a placing aid when neither side has teeth
      if (toothless.length === 1) problems.push(`${p.name} meshes with ${t.name}, but ${toothless[0].name} has no teeth`)
    } else if (a && b && a.kind !== 'sprocket' && b.kind !== 'sprocket') {
      const ma = evalDim(a.module, scope, 0.003)
      const mb = evalDim(b.module, scope, 0.003)
      if (Math.abs(ma - mb) > 0.03 * Math.max(ma, mb)) problems.push(`${p.name} and ${t.name} have different tooth sizes (module ${+(ma * 1000).toFixed(2)} and ${+(mb * 1000).toFixed(2)} mm), so they cannot mesh`)
    }
  }
  /** parts already named in a problem */
  const named = new Set<string>()
  // a rack meshes with its pinion
  for (const r of racks) {
    const meshed = r.mount?.kind === 'mesh' || parts.some((p) => p.mount?.kind === 'mesh' && p.mount.target === r.id)
    if (!meshed) {
      problems.push(`${r.name} is not meshed with its pinion, so it cannot slide with it`)
      named.add(r.id)
    }
  }
  // every moving gear is driven by something
  for (const g of gears) {
    if (g.role !== 'moving' && !g.motion) continue
    if (!kin.derived.has(g.id) && !g.motion) problems.push(`${g.name} does not turn: it is not meshed with, or on, anything that turns`)
  }
  // linkages driven by their crank, not animated on their own (one message per part)
  // a lever is a moving part; its pivot pin, bearing or bracket ("rocker pivot pin") is not
  for (const p of parts.filter((x) => SWINGS.test(x.name) && (x.role === 'moving' || !!x.motion) && !FIXTURE.test(x.name)))
    if (p.mount?.kind !== 'lever') {
      problems.push(`${p.name} is not a lever on its crank, so it cannot swing with it`)
      named.add(p.id)
    }
  for (const p of parts.filter((x) => RIDES.test(x.name) && x.role === 'moving'))
    if (!kin.derived.has(p.id) && !named.has(p.id)) {
      problems.push(`${p.name} is not driven: make it a follower of the crank pin or the lever's tip`)
      named.add(p.id)
    }
  for (const p of members) {
    if (kin.derived.has(p.id) || named.has(p.id)) continue
    if (p.motion && p.motion.kind !== 'rotate') problems.push(`${p.name} moves on its own (${p.motion.kind}), not from the part that drives it`)
  }
  if (wants.hooke && !parts.some((p) => p.mount?.kind === 'hooke')) problems.push('the output shaft is not on a universal joint (hooke mount), so it cannot turn by Hooke’s law')
  if (wants.lever && !named.size && !parts.some((p) => p.mount?.kind === 'lever')) problems.push('no slotted lever on the crank (lever mount), so the quick return cannot work')
  if (wants.yoke && !named.size && !parts.some((p) => p.mount?.kind === 'follower' || p.mount?.kind === 'slider')) problems.push('the yoke does not follow the crank pin (follower mount)')
  return { checked, problems: [...new Set(problems)] }
}

export function buildKinematics(spec: Pick<NoteSceneSpec, 'parts'> | null, scope: Record<string, number>): Kinematics {
  const empty: Kinematics = { derived: new Set(), drivers: new Set(), update: () => {}, move: () => null, pace: 1 }
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
  /** a worm's number of starts (0 when the part is not a worm) */
  const wormStarts = (p: NotePartSpec) => {
    const w = p.shapes.find((s) => s.kind === 'worm' && s.op !== 'subtract')
    return w ? Math.max(1, Math.min(4, Math.round(evalDim(w.teeth, scope, 1)))) : 0
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
    // a key is carried round by its shaft whatever role it was given
    if (m?.kind === 'keyed' && t && moving(t) && round(t)) {
      addLink(t.id, p.id, { kind: 'rigid' })
      continue
    }
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
    } else if (m.kind === 'mesh' && (wormStarts(p) || wormStarts(t))) {
      // a worm and its wheel: each turn of the worm moves the wheel on by its number of starts, in teeth
      const worm = wormStarts(p) ? p : t
      const wheel = worm === p ? t : p
      const teeth = Math.max(6, Math.round(evalDim(lead(wheel)?.teeth, scope, 30)))
      const k = wormStarts(worm) / teeth
      addLink(worm.id, wheel.id, { kind: 'gear', k, phase: 0 })
      addLink(wheel.id, worm.id, { kind: 'gear', k: 1 / k, phase: 0 })
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
  /** die blocks: a part carried off its crank's axis, on a crank that drives a lever (block id → lever id) */
  const dieBlocks = new Map<string, string>()
  for (const l of parts) {
    if (l.mount?.kind !== 'lever') continue
    const crankId = l.mount.target
    for (const [id, a] of carrier) if (a === crankId || anchor.get(crankId) === a) if (byId.get(id)?.mount?.target === crankId) dieBlocks.set(id, l.id)
  }

  // parts the assembly re-places as the mechanism turns: linkages, and anything mounted on one
  const linkage = parts.filter((p) => p.mount && LINKAGE.has(p.mount.kind))
  const derived = new Set<string>([...spinning, ...racks.keys(), ...linkage.map((p) => p.id)])
  if (!derived.size) return empty

  const angles = new Map<string, number>()
  const moves = new Map<string, PartMove>()
  const ident = () => ({ quat: new THREE.Quaternion(), pos: new THREE.Vector3(), spin: 0 })

  /** every turning part's angle, from the drivers' (given by `drive`) down the chain of mounts */
  let swing: number | undefined
  const chain = (drive: (s: { w: number; phase: number }) => number) => {
    angles.clear()
    for (const o of order) {
      let th = 0
      if (!o.from) {
        th = drive(speed.get(o.id)!)
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
  }
  const kin: Kinematics = {
    derived,
    drivers: new Set(order.filter((o) => !o.from).map((o) => o.id)),
    update(t: number) {
      // a pinion on a rack cannot turn one way for ever (the rack would run out of the model): the driver
      // swings instead, at its own speed through the middle, far enough for the rack to use most of its length
      if (swing === undefined) {
        swing = 0
        if (racks.size) {
          chain(() => 1)
          let lim = Infinity
          for (const [id, r] of racks) {
            const g = Math.abs(angles.get(r.gear) ?? 0)
            const len = Math.max(...info.get(id)!.box.getSize(new THREE.Vector3()).toArray())
            if (g > 1e-9 && r.r > 1e-9) lim = Math.min(lim, (0.32 * len) / (r.r * g))
          }
          if (Number.isFinite(lim)) swing = lim
        }
      }
      const A = swing
      chain((s) => (A ? A * Math.sin((s.w * t) / A) + s.phase : s.w * t + s.phase))
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
        // a block on a crank pin that a lever slides over (a die block) goes round with the pin but stays lined
        // up with the lever's slot: it turns as the lever turns, about its own centre
        for (const [blockId, leverId] of dieBlocks) {
          const b = base.get(blockId)
          const lb = base.get(leverId)
          const ln = now.get(leverId)
          const a = carrier.get(blockId)
          if (!b || !lb || !ln || !a) continue
          const turn = ln.quat.clone().multiply(lb.quat.clone().invert())
          const R = new THREE.Quaternion().setFromAxisAngle(worldAxis.get(a)!, angles.get(a) ?? 0)
          const c = centers.get(a)!
          const local = info.get(blockId)!.center
          const centre0 = local.clone().applyQuaternion(b.quat).add(b.pos)
          const centre = centre0.sub(c).applyQuaternion(R).add(c)
          const q = turn.multiply(b.quat)
          const origin = centre.sub(local.clone().applyQuaternion(q))
          const inv = b.quat.clone().invert()
          moves.set(blockId, { quat: inv.clone().multiply(q), pos: origin.sub(b.pos).applyQuaternion(inv), spin: 0 })
        }
      }
    },
    move: (id) => moves.get(id) ?? null,
    pace: playbackPace(parts, scope),
  }
  // find every part a linkage carries along (it shows up once the mechanism has turned), then start at rest
  kin.update(0.37)
  kin.update(0)
  return kin
}
