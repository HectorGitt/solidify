import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, lathe, mat4, merge, pipe, roundedBox, xform, type V2 } from '@/geometry'
import { loft, splineShaft, torus } from '@/geometry/parts'
import { BALL, COLUMN_END, WORM, helixAngle } from './model'

const { PI, sqrt } = Math
/** Y-axis solid → X axis; Z-extrusion → X axis */
const Y2X = mat4.rz(-PI / 2)
const Z2X = mat4.ry(PI / 2)
const Y2Z = mat4.rx(PI / 2)

/* ------------------------------ recirculating ball ------------------------------ */

/** Transverse section of the ball screw: land radius with one circular-profile groove at 2D angle 0. */
function ballScrewSection(n = 120) {
  const pts: THREE.Vector2[] = []
  const lead = BALL.lead
  for (let i = 0; i < n; i++) {
    const a = -PI + (2 * PI * i) / n
    const dz = (a / (2 * PI)) * lead
    const s = BALL.groove * BALL.groove - dz * dz
    let r = BALL.Ro
    if (s > 0) r = Math.min(BALL.Ro, BALL.Rb - sqrt(s))
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

function ballScrew() {
  const L = BALL.threadLen
  const steps = Math.ceil((L / BALL.lead) * 36)
  const thread = xform(extrudeTwisted(ballScrewSection(), [], L, (-2 * PI * L) / BALL.lead, steps), Z2X)
  const r = BALL.Ro - 0.0004
  const shafts = merge(
    xform(cylinder(r, 0.03, 32), mat4.c(mat4.t(-L / 2 - 0.015, 0, 0), Y2X)),
    xform(cylinder(0.011, COLUMN_END - L / 2, 32), mat4.c(mat4.t((L / 2 + COLUMN_END) / 2, 0, 0), Y2X)),
  )
  return { thread, shafts }
}

/** Ball nut (block) with its bore, the two transfer-tube holes and the peg F underneath. */
function ballNut() {
  const { nutLen, nutH, Rb } = BALL
  const blk = roundedBox(nutLen, 2 * nutH, 0.05, 0.004)
  const ops = [
    { op: 'sub' as const, geometry: xform(cylinder(Rb + 0.0026, nutLen + 0.02, 48), Y2X) },
    ...[-1, 1].map((s) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0042, 0.06, 16), mat4.t((s * BALL.turnsInNut * BALL.lead) / 2, 0.02, 0)) })),
  ]
  const nut = csg(blk, ops)
  const peg = xform(cylinder(0.0075, 0.03, 32), mat4.t(0, -nutH - 0.012, 0))
  return { nut, peg }
}

/** Closed ball circuit in the nut frame: helix through the nut, then out and back through the transfer tube. */
export function ballCircuit() {
  const { Rb, lead, turnsInNut, nutH } = BALL
  const half = (turnsInNut * lead) / 2
  const pts: THREE.Vector3[] = []
  const n = 90
  for (let i = 0; i <= n; i++) {
    const x = half - (2 * half * i) / n
    const a = helixAngle(x)
    pts.push(new THREE.Vector3(x, Rb * Math.sin(a), -Rb * Math.cos(a)))
  }
  const top = nutH + 0.007
  const end = pts[pts.length - 1]
  const start = pts[0]
  const tube = [
    new THREE.Vector3(end.x - 0.002, Rb + 0.004, 0),
    new THREE.Vector3(end.x - 0.003, top - 0.002, 0),
    new THREE.Vector3(end.x + 0.006, top, 0),
    new THREE.Vector3(start.x - 0.006, top, 0),
    new THREE.Vector3(start.x + 0.003, top - 0.002, 0),
    new THREE.Vector3(start.x + 0.002, Rb + 0.004, 0),
  ]
  const helixArc = sqrt(Rb * Rb + (lead / (2 * PI)) ** 2)
  const curve = new THREE.CatmullRomCurve3([...pts, ...tube], true, 'centripetal')
  return { curve, tube: new THREE.CatmullRomCurve3(tube.slice(1, -1), false), helixArc }
}

