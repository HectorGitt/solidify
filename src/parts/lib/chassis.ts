import * as THREE from 'three'
import { box, cylinder, extrudeTwisted, lathe, mat4, merge, roundedBox, tube, xform, type V2 } from '@/geometry'

/**
 * Shared parts library — chassis, hitch, operator-station and test-equipment parts: springs and
 * dampers, seats and cab mounts, drawbar and hitch links, load cells and gauges, and the
 * absorbers of dynamometers. Each builder documents its local frame. All solids are closed.
 */

const { PI, cos, sin } = Math
/** lathe frame (axis +Y) → axis +X */
const alongX = (g: THREE.BufferGeometry) => xform(g, mat4.rz(-PI / 2))
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => xform(g, mat4.t(x, y, z))

/* ================================================================== springs & dampers */

export { coilSpring } from './elements'

export { telescopicDamper } from './elements'

export interface DashpotSpec {
  /** cup outer and inner (bore) radius */
  wallR?: number
  boreR?: number
  /** cup height and floor thickness */
  height?: number
  floor?: number
  /** oil column height */
  oilH?: number
  /** rod-gland ring: outer, inner radius, bottom y and thickness */
  glandR?: number
  glandIn?: number
  glandY?: number
  glandH?: number
  /** perforated piston */
  pistonR?: number
  pistonT?: number
  orifices?: number
  orificeR?: number
  orificeCircle?: number
}

/**
 * Viscous dashpot (laboratory damper): open oil cup, rod gland and a perforated piston.
 * Frame: axis +Y, the cup's base on y = 0. The piston is centred on its own origin (place it on
 * the rod). Defaults: the spring–mass–damper rig.
 */
export function dashpot(spec: DashpotSpec = {}) {
  const wallR = spec.wallR ?? 0.032
  const boreR = spec.boreR ?? 0.027
  const H = spec.height ?? 0.17
  const fl = spec.floor ?? 0.01
  const oilH = spec.oilH ?? 0.155
  const gY = spec.glandY ?? 0.165
  const gH = spec.glandH ?? 0.015
  const cup = lathe(
    [
      [0, 0],
      [wallR, 0],
      [wallR, H],
      [boreR, H],
      [boreR, fl],
      [0, fl],
    ],
    48,
  )
  const gland = lathe(
    [
      [spec.glandIn ?? 0.0075, gY],
      [spec.glandR ?? 0.034, gY],
      [spec.glandR ?? 0.034, gY + gH],
      [spec.glandIn ?? 0.0075, gY + gH],
    ],
    48,
  )
  const oil = xform(cylinder(boreR - 0.0002, oilH, 40), mat4.t(0, fl + oilH / 2, 0))
  const circle = (r: number, cx = 0, cy = 0, n = 40) => Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + r * cos((2 * PI * i) / n), cy + r * sin((2 * PI * i) / n)))
  const n = spec.orifices ?? 4
  const rc = spec.orificeCircle ?? 0.015
  const holes = Array.from({ length: n }, (_, i) => circle(spec.orificeR ?? 0.0032, rc * cos((i * 2 * PI) / n + 0.6), rc * sin((i * 2 * PI) / n + 0.6), 16).reverse())
  const piston = extrudeTwisted(circle(spec.pistonR ?? 0.0262), holes, spec.pistonT ?? 0.014)
  piston.rotateX(PI / 2)
  return { cup, gland, oil, piston }
}

/* ================================================================== operator station */

/**
 * Tractor operator seat: pan, raked back and their cushions. Frame: origin on the underside of
 * the pan at its centre, +X forward, Y up; the back is at −X.
 */
export function operatorSeat() {
  return {
    pan: xform(roundedBox(0.44, 0.04, 0.46, 0.012), mat4.t(0, 0.02, 0)),
    back: xform(roundedBox(0.05, 0.5, 0.44, 0.02), mat4.c(mat4.t(-0.24, 0.3, 0), mat4.rz(0.18))),
    cushion: xform(roundedBox(0.44, 0.07, 0.46, 0.03), mat4.t(0, 0.075, 0)),
    backCushion: xform(roundedBox(0.06, 0.44, 0.42, 0.025), mat4.c(mat4.t(-0.19, 0.33, 0), mat4.rz(0.18))),
  }
}

