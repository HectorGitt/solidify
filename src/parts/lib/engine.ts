import * as THREE from 'three'
import { box, csg, cylinder, extrude, gear, helixSpring, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { TYPICAL_DIESEL_TIMING, valveLifts, type ValveTiming } from '@/physics/engine'

/**
 * Shared parts library — engine parts: flywheel (always with its starter ring gear), piston with
 * rings and gudgeon pin, connecting rod, crankshaft, cylinder liner, gas columns, valve train
 * (valve, spring, retainer, rocker, pedestal, tappet, pushrod, cam-lobe lift), timing gears,
 * V-pulleys and the in-engine injector.
 *
 * Every builder takes one spec object whose defaults reproduce the reference single-cylinder
 * tractor diesel of the four-stroke scene (bore × stroke 100 × 124 mm, rod 215 mm).
 *
 * Common engine frame: Y up (cylinder axis), crank axis along Z, metres.
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)

/* ------------------------------ flywheel ------------------------------ */

export interface FlywheelSpec {
  /** outer radius of the disc (the ring gear is shrunk on to it) */
  r: number
  /** axial thickness of the rim */
  width?: number
  /** starter ring gear module (tooth size); default 2.9 mm, as on the tractor */
  ringModule?: number
  /** ring-gear face width */
  ringWidth?: number
  /** force a tooth count (to mesh a given starter ratio); its root must clear the disc */
  ringTeeth?: number
  /** bore on to the crank flange or shaft (default 30 mm × r / 150 mm) */
  boreR?: number
}

/** number of ring-gear teeth for a flywheel: the ring's root sits just outside the disc */
export const ringTeethFor = (s: FlywheelSpec) => {
  if (s.ringTeeth) return s.ringTeeth
  const m = s.ringModule ?? 0.0029
  // pitch circle 2.3 modules outside the disc: the root (1.25 m below pitch) clears the rim
  return Math.round((2 * (s.r + 2.3 * m)) / m)
}

/**
 * Flywheel with its starter ring gear. Profile scaled from the four-stroke engine's flywheel
 * (r = 150 mm): a heavy rim, a thinner web, a boss on the crank flange.
 *
 * Local frame: axis along −Z (the flat face that meets the crank flange is at z = 0, the disc
 * extends towards −Z), centred on the crank axis. The ring sits on the rim 2 mm in from that face.
 */
export function flywheel(s: FlywheelSpec) {
  const k = s.r / 0.15
  const w = s.width ?? 0.042 * k
  const bore = s.boreR ?? 0.03 * k
  const disc = xform(
    lathe(
      [
        [bore, 0],
        [s.r, 0],
        [s.r, w],
        [0.12 * k, w],
        [0.11 * k, 0.016 * k],
        [0.06 * k, 0.016 * k],
        [0.055 * k, 0.03 * k],
        [bore, 0.03 * k],
      ],
      96,
    ),
    mat4.rx(-PI / 2),
  )
  const m = s.ringModule ?? 0.0029
  const teeth = ringTeethFor(s)
  const ringWidth = s.ringWidth ?? Math.min(0.016, w * 0.6)
  // gear() is centred on z = 0; seat the ring on the rim, flush with the engine-side face
  const ring = xform(gear({ teeth, module: m, width: ringWidth, bore: s.r, flankPoints: 4 }), mat4.t(0, 0, -ringWidth / 2 - 0.002))
  return { disc, ring, teeth, ringWidth }
}

/* ------------------------------ piston ------------------------------ */

/** Re-entrant direct-injection combustion bowl, (r, depth below crown), of the reference engine. */
export const REENTRANT_BOWL: V2[] = [
  [0, 0],
  [0.025, 0],
  [0.0278, 0.009],
  [0.022, 0.016],
  [0.01, 0.016],
  [0, 0.01],
]

export interface PistonSpec {
  bore?: number
  /** gudgeon-pin centre to crown */
  comp?: number
  /** gudgeon-pin centre to skirt bottom */
  skirt?: number
  /** radial clearance to the bore */
  clearance?: number
  /** gudgeon-pin (bore) radius */
  pinR?: number
  /** pin-boss radius */
  bossR?: number
  /** crown thickness on the axis (depth of the cavity ceiling below the crown) */
  crownT?: number
  /** skirt wall thickness */
  wall?: number
  /** ring grooves, bottom to top: [depth of the groove centre below the crown, groove width] */
  grooves?: V2[]
  /** radial groove depth */
  grooveDepth?: number
  /** combustion bowl in the crown, (r, depth) from the axis outwards; null for a flat crown */
  bowl?: V2[] | null
  /** width of the slot between the pin bosses (takes the small end) */
  slotW?: number
  /** when the lowest groove carries an oil-control ring (default: three or more grooves) */
  oilRing?: boolean
}

function pistonSpec(s: PistonSpec = {}) {
  const bore = s.bore ?? 0.1
  const k = bore / 0.1
  const pinR = s.pinR ?? 0.014 * k
  return {
    bore,
    k,
    comp: s.comp ?? 0.062 * k,
    skirt: s.skirt ?? 0.043 * k,
    clearance: s.clearance ?? 0.0004 * k,
    pinR,
    bossR: s.bossR ?? pinR * (19 / 14),
    crownT: s.crownT ?? 0.03 * k,
    wall: s.wall ?? 0.0055 * k,
    grooves:
      s.grooves ??
      ([
        [0.026 * k, 0.004 * k],
        [0.017 * k, 0.0026 * k],
        [0.009 * k, 0.0026 * k],
      ] as V2[]),
    grooveDepth: s.grooveDepth ?? 0.0042 * k,
    bowl: s.bowl === undefined ? REENTRANT_BOWL : s.bowl,
    slotW: s.slotW ?? 0.031 * k,
    oilRing: s.oilRing,
  }
}

/**
 * Piston body: ring grooves, hollow skirt, pin bosses with the gudgeon-pin bore, slot for the
 * small end and (optionally) a combustion bowl. Origin at the gudgeon-pin centre, axis +Y, pin
 * along Z. Uses CSG, so build it in the geometry worker.
 */
export function piston(spec: PistonSpec = {}) {
  const s = pistonSpec(spec)
  const b = s.bore
  const R = b / 2 - s.clearance
  const top = s.comp
  const bottom = -s.skirt
  const d = s.grooveDepth
  // CCW in the (r, y) half-plane: cavity ceiling → inner skirt → skirt bottom → outer wall → crown → bowl → axis
  const prof: V2[] = [
    [0, top - s.crownT],
    [0.22 * b, top - s.crownT],
    [R - s.wall, top - s.crownT - 0.06 * b],
    [R - s.wall, bottom],
    [R, bottom],
  ]
  for (const [gd, w] of s.grooves) {
    const gy = top - gd
    prof.push([R, gy - w / 2], [R - d, gy - w / 2], [R - d, gy + w / 2], [R, gy + w / 2])
  }
  prof.push([R, top])
  if (s.bowl) for (let i = 1; i < s.bowl.length; i++) prof.push([s.bowl[i][0], top - s.bowl[i][1]])
  else prof.push([0, top])
  const body = lathe(prof, 72)
  const boss = xform(cylinder(s.bossR, 2 * (R - 0.004 * s.k), 32), alongZ)
  const slotTop = top - s.crownT - 0.06 * b
  const slotH = 0.86 * b
  const slot = xform(box(0.8 * b, slotH, s.slotW), mat4.t(0, slotTop - slotH / 2, 0))
  const pinHole = xform(cylinder(s.pinR, 2 * b, 32), alongZ)
  return csg(body, [
    { op: 'add', geometry: boss },
    { op: 'sub', geometry: slot },
    { op: 'sub', geometry: pinHole },
  ])
}

/** Piston rings in the piston's grooves (same frame as piston()). Oil ring: the lowest groove. */
export function pistonRings(spec: PistonSpec = {}) {
  const s = pistonSpec(spec)
  const R = s.bore / 2
  const inner = R - (s.grooveDepth - 0.0002 * s.k)
  const ring = (gd: number, w: number) => {
    const y = s.comp - gd
    const h = w - 0.0002 * s.k
    return lathe([[inner, y - h / 2], [R - 0.00005, y - h / 2], [R - 0.00005, y + h / 2], [inner, y + h / 2]], 72)
  }
  const oil = s.oilRing ?? s.grooves.length >= 3
  const comp = (oil ? s.grooves.slice(1) : s.grooves).map(([gd, w]) => ring(gd, w))
  return { compression: merge(...comp), oil: oil ? ring(s.grooves[0][0], s.grooves[0][1]) : null }
}

/** Hollow gudgeon pin along Z, centred on the origin (the piston frame). */
export function gudgeonPin(spec: PistonSpec = {}) {
  const s = pistonSpec(spec)
  return xform(tube(s.pinR - 0.0001, s.pinR * (0.008 / 0.014), 2 * (s.bore / 2 - 0.006 * s.k), 32), alongZ)
}

/** Piston, rings and pin together. */
export function pistonAssembly(spec: PistonSpec = {}) {
  return { body: piston(spec), rings: pistonRings(spec), pin: gudgeonPin(spec) }
}

/* ------------------------------ connecting rod ------------------------------ */

export interface ConRodSpec {
  /** centre distance big end → small end */
  length?: number
  /** crank-pin radius */
  pinR?: number
  /** gudgeon-pin radius */
  gudgeonR?: number
  /** width along the crank axis */
  width?: number
}

const rodSpec = (s: ConRodSpec = {}) => {
  const pinR = s.pinR ?? 0.028
  const gudgeonR = s.gudgeonR ?? 0.014
  const k = pinR / 0.028
  const ks = gudgeonR / 0.014
  return {
    L: s.length ?? 0.215,
    pinR,
    gudgeonR,
    width: s.width ?? 0.028,
    k,
    big: 0.043 * k,
    bore: pinR + 0.0025 * k,
    small: 0.021 * ks,
    smallBore: 0.0145 * ks,
    shank: 0.0115 * ks,
    neck: 0.03 * ks,
  }
}

/** shank and small end, continuing a CCW outline from the big end's right flank */
function rodUpper(r: ReturnType<typeof rodSpec>, sh: THREE.Shape) {
  sh.lineTo(r.shank, r.L - r.neck)
  sh.absarc(0, r.L, r.small, -1.0, PI + 1.0, false)
  sh.lineTo(-r.shank, r.L - r.neck)
}

/**
 * Connecting rod with a bolted, split big end: body, cap, two bolts, bearing shells and the
 * small-end bush. Local frame: big-end centre at the origin, small end at +Y·length, width along Z
 * (centred on z = 0); the cap is below the split line y = 0.
 */
export function conRod(spec: ConRodSpec = {}) {
  const r = rodSpec(spec)
  const { big, bore, k } = r
  const s = new THREE.Shape()
  // start on the split line at the right, go up the big end, shank, small end, back down
  s.moveTo(big, 0)
  s.absarc(0, 0, big, 0, 1.18, false)
  rodUpper(r, s)
  s.lineTo(-big * Math.cos(1.18), big * Math.sin(1.18))
  s.absarc(0, 0, big, PI - 1.18, PI, false)
  s.lineTo(-bore, 0)
  s.absarc(0, 0, bore, PI, 0, true)
  s.lineTo(big, 0)
  const small = new THREE.Path()
  small.absarc(0, r.L, r.smallBore, 0, PI * 2, true)
  s.holes.push(small)
  const body = extrude(s, r.width, { curveSegments: 40 })
  const capS = new THREE.Shape()
  capS.moveTo(big, 0)
  capS.lineTo(bore, 0)
  capS.absarc(0, 0, bore, 0, -PI, true)
  capS.lineTo(-big, 0)
  capS.absarc(0, 0, big, PI, PI * 2, false)
  const cap = extrude(capS, r.width, { curveSegments: 40 })
  const bx = 0.0365 * k
  const boltHoles = [bx, -bx].map((x) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0042 * k, 0.1 * k, 16), mat4.t(x, 0, 0)) }))
  const bolts = merge(...[bx, -bx].map((x) => xform(cylinder(0.0039 * k, 0.066 * k, 16), mat4.t(x, -0.004 * k, 0))))
  const h = (r.width - 0.001) / 2
  const shells = lathe(
    [
      [r.pinR, -h],
      [bore - 0.0001, -h],
      [bore - 0.0001, h],
      [r.pinR, h],
    ],
    48,
  )
  return {
    body: csg(body, boltHoles),
    cap: csg(cap, boltHoles),
    bolts,
    shells: xform(shells, alongZ),
    bush: xform(tube(r.smallBore, r.gudgeonR, r.width, 32), mat4.c(mat4.t(0, r.L, 0), alongZ)),
  }
}

