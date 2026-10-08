import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, gear, mat4, tube, xform, type CsgOp } from '@/geometry'
import { gearRadii } from '@/physics/pumps'
import { GEAR, VANE } from './model'

const { PI } = Math
const Y2Z = mat4.rx(PI / 2)
const Y2X = mat4.rz(-PI / 2)

/* ------------------------------ gear pump (axis Z, gear centres at y = ±r) ------------------------------ */

const G = gearRadii(GEAR)
const HB = GEAR.width / 2

function gearBody() {
  const body = box(0.095, 0.105, GEAR.width)
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(cylinder(G.ra + 0.0004, 0.05, 64), mat4.c(mat4.t(0, G.r, 0), Y2Z)) },
    { op: 'sub', geometry: xform(cylinder(G.ra + 0.0004, 0.05, 64), mat4.c(mat4.t(0, -G.r, 0), Y2Z)) },
    { op: 'sub', geometry: xform(cylinder(0.0095, 0.06, 32), mat4.c(mat4.t(-0.035, 0, 0), Y2X)) },
    { op: 'sub', geometry: xform(cylinder(0.0095, 0.06, 32), mat4.c(mat4.t(0.035, 0, 0), Y2X)) },
  ]
  return csg(body, ops)
}

function gearCover(front: boolean) {
  const plate = xform(box(0.095, 0.105, 0.012), mat4.t(0, 0, (front ? 1 : -1) * (HB + 0.006)))
  if (!front) return plate
  return csg(plate, [{ op: 'sub', geometry: xform(cylinder(0.0075, 0.05, 32), mat4.c(mat4.t(0, G.r, HB + 0.006), Y2Z)) }])
}

function gearParts() {
  const g = gear({ teeth: GEAR.teeth, module: GEAR.module, width: GEAR.width, bore: 0.0062, flankPoints: 8 })
  const drive = xform(cylinder(0.006, 0.1, 24), mat4.c(mat4.t(0, 0, 0.03), Y2Z))
  const idler = xform(cylinder(0.006, 0.044, 24), Y2Z)
  return { gear: g, drive, idler }
}

/** Straight port pipe along X from x0 to x1 at the body mid-plane. */
const portPipe = (x0: number, x1: number, y = 0, z = 0) => xform(tube(0.0125, 0.0095, Math.abs(x1 - x0), 32), mat4.c(mat4.t((x0 + x1) / 2, y, z), Y2X))

/* ------------------------------ vane pump (axis Z, rotor at the origin) ------------------------------ */

function rotorContour() {
  const { rotorR: r, vanes: n, vaneT } = VANE
  const slotD = 0.017
  const half = vaneT / 2 + 0.0002
  const pts: THREE.Vector2[] = []
  for (let k = 0; k < n; k++) {
    const a = (2 * PI * k) / n
    const c = Math.cos(a)
    const s = Math.sin(a)
    const P = (rad: number, t: number) => new THREE.Vector2(rad * c - t * s, rad * s + t * c)
    const da = Math.asin(half / r)
    // circle arc from the previous slot to this slot
    const aPrev = a - (2 * PI) / n + da
    for (let i = 1; i <= 6; i++) {
      const t = aPrev + ((a - da - aPrev) * i) / 6
      pts.push(new THREE.Vector2(r * Math.cos(t), r * Math.sin(t)))
    }
    pts.push(P(r - slotD, -half), P(r - slotD, half))
    pts.push(new THREE.Vector2(r * Math.cos(a + da), r * Math.sin(a + da)))
  }
  return pts
}

function vaneRotor() {
  const hole: THREE.Vector2[] = []
  for (let i = 0; i < 32; i++) hole.push(new THREE.Vector2(0.008 * Math.cos((-2 * PI * i) / 32), 0.008 * Math.sin((-2 * PI * i) / 32)))
  return extrudeTwisted(rotorContour(), [hole], VANE.width - 0.0004)
}

function kidney(a0: number, a1: number, r0: number, r1: number, depth: number, z: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r1, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  return xform(extrude(s, depth, { curveSegments: 24 }), mat4.t(0, 0, z))
}

function vaneHousing() {
  const W = VANE.width
  const body = csg(box(0.13, 0.135, W), [{ op: 'sub', geometry: xform(cylinder(0.0585, 0.06, 72), Y2Z) }])
  const zr = -W / 2 - 0.007
  const rear = csg(xform(box(0.13, 0.135, 0.014), mat4.t(0, 0, zr)), [
    { op: 'sub', geometry: kidney((105 * PI) / 180, (255 * PI) / 180, 0.0352, 0.0398, 0.01, zr + 0.003) },
    { op: 'sub', geometry: kidney((-75 * PI) / 180, (75 * PI) / 180, 0.0352, 0.0398, 0.01, zr + 0.003) },
    { op: 'sub', geometry: xform(cylinder(0.0075, 0.06, 24), mat4.c(mat4.t(-0.065, 0, zr + 0.001), Y2X)) },
    { op: 'sub', geometry: xform(cylinder(0.0075, 0.06, 24), mat4.c(mat4.t(0.065, 0, zr + 0.001), Y2X)) },
  ])
  const front = csg(xform(box(0.13, 0.135, 0.012), mat4.t(0, 0, W / 2 + 0.006)), [{ op: 'sub', geometry: xform(cylinder(0.0085, 0.05, 32), mat4.c(mat4.t(0, 0, W / 2 + 0.006), Y2Z)) }])
  return { body, rear, front }
}

export function buildStatic() {
  const gp = gearParts()
  const vh = vaneHousing()
  return {
    gearBody: gearBody(),
    gearFront: gearCover(true),
    gearRear: gearCover(false),
    gear: gp.gear,
    gearDrive: gp.drive,
    gearIdler: gp.idler,
    gearInPipe: portPipe(-0.1, -0.0465),
    gearOutPipe: portPipe(0.0465, 0.1),
    ring: xform(tube(0.052, VANE.ringR, VANE.width, 96), Y2Z),
    rotor: vaneRotor(),
    vane: box(VANE.vaneLen, VANE.vaneT, VANE.width - 0.0008),
    vaneShaft: xform(cylinder(0.008, 0.11, 24), mat4.c(mat4.t(0, 0, 0.03), Y2Z)),
    vaneBody: vh.body,
    vaneRear: vh.rear,
    vaneFront: vh.front,
    vaneInPipe: portPipe(-0.12, -0.065, 0, -VANE.width / 2 - 0.006),
    vaneOutPipe: portPipe(0.065, 0.12, 0, -VANE.width / 2 - 0.006),
  }
}

export type PumpGeometry = ReturnType<typeof buildStatic>

let ready: PumpGeometry | null = null

export async function preparePumpGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('hydraulics/pumps', buildStatic)
  return ready
}

export function buildPumpGeometry(): PumpGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