/** The whole seat as one geometry (shell + cushions), same frame as operatorSeat. */
export function operatorSeatMerged() {
  const s = operatorSeat()
  return merge(s.pan, s.back, s.cushion, s.backCushion)
}

/**
 * Scissor seat-suspension hardware: base plate on the platform (origin on the platform, top of
 * the plate at y = 0.03), rubber travel stops, and one scissor bar (centred; place and rotate
 * each bar of the linkage).
 */
export function seatSuspension() {
  return {
    basePlate: xform(box(0.38, 0.03, 0.42), mat4.t(0, 0.015, 0)),
    stops: merge(...[-0.13, 0.13].map((x) => xform(cylinder(0.022, 0.03, 20), mat4.t(x, 0.045, 0.17)))),
    bar: box(0.34, 0.022, 0.018),
  }
}

/**
 * Rubber cab (or engine) isolation mount: a waisted rubber block bonded between two steel
 * plates. Axis Y, centred on the origin, radius r, height h.
 */
export function cabMount(r = 0.05, h = 0.06) {
  const p = Math.min(0.008, h * 0.15)
  const prof: V2[] = [
    [0, -h / 2],
    [r, -h / 2],
    [r, -h / 2 + p],
    [r * 0.82, -h / 2 + p],
    [r * 0.7, 0],
    [r * 0.82, h / 2 - p],
    [r, h / 2 - p],
    [r, h / 2],
    [0, h / 2],
  ]
  return lathe(prof, 24)
}

/* ================================================================== drawbar & hitch */

/**
 * Adjustable drawbar for the shared tractor frame (+X forward, Y up, origin on the ground below
 * the rear axle): beam from under the centre housing (0.25, 0.42) to the pin at (−xd, yd), a
 * hanger strap, and the hitch pin (axis Y).
 */
export function adjustableDrawbar(xd: number, yd: number) {
  const a = new THREE.Vector3(0.25, 0.42, 0)
  const pin = new THREE.Vector3(-xd, yd, 0)
  const d = new THREE.Vector3().subVectors(pin, a)
  const beam = box(d.length(), 0.05, 0.1)
  beam.rotateZ(Math.atan2(d.y, d.x))
  beam.translate((a.x + pin.x) / 2, (a.y + pin.y) / 2, 0)
  const hanger = box(0.04, Math.abs(0.62 - yd) + 0.06, 0.14)
  hanger.translate(-Math.min(xd, 0.45), (0.62 + yd) / 2, 0)
  const p = cylinder(0.022, 0.16, 16)
  p.translate(-xd, yd, 0)
  return { beam, hanger, pin: p }
}

/**
 * Clevis eye: a flat plate of length len along X (negative len runs towards −X) ending in a round
 * boss of radius r at (x, y), pin axis Z, plate thickness t.
 */
export function clevisEye(x: number, y: number, len: number, t: number, r: number) {
  const plate = box(Math.abs(len), r * 1.6, t)
  plate.translate(x + len / 2, y, 0)
  const boss = cylinder(r, t * 1.4, 24)
  boss.rotateX(PI / 2)
  boss.translate(x, y, 0)
  return merge(plate, boss)
}

export interface StrainLinkSpec {
  /** distance between the two eye (pin) centres */
  span: number
  /** gauged body: radius and length */
  bodyR?: number
  bodyL?: number
  /** eye plate length, thickness and boss radius */
  eyeLen?: number
  eyeT?: number
  eyeR?: number
  /** signal-cable connector on top of the body */
  connector?: boolean
}

/**
 * Strain-gauge tension link (drawbar load cell): a gauged cylindrical body between two clevis
 * eyes. Frame: along X, centred on the origin, eyes at x = ±span/2, pins along Z; the connector
 * stands up +Y.
 */