/**
 * One-piece connecting rod for a built-up (pressed) crankshaft, as on small two-strokes: the big
 * end is a solid eye running on a needle-roller cage. Same frame as conRod().
 */
export function conRodOnePiece(spec: ConRodSpec = {}) {
  const r = rodSpec(spec)
  const { big, bore } = r
  const s = new THREE.Shape()
  s.moveTo(big * Math.cos(1.18), big * Math.sin(1.18))
  rodUpper(r, s)
  s.lineTo(-big * Math.cos(1.18), big * Math.sin(1.18))
  s.absarc(0, 0, big, PI - 1.18, 2 * PI + 1.18, false)
  const h1 = new THREE.Path()
  h1.absarc(0, 0, bore, 0, PI * 2, true)
  const h2 = new THREE.Path()
  h2.absarc(0, r.L, r.smallBore, 0, PI * 2, true)
  s.holes.push(h1, h2)
  return {
    body: extrude(s, r.width, { curveSegments: 40 }),
    /** needle-roller cage between the pin and the eye */
    bearing: xform(tube(bore - 0.0001, r.pinR, r.width - 0.001, 40), alongZ),
    bush: xform(tube(r.smallBore, r.gudgeonR, r.width, 32), mat4.c(mat4.t(0, r.L, 0), alongZ)),
  }
}