function transferTube() {
  const { tube } = ballCircuit()
  return pipe(tube, 0.0046, 0.0039, 48, 16)
}

/** Rocker arm D with a slot for the peg, on rocker shaft E (axis Z through the origin). Arm points +Y. */
function ballRocker() {
  const s = new THREE.Shape()
  s.moveTo(-0.016, 0)
  s.absarc(0, 0, 0.016, PI, 2 * PI, false)
  s.lineTo(0.013, 0.057)
  s.lineTo(-0.013, 0.057)
  s.lineTo(-0.016, 0)
  const slot = new THREE.Path()
  slot.moveTo(-0.0078, 0.028)
  slot.lineTo(-0.0078, 0.054)
  slot.lineTo(0.0078, 0.054)
  slot.lineTo(0.0078, 0.028)
  slot.lineTo(-0.0078, 0.028)
  s.holes.push(slot)
  const arm = extrude(s, 0.018, { curveSegments: 24 })
  const shaft = xform(splineShaft(18, 0.0125, 0.0115, 0.13), mat4.c(mat4.t(0, 0, 0.035), Y2Z))
  return { arm, shaft }
}

/** Drop arm hanging from the rocker shaft (pivot at origin, arm along −Y, plate in XY). */
function dropArm() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.021, 0, PI, false)
  s.lineTo(-0.013, -0.13)
  s.absarc(0, -0.13, 0.013, PI, 2 * PI, false)
  s.lineTo(0.021, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.0115, 0, 2 * PI, true)
  s.holes.push(hole)
  const plate = extrude(s, 0.016, { curveSegments: 24 })
  const ball = xform(lathe(sphereProfile(0.011), 20), mat4.t(0, -0.13, 0.016))
  return merge(plate, ball)
}

function sphereProfile(r: number): V2[] {
  const pts: V2[] = []
  for (let i = 0; i <= 10; i++) {
    const a = -PI / 2 + (PI * i) / 10
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return pts
}

/** Cast housing (open box with bores), centred on the screw/worm axis. */
function housing(x0: number, x1: number, y0: number, y1: number, zHalf: number, bores: { at: [number, number, number]; r: number; axis: 'x' | 'z' }[]) {
  const w = x1 - x0
  const h = y1 - y0
  const outer = xform(roundedBox(w, h, 2 * zHalf, 0.01), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, 0))
  const inner = xform(roundedBox(w - 0.016, h - 0.016, 2 * zHalf - 0.016, 0.006), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, 0))
  const ops = [
    { op: 'sub' as const, geometry: inner },
    ...bores.map((b) => ({ op: 'sub' as const, geometry: xform(cylinder(b.r, 0.08, 32), mat4.c(mat4.t(...b.at), b.axis === 'x' ? Y2X : Y2Z)) })),
  ]
  return csg(outer, ops)
}

/* ------------------------------ worm and peg ------------------------------ */