export function strainLink(s: StrainLinkSpec) {
  const h = s.span / 2
  const t = s.eyeT ?? 0.03
  const r = s.eyeR ?? 0.03
  const L = s.eyeLen ?? 0.08
  const bodyR = s.bodyR ?? 0.035
  const body = xform(cylinder(bodyR, s.bodyL ?? 0.2, 32), mat4.rz(PI / 2))
  const parts = [body, clevisEye(h, 0, -L, t, r), clevisEye(-h, 0, L, t, r)]
  if (s.connector ?? true) parts.push(xform(cylinder(0.012, 0.06, 12), mat4.t(0, bodyR + 0.015, 0)))
  return merge(...parts)
}

/**
 * Column (compression) load cell on a stand: loading platen at the top (its top face at y = 0),
 * gauged column, base plate at y ≈ −0.49.
 */
export function columnLoadCell() {
  return merge(at(box(0.16, 0.06, 0.16), 0, -0.03, 0), at(box(0.06, 0.4, 0.06), 0, -0.26, 0), at(box(0.2, 0.03, 0.2), 0, -0.475, 0))
}

/** Gauge dial (pressure gauge, spring dial): a short drum with a bezel, face towards +Z, centred. */
export function dialGauge(r: number, depth: number) {
  return lathe(
    [
      [0, -depth / 2],
      [r, -depth / 2],
      [r, depth / 2],
      [r * 0.9, depth / 2],
      [r * 0.9, depth / 2 - 0.004],
      [0, depth / 2 - 0.004],
    ],
    40,
  ).rotateX(PI / 2)
}

/** Gauge needle: thin bar pointing +Y from its pivot at the origin. */
export function gaugeNeedle(len: number, w = 0.006, t = 0.003) {
  const g = box(w, len, t)
  g.translate(0, len / 2 - len * 0.12, 0)
  return g
}

/** Spring balance (hanging scale): body with a dial face (+X), hook rod below and hanger rod above. Origin at the hook end. */
export function springBalance() {
  const body = at(cylinder(0.032, 0.2, 24), 0, 0.27, 0)
  const face = at(xform(cylinder(0.026, 0.006, 24), mat4.rz(PI / 2)), 0.033, 0.29, 0)
  const hook = at(cylinder(0.004, 0.17, 8), 0, 0.085, 0)
  const top = at(cylinder(0.004, 0.32, 8), 0, 0.53, 0)
  return { body: merge(body, face), rods: merge(hook, top) }
}

/* ================================================================== dynamometer absorbers */

export interface AbsorberSpec {
  /** outer radius of the casing */
  R: number
  /** half the axial length */
  half: number
  /** working-cavity radius */
  cav: number
  /** shaft bore */
  bore: number
  /** axial stations of the stator fins (empty for an eddy-current or DC frame) */
  fins?: number[]
  /** inner tip radius of the fins */
  finTip?: number
  /** end-wall thickness (default 0.03) */
  wall?: number
}

/** Revolved (r, axial) profile of an absorber casing with internal fins; CCW. */
export function absorberProfile(s: AbsorberSpec): V2[] {
  const wall = s.half - (s.wall ?? 0.03)
  const fins = s.fins ?? []
  const finTip = s.finTip ?? s.cav
  const p: V2[] = [
    [s.bore, -s.half],
    [s.R, -s.half],
    [s.R, s.half],
    [s.bore, s.half],
    [s.bore, wall],
    [s.cav, wall],
  ]
  for (const fy of [...fins].sort((a, b) => b - a)) p.push([s.cav, fy + 0.006], [finTip, fy + 0.006], [finTip, fy - 0.006], [s.cav, fy - 0.006])
  p.push([s.cav, -wall], [s.bore, -wall])
  return p
}

/**
 * Dynamometer absorber casing (hydraulic, eddy-current or DC frame): closed drum with end walls,
 * shaft bore and internal stator fins. Frame: axis along X, centred on the origin.
 */
export function absorberCasing(s: AbsorberSpec, segments = 72) {
  return alongX(lathe(absorberProfile(s), segments))
}