/* ------------------------------ crankshaft ------------------------------ */

export interface CrankSpec {
  /** crank radius (half stroke) */
  r: number
  pinR: number
  journalR: number
  /** web thickness (along Z) */
  webT: number
  /** counterweight radius (disc radius for disc webs) */
  cwR: number
  /** pin length between the webs */
  pinLen: number
  /** boss round the pin on a counterweight web (default 1.25 × pinR) */
  bossR?: number
  /** 'counterweight' (forged throw) or 'disc' (built-up crank: full-circle webs with lightening holes) */
  web?: 'counterweight' | 'disc'
}

/** The reference engine's single throw. */
export const CRANK_REF: CrankSpec = { r: 0.062, pinR: 0.028, journalR: 0.03, webT: 0.014, cwR: 0.079, pinLen: 0.03, bossR: 0.034 }

/** One web, in XY with its thickness along Z (centred on z = 0); pin at +Y. */
export function crankWeb(s: CrankSpec) {
  const sh = new THREE.Shape()
  if (s.web === 'disc') {
    sh.absarc(0, 0, s.cwR, 0, PI * 2, false)
    // lightening holes on the pin side balance the throw
    const q = s.cwR / 0.036
    for (const x of [0.021 * q, -0.021 * q]) {
      const h = new THREE.Path()
      h.absarc(x, 0.012 * q, 0.006 * q, 0, PI * 2, true)
      sh.holes.push(h)
    }
    return extrude(sh, s.webT, { curveSegments: 56 })
  }
  const a0 = PI / 2 + PI - 0.95
  const a1 = PI / 2 + PI + 0.95
  const boss = s.bossR ?? s.pinR * 1.25
  sh.absarc(0, 0, s.cwR, a0, a1, false)
  sh.lineTo(boss * Math.cos(0.35), s.r + boss * Math.sin(0.35))
  sh.absarc(0, s.r, boss, 0.35, PI - 0.35, false)
  sh.lineTo(s.cwR * Math.cos(a0), s.cwR * Math.sin(a0))
  return extrude(sh, s.webT, { curveSegments: 32 })
}

