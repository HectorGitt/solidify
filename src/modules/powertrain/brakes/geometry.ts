import * as THREE from 'three'
import { box, cylinder, extrudeTwisted, mat4, merge, pipe, xform, type V2 } from '@/geometry'
import { splineShaft } from '@/geometry/parts'
import { axial, coilZ, ringZ, shaftZ } from '../common/geo'
import { DISC, PEDALS, WET } from './model'

/** Cheap (no CSG) brake geometry, axis along Z, built once on the main thread. */
const { PI } = Math

function ccw(pts: V2[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) a += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1]
  return a > 0 ? pts : pts.slice().reverse()
}
const shell = (pts: V2[], seg = 72) => axial(ccw(pts), seg)

/** Annular sector a0…a1 (rad), radii r0…r1, thickness t centred on z. */
function sector(r0: number, r1: number, a0: number, a1: number, t: number, z = 0, n = 28) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(r1 * Math.cos(a0 + ((a1 - a0) * i) / n), r1 * Math.sin(a0 + ((a1 - a0) * i) / n)))
  for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(r0 * Math.cos(a0 + ((a1 - a0) * i) / n), r0 * Math.sin(a0 + ((a1 - a0) * i) / n)))
  return xform(extrudeTwisted(pts, [], t), mat4.t(0, 0, z))
}

const deg = (d: number) => (d * PI) / 180

/** Circular segment of radius r below the chord y = yc (oil sump in the wet-brake housing). */
function segment(r: number, yc: number, n = 32) {
  const a = Math.acos(yc / r)
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const t = a + ((2 * PI - 2 * a) * i) / n
    pts.push(new THREE.Vector2(r * Math.sin(t), r * Math.cos(t)))
  }
  return pts
}

/** Shoe pivot points (anchor pins) and the cam position. */
export const SHOE_PIVOT = { left: new THREE.Vector2(-0.035, -0.115), right: new THREE.Vector2(0.035, -0.115) }
export const CAM_Y = 0.118

function shoeBrake() {
  const drum = shell([[0.035, 0.03], [0.15, 0.03], [0.15, -0.035], [0.162, -0.035], [0.162, 0.042], [0.035, 0.042]])
  const studs = merge(...Array.from({ length: 6 }, (_, k) => xform(cylinder(0.006, 0.03, 10), mat4.c(mat4.rz((2 * PI * k) / 6), mat4.t(0.07, 0, 0.055), mat4.rx(PI / 2)))))
  const backPlate = merge(ringZ(0.158, 0.034, -0.045, -0.04, 72), ringZ(0.05, 0.034, -0.06, -0.045, 32))
  // shoe = web + table, built in brake coordinates then shifted so the pivot is the origin
  const shoe = (side: 1 | -1) => {
    const a0 = side > 0 ? deg(-72) : deg(108)
    const a1 = side > 0 ? deg(72) : deg(252)
    const piv = side > 0 ? SHOE_PIVOT.right : SHOE_PIVOT.left
    const web = sector(0.112, 0.138, a0, a1, 0.008)
    const table = sector(0.138, 0.142, a0, a1, 0.04)
    const lining = sector(0.142, 0.1465, a0 + deg(6), a1 - deg(6), 0.036)
    const t = mat4.t(-piv.x, -piv.y, 0)
    return { metal: xform(merge(web, table), t), lining: xform(lining, t) }
  }
  const cam = merge(xform(extrudeTwisted(new THREE.Shape().absellipse(0, 0, 0.022, 0.009, 0, 2 * PI, false, 0).getPoints(32), [], 0.03), mat4.t(0, 0, 0)), shaftZ(0.008, -0.08, 0, 16))
  const camLever = xform(box(0.012, 0.09, 0.008), mat4.t(0, 0.045, -0.07))
  const spring = coilZ(0.007, 0.0016, 9)
  const pins = merge(...[SHOE_PIVOT.left, SHOE_PIVOT.right].map((p) => xform(shaftZ(0.008, -0.04, 0.012, 16), mat4.t(p.x, p.y, 0))))
  const adjuster = merge(xform(shaftZ(0.009, -0.04, -0.02, 6), mat4.t(-0.06, 0.12, 0)), xform(cylinder(0.004, 0.05, 8), mat4.c(mat4.t(-0.06, 0.12, -0.03), mat4.rz(PI / 2))))
  const shaft = merge(shaftZ(0.03, -0.12, 0.09, 24))
  return { drum: merge(drum, studs), backPlate, shoeL: shoe(-1), shoeR: shoe(1), cam, camLever, spring, pins, adjuster, shaft }
}