/** The working water filling an absorber casing's cavity round its fins (same frame, 0.5 mm clearance). */
export function absorberWater(s: AbsorberSpec, segments = 64) {
  const e = 0.0005
  const wall = s.half - (s.wall ?? 0.03)
  const finTip = s.finTip ?? s.cav
  const wp: V2[] = [
    [s.bore + e, -wall + e],
    [s.cav - e, -wall + e],
  ]
  for (const fy of [...(s.fins ?? [])].sort((a, b) => a - b)) wp.push([s.cav - e, fy - 0.0065], [finTip - e, fy - 0.0065], [finTip - e, fy + 0.0065], [s.cav - e, fy + 0.0065])
  wp.push([s.cav - e, wall - e], [s.bore + e, wall - e])
  return alongX(lathe(wp, segments))
}

/**
 * Absorber rotor disc with radial vanes on both faces. Frame: axis X, centred. Defaults: the
 * test-bed hydraulic dynamometer (Fig 15.3).
 */
export function vanedRotor(s: { r?: number; t?: number; vanes?: number; vaneR?: number; vaneLen?: number } = {}) {
  const r = s.r ?? 0.195
  const t = s.t ?? 0.024
  const n = s.vanes ?? 16
  const vr = s.vaneR ?? 0.135
  const vl = s.vaneLen ?? 0.11
  const parts = [alongX(cylinder(r, t, 56))]
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI
    for (const sd of [-1, 1]) {
      const v = box(0.014, vl, 0.008)
      v.applyMatrix4(new THREE.Matrix4().makeRotationX(a).setPosition(sd * (t / 2 + 0.007), vr * cos(a), vr * sin(a)))
      parts.push(v)
    }
  }
  return merge(...parts)
}

/**
 * Trunnions and cradle bearings that let a dynamometer casing swing so its reaction torque can be
 * weighed. Frame: axis X, centred on the casing; one pair at x = ±(half + 0.04).
 */
export function cradleBearings(s: { half: number; trunnionR?: number; bore?: number; cradleR?: number }) {
  const x = s.half + 0.04
  const tr = s.trunnionR ?? 0.09
  const cr = s.cradleR ?? tr + 0.028
  const trunnions = [-1, 1].map((sd) => at(alongX(tube(tr, s.bore ?? 0.04, 0.08, 40)), sd * x, 0, 0))
  const cradles = [-1, 1].map((sd) => at(alongX(tube(cr, tr + 0.001, 0.07, 40)), sd * x, 0, 0))
  return { trunnions: merge(...trunnions), cradles: merge(...cradles) }
}

/* ------------------------------ front axle (2WD) ------------------------------ */

/**
 * Telescopic front axle of a two-wheel-drive tractor: a forged box-section centre beam that pivots
 * on a fore-and-aft pin under the front support, and an extension arm each side that slides in it
 * and is bolted at the chosen track (a row of holes shows the settings), ending in the kingpin boss.
 * Local frame: axle centre on the origin, beam along Z, kingpin axes vertical at z = ±kingpinZ, Y up.
 */