/** A single throw (two webs + pin), pin at +Y, centred on z = 0. */
export function crankThrow(s: CrankSpec) {
  const w = crankWeb(s)
  const off = s.pinLen / 2 + s.webT / 2
  const pin = xform(cylinder(s.pinR, s.pinLen + 0.002, 40), mat4.c(mat4.t(0, s.r, 0), alongZ))
  return merge(xform(w, mat4.t(0, 0, off)), xform(w, mat4.t(0, 0, -off)), pin)
}

export interface ThrowPlacement {
  z: number
  /** firing angle φ (deg). The pin sits at −φ so that the piston reaches TDC when the crank has turned φ. */
  firingDeg: number
}

export interface CrankshaftOptions {
  /** length of the two end journals, which then start at the outer web faces (default: as long as the inner ones, centred half a pitch out) */
  outerMainLen?: number
  /** front nose for the pulley and timing gear (+Z); null for none */
  nose?: { r: number; len: number; inset?: number } | null
  /** rear flange for the flywheel (−Z), optionally with a spigot beyond it; null for none */
  tail?: { r: number; t: number; spigotR?: number; spigotLen?: number } | null
}

/**
 * Whole crankshaft: throws, main journals between and outside them, a nose for the pulley (+Z)
 * and a flange for the flywheel (−Z). Crank axis Z. Returns where the nose ends (`front`) and the
 * flywheel face of the flange (`back`).
 */