function discBrake() {
  // inner faces at z = ±0.0305 are the two outer friction faces (housing and cover)
  const housing = shell([[0.034, -0.04], [0.16, -0.04], [0.16, 0.0305], [0.15, 0.0305], [0.15, -0.0305], [0.034, -0.0305]])
  const ears = xform(box(0.06, 0.03, 0.08), mat4.t(0, -0.16, 0))
  const cover = merge(ringZ(0.16, 0.034, 0.0305, 0.0385, 72), ...[0, 120, 240].map((a) => xform(box(0.02, 0.1, 0.008), mat4.c(mat4.rz(deg(a)), mat4.t(0, 0.09, 0.0425)))))
  const shaft = xform(splineShaft(12, 0.03, 0.027, 0.24), mat4.c(mat4.t(0, 0, -0.12), mat4.rx(PI / 2)))
  // rotating discs (two), lined both faces
  const rotor = merge(ringZ(DISC.rOut, 0.03, -0.003, 0.003, 72))
  const rotorLining = merge(ringZ(DISC.rOut - 0.002, DISC.rIn, -0.0055, -0.003, 72), ringZ(DISC.rOut - 0.002, DISC.rIn, 0.003, 0.0055, 72))
  // actuating discs with ears for the link
  const act = merge(ringZ(0.12, 0.045, -0.004, 0.004, 72), xform(box(0.03, 0.04, 0.008), mat4.t(0, 0.13, 0)))
  const ball = new THREE.SphereGeometry(0.0075, 16, 12)
  const balls = merge(...Array.from({ length: 5 }, (_, k) => xform(ball, mat4.t(DISC.rBall * Math.cos((2 * PI * k) / 5 + 0.3), DISC.rBall * Math.sin((2 * PI * k) / 5 + 0.3), 0))))
  const spring = coilZ(0.005, 0.0011, 7)
  // actuating link from the two ears up to the operating-rod yoke
  const link = merge(xform(box(0.012, 0.06, 0.03), mat4.t(0, 0.175, 0)), xform(shaftZ(0.005, -0.02, 0.02, 12), mat4.t(0, 0.2, 0)), xform(cylinder(0.005, 0.08, 12), mat4.t(0, 0.245, 0)))
  return { housing: merge(housing, ears), cover, shaft, rotor, rotorLining, act, balls, spring, link }
}

function wetBrake() {
  const housing = shell([[0.034, -0.07], [0.18, -0.07], [0.18, 0.06], [0.05, 0.06], [0.05, 0.052], [0.172, 0.052], [0.172, -0.062], [0.034, -0.062]])
  const shaft = xform(splineShaft(12, 0.03, 0.027, 0.26), mat4.c(mat4.t(0, 0, -0.13), mat4.rx(PI / 2)))
  const hub = ringZ(0.05, 0.03, -0.04, 0.035, 48)
  const disc = merge(ringZ(WET.rOut, 0.05, -0.002, 0.002, 72))
  const plate = merge(ringZ(0.168, WET.rIn + 0.008, -0.0015, 0.0015, 72))
  const piston = merge(ringZ(WET.pistonR1, WET.pistonR0, -0.006, 0.006, 72))
  const chamberOil = ringZ(WET.pistonR1 - 0.0005, WET.pistonR0 + 0.0005, -0.061, -0.0545, 72)
  const port = xform(shaftZ(0.008, 0, 0.06, 12), mat4.c(mat4.t(0, 0.18, -0.058), mat4.rx(-PI / 2)))
  return { housing: merge(housing, port), shaft, hub, disc, plate, piston, chamberOil }
}

/** Pedal pair, master cylinders and balancing valve (to the right of the brake). */
function pedals() {
  const arm = merge(xform(box(0.02, PEDALS.arm, 0.012), mat4.t(0, -PEDALS.arm / 2, 0)), xform(box(0.07, 0.012, 0.05), mat4.t(-0.02, -PEDALS.arm, 0)), xform(shaftZ(0.012, -0.012, 0.012, 16), mat4.t(0, 0, 0)))
  const pivot = shaftZ(0.009, -0.11, 0.11, 16)
  const latch = merge(xform(shaftZ(0.004, -PEDALS.z - 0.012, PEDALS.z + 0.012, 10), mat4.t(-0.02, -PEDALS.arm + 0.02, 0)))
  const mcBody = xform(cylinder(0.018, 0.12, 24), mat4.rz(PI / 2))
  const mcRes = xform(cylinder(0.014, 0.03, 16), mat4.t(0.02, 0.03, 0))
  const valve = box(0.04, 0.04, 0.16)
  return { arm, pivot, latch, mc: merge(mcBody, mcRes), valve }
}

/** Brake line from the left master cylinder (via the balancing valve) to the brake actuator. */
export const LINES = {
  left: new THREE.CatmullRomCurve3([new THREE.Vector3(PEDALS.mcX + 0.07, PEDALS.mcY, PEDALS.z), new THREE.Vector3(PEDALS.mcX + 0.12, PEDALS.mcY + 0.04, PEDALS.z), new THREE.Vector3(0.35, 0.33, PEDALS.z), new THREE.Vector3(0.05, 0.26, 0.0), new THREE.Vector3(0.0, 0.2, -0.05)]),
  right: new THREE.CatmullRomCurve3([new THREE.Vector3(PEDALS.mcX + 0.07, PEDALS.mcY, -PEDALS.z), new THREE.Vector3(PEDALS.mcX + 0.12, PEDALS.mcY + 0.04, -PEDALS.z), new THREE.Vector3(PEDALS.mcX + 0.1, PEDALS.mcY + 0.06, -0.3), new THREE.Vector3(PEDALS.mcX - 0.1, PEDALS.mcY + 0.04, -0.45)]),
}

export function buildBrakeGeometry() {
  return {
    shoe: shoeBrake(),
    disc: discBrake(),
    wet: wetBrake(),
    pedals: pedals(),
    lineL: pipe(LINES.left, 0.005, 0.003, 64, 10),
    lineR: pipe(LINES.right, 0.005, 0.003, 48, 10),
    unitRod: xform(cylinder(0.005, 1, 10), mat4.t(0, 0.5, 0)),
    sump: xform(extrudeTwisted(segment(0.171, -0.1), [], 0.112), mat4.t(0, 0, -0.005)),
  }
}

let cache: ReturnType<typeof buildBrakeGeometry> | null = null
export const brakeGeometry = () => (cache ??= buildBrakeGeometry())