export function frontAxle(spec: {
  kingpinZ: number
  beamH?: number
  beamW?: number
  bossR?: number
  bossH?: number
  centreHalf?: number
  /** height of the support's underside above the axle centre: the pivot brackets reach up to it */
  supportY?: number
  /** radius rods: where on the beam they start (z = ±) and the ball joint they meet at, axle-local */
  radiusRods?: { z: number; ball: THREE.Vector3 }
}) {
  const K = spec.kingpinZ
  const H = spec.beamH ?? 0.1
  const W = spec.beamW ?? 0.1
  const bossR = spec.bossR ?? 0.05
  const bossH = spec.bossH ?? 0.15
  const C = spec.centreHalf ?? Math.min(0.42, K - 0.16)
  const xAlong = mat4.rz(Math.PI / 2)
  // centre beam: a hollow box section (12 mm walls), open at the ends for the extensions
  const rect = (w: number, h: number) => [new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(-w / 2, h / 2)]
  const centre = merge(
    extrudeTwisted(rect(W, H), [rect(W - 0.024, H - 0.024)], 2 * C),
    // pivot boss through the middle
    xform(cylinder(0.055, W + 0.06, 32), xAlong),
  )
  // extension arms, from inside the centre beam out to the kingpin bosses
  const iw = W - 0.026
  const ih = H - 0.026
  const ext = (s: number) => {
    const z0 = s * (C - 0.16)
    const z1 = s * (K - bossR * 0.6)
    return merge(xform(box(iw, ih, Math.abs(z1 - z0)), mat4.t(0, 0, (z0 + z1) / 2)), xform(cylinder(bossR, bossH, 32), mat4.t(0, 0, s * K)))
  }
  const extensions = merge(ext(1), ext(-1))
  // two clamp bolts through each end of the centre beam; spare holes along the extensions
  const bolt = merge(xform(cylinder(0.009, H + 0.05, 12), new THREE.Matrix4()), xform(cylinder(0.016, 0.012, 6), mat4.t(0, H / 2 + 0.006, 0)), xform(cylinder(0.016, 0.014, 6), mat4.t(0, -H / 2 - 0.007, 0)))
  const bolts = merge(...[1, -1].flatMap((s) => [0.05, 0.12].map((d) => xform(bolt, mat4.t(0, 0, s * (C - d))))))
  const holes = merge(...[1, -1].flatMap((s) => [0.04, 0.1, 0.16].map((d) => xform(cylinder(0.009, 0.003, 12), mat4.t(0, ih / 2 + 0.001, s * (C + d))))))
  // pivot pin, held fore and aft of the beam's boss by two brackets cast under the front support
  const pin = merge(xform(cylinder(0.025, W + 0.24, 20), xAlong), ...[1, -1].map((s) => xform(cylinder(0.034, 0.016, 6), mat4.c(mat4.t(s * (W / 2 + 0.12), 0, 0), xAlong))))
  const top = spec.supportY ?? 0.07
  const bracket = (s: number) => {
    const x = s * (W / 2 + 0.052)
    return merge(
      xform(box(0.04, top + 0.045, 0.15), mat4.t(x, (top - 0.045) / 2, 0)),
      xform(cylinder(0.05, 0.04, 32), mat4.c(mat4.t(x, 0, 0), xAlong)),
      // gussets up into the support
      ...[1, -1].map((g) => xform(box(0.07, 0.03, 0.02), mat4.t(x - s * 0.02, top - 0.02, g * 0.065))),
    )
  }
  const lugs = merge(bracket(1), bracket(-1))
  // radius rods from the beam back to a ball joint under the clutch housing: they hold the axle
  // square to the tractor against braking and pulling loads while it rocks about the pin
  let rods: THREE.BufferGeometry | null = null
  if (spec.radiusRods) {
    const { z: rz, ball } = spec.radiusRods
    const rod = (from: THREE.Vector3, to: THREE.Vector3, r: number) => {
      const d = to.clone().sub(from)
      const m = new THREE.Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), new THREE.Vector3(1, 1, 1))
      return xform(cylinder(r, d.length(), 16), m)
    }
    const parts: THREE.BufferGeometry[] = []
    for (const s of [1, -1]) {
      const a = new THREE.Vector3(-W / 2 - 0.02, -0.02, s * rz)
      parts.push(rod(a, ball, 0.017), xform(box(0.05, 0.06, 0.05), mat4.t(a.x + 0.012, a.y + 0.01, a.z)))
    }
    // ball and its cup on a bracket under the clutch housing
    const sphere = new THREE.SphereGeometry(0.034, 20, 14)
    sphere.translate(ball.x, ball.y, ball.z)
    parts.push(sphere, xform(box(0.12, 0.05, 0.12), mat4.t(ball.x - 0.03, ball.y + 0.045, ball.z)))
    rods = merge(...parts)
  }
  return { centre, extensions, bolts, holes, pin, lugs, rods }
}

/**
 * Steering knuckle (stub axle) for the 2WD front axle. Local frame: kingpin axis = Y through the
 * origin, the axle's boss between the yokes, stub spindle along +Z out to `reach` (the wheel hub).
 */