export function crankshaft(s: CrankSpec, throws: ThrowPlacement[], pitch: number, o: CrankshaftOptions = {}) {
  const t = crankThrow(s)
  const parts: THREE.BufferGeometry[] = []
  for (const th of throws) parts.push(xform(t, mat4.c(mat4.t(0, 0, th.z), mat4.rz((-th.firingDeg * PI) / 180))))
  const zs = throws.map((th) => th.z).sort((a, b) => a - b)
  const span = s.pinLen / 2 + s.webT
  const jLen = pitch - 2 * span + 0.004
  const journal = (z: number, len: number) => parts.push(xform(cylinder(s.journalR, len, 40), mat4.c(mat4.t(0, 0, z), alongZ)))
  for (let i = 1; i < zs.length; i++) journal((zs[i - 1] + zs[i]) / 2, jLen)
  let front: number
  let back: number
  if (o.outerMainLen) {
    const L = o.outerMainLen
    journal(zs[0] - span - L / 2, L)
    journal(zs[zs.length - 1] + span + L / 2, L)
    front = zs[zs.length - 1] + span + L
    back = zs[0] - span - L
  } else {
    journal(zs[0] - pitch / 2, jLen)
    journal(zs[zs.length - 1] + pitch / 2, jLen)
    front = zs[zs.length - 1] + pitch / 2 + jLen / 2
    back = zs[0] - pitch / 2 - jLen / 2
  }
  const nose = o.nose === undefined ? { r: s.journalR * 0.75, len: 0.06 } : o.nose
  if (nose) {
    const z0 = front - (nose.inset ?? 0)
    parts.push(xform(cylinder(nose.r, nose.len, 32), mat4.c(mat4.t(0, 0, z0 + nose.len / 2), alongZ)))
    front = z0 + nose.len
  }
  const tail = o.tail === undefined ? { r: s.journalR * 1.6, t: 0.012 } : o.tail
  if (tail) {
    const prof: V2[] = [
      [0, 0],
      [tail.r, 0],
      [tail.r, tail.t],
    ]
    if (tail.spigotR && tail.spigotLen) prof.push([tail.spigotR, tail.t], [tail.spigotR, tail.t + tail.spigotLen], [0, tail.t + tail.spigotLen])
    else prof.push([0, tail.t])
    parts.push(xform(lathe(prof, 40), mat4.c(mat4.t(0, 0, back), mat4.rx(-PI / 2))))
    back -= tail.t
  }
  return { geometry: merge(...parts), front, back }
}

/** Main-journal z positions for a crank laid out with `crankshaft()` (default end journals). */
export function mainJournalZ(throwZ: number[], pitch: number) {
  const zs = [...throwZ].sort((a, b) => a - b)
  const out: number[] = [zs[0] - pitch / 2]
  for (let i = 1; i < zs.length; i++) out.push((zs[i - 1] + zs[i]) / 2)
  out.push(zs[zs.length - 1] + pitch / 2)
  return out
}

/* ------------------------------ cylinder ------------------------------ */

/** Cylinder liner (sleeve) from y0 up to y1, axis Y. `outer` is the liner's seat in the block. */
export function cylinderLiner(s: { bore?: number; outer?: number; y0?: number; y1?: number; segments?: number } = {}) {
  const ri = (s.bore ?? 0.1) / 2
  const ro = (s.outer ?? 0.056) - 0.0002
  const y0 = s.y0 ?? 0.1
  const y1 = s.y1 ?? 0.339
  return lathe(
    [
      [ri, y0],
      [ro, y0],
      [ro, y1],
      [ri, y1],
    ],
    s.segments ?? 64,
  )
}