/** Worm section: land circle with a wide cam groove centred at 2D angle π/2 (peg on top). */
function wormSection(R0: number, n = 120) {
  const pts: THREE.Vector2[] = []
  const halfW = (PI * 0.0095) / WORM.lead // groove half-angle for a 9.5 mm-wide groove
  for (let i = 0; i < n; i++) {
    const a = (2 * PI * i) / n
    let d = Math.abs(Math.atan2(Math.sin(a - PI / 2), Math.cos(a - PI / 2)))
    d = Math.max(0, Math.min(1, (d - halfW + 0.25) / 0.5))
    const r = R0 - WORM.depth * (1 - d * d * (3 - 2 * d))
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/** Hourglass worm whose groove bottom follows the peg-tip arc about the rocker shaft. */
function worm() {
  const R0 = WORM.eY - WORM.rootArc + WORM.depth // land radius at the centre
  const n = 48
  const stations = []
  for (let i = 0; i <= n; i++) {
    const z = -WORM.len / 2 + (WORM.len * i) / n
    const root = WORM.eY - sqrt(WORM.rootArc ** 2 - z * z)
    stations.push({ z, scale: (root + WORM.depth) / R0, twist: (-2 * PI * z) / WORM.lead })
  }
  const body = xform(loft(wormSection(R0), [], stations), Z2X)
  const shafts = merge(
    xform(cylinder(0.011, 0.03, 32), mat4.c(mat4.t(-WORM.len / 2 - 0.015, 0, 0), Y2X)),
    xform(cylinder(0.011, COLUMN_END - WORM.len / 2, 32), mat4.c(mat4.t((WORM.len / 2 + COLUMN_END) / 2, 0, 0), Y2X)),
  )
  return { body, shafts }
}

/** Rocker arm D with peg C (pivot E at the origin, arm and peg pointing −Y). */
function wormRocker() {
  const s = new THREE.Shape()
  s.absarc(0, 0, 0.017, 0, PI, false)
  s.lineTo(-0.012, -WORM.pegBase)
  s.absarc(0, -WORM.pegBase, 0.012, PI, 2 * PI, false)
  s.lineTo(0.017, 0)
  const arm = extrude(s, 0.016, { curveSegments: 24 })
  const peg = lathe(
    [
      [0, -WORM.pegTip],
      [0.0022, -WORM.pegTip],
      [0.0042, -WORM.pegBase - 0.004],
      [0.0042, -WORM.pegBase + 0.004],
      [0, -WORM.pegBase + 0.004],
    ],
    24,
  )
  const shaft = xform(splineShaft(18, 0.0125, 0.0115, 0.13), mat4.c(mat4.t(0, 0, -0.035), Y2Z))
  return { arm, peg, shaft }
}

/* ------------------------------ wheel & oil ------------------------------ */

function steeringWheel() {
  const rim = xform(torus(0.1, 0.009, 12, 72), mat4.ry(PI / 2))
  const hub = xform(cylinder(0.022, 0.03, 32), Y2X)
  const spokes = [0, 1, 2].map((k) => xform(cylinder(0.0055, 0.09, 12), mat4.c(mat4.rx(PI / 2 + (2 * PI * k) / 3), mat4.t(0, 0.055, 0))))
  return merge(rim, hub, ...spokes)
}

export function buildStatic() {
  const bs = ballScrew()
  const bn = ballNut()
  const br = ballRocker()
  const wm = worm()
  const wr = wormRocker()
  return {
    ballThread: bs.thread,
    ballShafts: bs.shafts,
    ballNut: bn.nut,
    ballPeg: bn.peg,
    transferTube: transferTube(),
    ballRockerArm: br.arm,
    ballRockerShaft: br.shaft,
    ballHousing: housing(-0.085, 0.085, BALL.eY - 0.03, 0.055, 0.045, [
      { at: [-0.085, 0, 0], r: 0.012, axis: 'x' },
      { at: [0.085, 0, 0], r: 0.012, axis: 'x' },
      { at: [0, BALL.eY, 0.045], r: 0.0135, axis: 'z' },
    ]),
    wormBody: wm.body,
    wormShafts: wm.shafts,
    wormRockerArm: wr.arm,
    wormPeg: wr.peg,
    wormRockerShaft: wr.shaft,
    wormHousing: housing(-0.07, 0.07, -0.04, WORM.eY + 0.03, 0.04, [
      { at: [-0.07, 0, 0], r: 0.012, axis: 'x' },
      { at: [0.07, 0, 0], r: 0.012, axis: 'x' },
      { at: [0, WORM.eY, -0.04], r: 0.0135, axis: 'z' },
    ]),
    dropArm: dropArm(),
    wheel: steeringWheel(),
    ball: lathe(sphereProfile(BALL.ball), 16),
    levelPlug: cylinder(0.008, 0.012, 6),
    ballOil: box(0.15, 0.03, 0.072),
    wormOil: box(0.12, 0.022, 0.062),
  }
}

export type BoxesGeometry = ReturnType<typeof buildStatic>

let ready: BoxesGeometry | null = null

export async function prepareBoxesGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('steering/boxes', buildStatic)
  return ready
}

export function buildBoxesGeometry(): BoxesGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