export function steeringKnuckle(spec: { reach: number; bossH?: number }) {
  const bh = spec.bossH ?? 0.15
  const yoke = (y: number) => xform(box(0.075, 0.03, 0.1), mat4.t(0, y, 0.02))
  const body = merge(
    yoke(bh / 2 + 0.017),
    yoke(-bh / 2 - 0.017),
    // the forged web joining the yokes, carrying the spindle
    xform(box(0.075, bh + 0.064, 0.04), mat4.t(0, 0, 0.07)),
  )
  // stepped spindle: inner bearing seat, outer bearing seat, thread and castle nut
  const spindle = xform(lathe([[0, 0.09], [0.034, 0.09], [0.034, 0.12], [0.026, 0.13], [0.026, spec.reach + 0.03], [0.018, spec.reach + 0.04], [0.018, spec.reach + 0.07], [0, spec.reach + 0.07]], 28), mat4.rx(Math.PI / 2))
  const nut = xform(cylinder(0.024, 0.016, 6), mat4.c(mat4.t(0, 0, spec.reach + 0.06), mat4.rx(Math.PI / 2)))
  const kingpin = cylinder(0.018, bh + 0.12, 16)
  const thrust = xform(tube(0.045, 0.02, 0.012, 28), mat4.t(0, -bh / 2 - 0.006, 0))
  return { body, spindle, nut, kingpin, thrust }
}

/* ------------------------------ front support (bolster) ------------------------------ */

/**
 * Cast front support bolted under the front of the engine: it carries the radiator above, the
 * front-axle pivot below and the front weights or a tow eye ahead. Local frame: centred on its own
 * middle, X forward, Y up; `l`, `h`, `w` its length, height and width.
 */
export function frontSupport(spec: { l: number; h: number; w: number }) {
  const { l, h, w } = spec
  const body = roundedBox(l, h, w, 0.025)
  // stiffening ribs down each side, a flange along the top with its bolts
  const ribs = merge(...[1, -1].flatMap((s) => [-0.3, 0, 0.3].map((f) => xform(box(0.022, h * 0.86, 0.018), mat4.t(f * l, -0.01, s * (w / 2 + 0.008))))))
  const flange = xform(roundedBox(l + 0.03, 0.022, w + 0.04, 0.008), mat4.t(0, h / 2 + 0.011, 0))
  const bolt = merge(cylinder(0.011, 0.012, 6), xform(cylinder(0.006, 0.02, 10), mat4.t(0, -0.01, 0)))
  const bolts = merge(...[1, -1].flatMap((s) => [-0.38, 0, 0.38].map((f) => xform(bolt, mat4.t(f * l, h / 2 + 0.028, s * (w / 2 + 0.006))))))
  // front face: a pad for the weight frame and a tow eye below it
  const pad = xform(roundedBox(0.02, h * 0.7, w * 0.8, 0.006), mat4.t(l / 2 + 0.01, 0.01, 0))
  const eye = merge(xform(box(0.06, 0.03, 0.04), mat4.t(l / 2 + 0.04, -h / 2 + 0.02, 0)), xform(tube(0.03, 0.015, 0.04, 24), mat4.c(mat4.t(l / 2 + 0.08, -h / 2 + 0.02, 0), mat4.rx(Math.PI / 2))))
  return { body: merge(body, ribs, flange, pad), bolts, eye }
}

/** Air-intake stack: the pipe up through the bonnet with its hose collar and clamp bands (the pre-cleaner sits on top). Local: base at the origin, up +Y. */
export function intakeStack(spec: { r: number; length: number }) {
  const { r, length: L } = spec
  const pipe = lathe([[r - 0.004, 0], [r, 0], [r, L], [r - 0.004, L]], 32)
  const collar = lathe([[r, 0.02], [r + 0.012, 0.02], [r + 0.012, 0.11], [r, 0.11]], 32)
  const band = (y: number) => merge(lathe([[r + 0.012, y], [r + 0.016, y], [r + 0.016, y + 0.014], [r + 0.012, y + 0.014]], 32), xform(box(0.02, 0.014, 0.012), mat4.t(r + 0.024, y + 0.007, 0)))
  return { pipe, collar, bands: merge(band(0.03), band(0.085)) }
}