/** Unit-height column of cylinder gas (y 0 … 1), scaled to the live space above the crown. */
export function gasColumn(bore = 0.1, s: { clearance?: number; segments?: number } = {}) {
  const r = bore / 2 - (s.clearance ?? 0.0002)
  return lathe([[0, 0], [r, 0], [r, 1], [0, 1]], s.segments ?? 64)
}

/** Gas filling a crown bowl (moves with the piston); origin at the crown, bowl below. */
export function bowlGas(bowl: V2[] = REENTRANT_BOWL) {
  return lathe(bowl.map(([r, d]) => [Math.max(0, r - 0.0002), -d + 0.0002] as V2).reverse(), 48)
}

/* ------------------------------ valve train ------------------------------ */

/** Poppet valve, head face at y = 0, stem up to y = length. */
export function valve(s: { headR?: number; stemR?: number; length?: number } = {}) {
  const r = s.headR ?? 0.02
  const st = s.stemR ?? 0.0045
  const L = s.length ?? 0.138
  return lathe(
    [
      [0, 0],
      [r, 0],
      [r, 0.0022],
      [r - 0.0035, 0.0052],
      [st + 0.0025, 0.014],
      [st, 0.022],
      [st, L],
      [0, L],
    ],
    40,
  )
}

/** Valve spring of unit length along Y from y = 0 (scale Y to the installed length). */
export function valveSpring(s: { coilR?: number; wireR?: number; turns?: number } = {}) {
  return helixSpring(s.coilR ?? 0.0125, s.wireR ?? 0.0021, 1, s.turns ?? 6)
}

/** Spring retainer (cap) round the valve stem; bottom face at y = 0. */
export function valveRetainer(s: { stemR?: number; r?: number } = {}) {
  const st = s.stemR ?? 0.0045
  const r = s.r ?? 0.0155
  return lathe([[st, 0], [r, 0.0], [r, 0.003], [0.0085, 0.009], [st, 0.009]], 32)
}

/**
 * Rocker arm, side profile in XY extruded along Z (centred): pivot at the origin, pushrod end at
 * −armPush, valve end at +armValve.
 */
export function rocker(s: { armPush?: number; armValve?: number; pivotR?: number; width?: number } = {}) {
  const sh = new THREE.Shape()
  const a = s.armPush ?? 0.028
  const b = s.armValve ?? 0.042
  sh.moveTo(-a - 0.006, -0.002)
  sh.lineTo(-a - 0.006, 0.006)
  sh.quadraticCurveTo(-a * 0.4, 0.013, 0, 0.012)
  sh.quadraticCurveTo(b * 0.55, 0.011, b + 0.002, 0.004)
  sh.quadraticCurveTo(b + 0.008, 0.0, b + 0.004, -0.007)
  sh.lineTo(b - 0.006, -0.008)
  sh.quadraticCurveTo(b * 0.5, -0.006, 0, -0.011)
  sh.quadraticCurveTo(-a * 0.5, -0.008, -a - 0.006, -0.002)
  const pivot = new THREE.Path()
  pivot.absarc(0, 0, s.pivotR ?? 0.0062, 0, PI * 2, true)
  sh.holes.push(pivot)
  return extrude(sh, s.width ?? 0.012, { curveSegments: 16 })
}

/** Rocker-shaft pedestal block, centred on the origin. */
export function rockerPedestal(s: { height?: number; w?: number; d?: number } = {}) {
  return box(s.w ?? 0.014, s.height ?? 0.051, s.d ?? 0.012)
}

/** Mushroom tappet (cam follower): foot at y = 0, pushrod cup on top. */
export function tappet(s: { r?: number; h?: number } = {}) {
  const r = s.r ?? 0.011
  const h = s.h ?? 0.032
  return lathe([[0, 0], [r, 0], [r, h], [0.006, h], [0.004, h - 0.004], [0, h - 0.004]], 32)
}

/** Pushrod of unit length along Y (scale Y to the length). */
export function pushrod(s: { r?: number } = {}) {
  const r = s.r ?? 0.0042
  const e = r * (0.0035 / 0.0042)
  return lathe([[0, 0], [e, 0.0], [r, 0.02], [r, 0.98], [e, 1], [0, 1]], 16)
}

/**
 * Cam-lobe lift (tappet lift, m) as a function of cam angle φ, from the valve-timing diagram:
 * cam angle φ ↔ crank angle 2φ; tappet lift = valve lift / rocker ratio. Feed it to `cam()`.
 */
export function lobeLift(which: 'inlet' | 'exhaust', s: { timing?: ValveTiming; rockerRatio?: number } = {}) {
  const vt = s.timing ?? TYPICAL_DIESEL_TIMING
  const rr = s.rockerRatio ?? 0.042 / 0.028
  return (phi: number) => {
    const deg = ((phi * 2 * 180) / PI) % 720
    return valveLifts(deg < 0 ? deg + 720 : deg, vt)[which] / rr
  }
}

/** Crank and cam timing gears (2 : 1), each centred on z = 0, axis Z. */
export function timingGears(s: { module?: number; crankTeeth?: number; camTeeth?: number; width?: number; crankBore?: number; camBore?: number } = {}) {
  const m = s.module ?? 0.0035
  const w = s.width ?? 0.014
  const crank = gear({ teeth: s.crankTeeth ?? 22, module: m, width: w, bore: s.crankBore ?? 0.02 })
  const camG = gear({ teeth: s.camTeeth ?? 44, module: m, width: w, bore: s.camBore ?? 0.0105 })
  return { crank, cam: camG }
}

/* ------------------------------ pulleys ------------------------------ */

export interface VPulleySpec {
  /** rim radius */
  r: number
  bore?: number
  /** number of V-grooves (side by side, sharing their crests) */
  grooves?: number
  /** groove width at the rim and radial depth */
  grooveW?: number
  grooveDepth?: number
  /** flat land before the first groove */
  land?: number
  /** total width (default: land + grooves + land) */
  width?: number
  /** centre the pulley on z = 0 instead of spanning z = 0 … width */
  centred?: boolean
  segments?: number
}

/**
 * V-belt pulley, axis Z. Defaults: the reference engine's crankshaft pulley (r = 72 mm, one
 * groove). Spans z = 0 … width towards +Z unless `centred`.
 */
export function vPulley(spec: VPulleySpec = { r: 0.072 }) {
  const r = spec.r
  const land = spec.land ?? 0.004
  const gw = spec.grooveW ?? 0.016
  const d = spec.grooveDepth ?? 0.014
  const n = spec.grooves ?? 1
  const W = spec.width ?? land + n * gw + land
  const bore = spec.bore ?? 0.02
  const prof: V2[] = [
    [bore, 0],
    [r, 0],
    [r, land],
  ]
  for (let i = 0; i < n; i++) prof.push([r - d, land + i * gw + gw / 2], [r, land + (i + 1) * gw])
  if (W > land + n * gw + 1e-9) prof.push([r, W])
  prof.push([bore, W])
  const g = xform(lathe(prof, spec.segments ?? 64), alongZ)
  return spec.centred ? xform(g, mat4.t(0, 0, -W / 2)) : g
}

/* ------------------------------ injector ------------------------------ */

/**
 * In-engine fuel injector (nozzle and holder in one body with its needle and spring). Local frame:
 * nozzle tip at the origin, axis +Y, body 140 mm long × `scale`. The spring is unit length.
 * The sectioned workshop injector with spindle and adjusting screw is `injectorHolder` in
 * engineFuel.ts.
 */
export function injector(s: { scale?: number } = {}) {
  const k = s.scale ?? 1
  const L = 0.14
  const body = lathe(
    [
      [0.0, 0],
      [0.0035, 0],
      [0.0042, 0.012],
      [0.0085, 0.02],
      [0.0085, 0.085],
      [0.0115, 0.088],
      [0.0115, 0.12],
      [0.006, 0.124],
      [0.006, L],
      [0.003, L],
      [0.003, 0.124],
      // inner bore for the needle & spring
      [0.0042, 0.12],
      [0.0042, 0.03],
      [0.0019, 0.012],
      [0, 0.006],
    ],
    32,
  )
  const needle = lathe([[0, 0.0065], [0.0019, 0.0125], [0.0026, 0.03], [0.0026, 0.07], [0, 0.07]], 20)
  const spring = helixSpring(0.0031, 0.0007, 1, 9)
  if (k === 1) return { body, needle, spring }
  const m = new THREE.Matrix4().makeScale(k, k, k)
  return { body: xform(body, m), needle: xform(needle, m), spring: xform(spring, new THREE.Matrix4().makeScale(k, 1, k)) }
}
