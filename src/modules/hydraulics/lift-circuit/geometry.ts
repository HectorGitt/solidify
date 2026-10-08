import { box, csg, cylinder, gear, helixSpring, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { BARREL_LEN, C, RAM_BORE, ROD_LEN } from './model'

const { PI } = Math
const AXIS_X = mat4.rz(-PI / 2)
const AXIS_Z = mat4.rx(PI / 2)
const alongX = (profile: V2[], seg = 48) => xform(lathe(profile, seg), AXIS_X)

/** Layout (tractor frame, metres). */
export const L = {
  housing: { x0: -0.42, x1: 1.0, y0: 0.25, y1: 0.78, z: 0.22 },
  cover: { x0: -0.42, x1: 0.36, y1: 1.1, z: 0.2 },
  wall: 0.014,
  oilY: 0.56,
  pump: { x: 0.75, y: 0.42 },
  filter: { x: 0.75, y0: 0.79, y1: 0.99, r: 0.045 },
  relief: { x: 0.9, y0: 0.79, y1: 1.0, r: 0.026 },
  valve: { x0: 0.0, x1: 0.24, y: 1.15, h: 0.08, w: 0.08, boreR: 0.017 },
  portA: 0.17,
  portT: 0.06,
  portP: 0.1,
  shaftZ: 0.42,
}

/** Transmission housing (reservoir) + lift cover, hollow, with holes for the rockshaft and pipes. */
function housing() {
  const h = L.housing
  const c = L.cover
  const w = L.wall
  const outerLow = xform(box(h.x1 - h.x0, h.y1 - h.y0, 2 * h.z), mat4.t((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, 0))
  const outerTop = xform(box(c.x1 - c.x0, c.y1 - h.y1 + 0.001, 2 * c.z), mat4.t((c.x0 + c.x1) / 2, (h.y1 + c.y1) / 2 - 0.0005, 0))
  const innerLow = xform(box(h.x1 - h.x0 - 2 * w, h.y1 - h.y0 - 2 * w, 2 * h.z - 2 * w), mat4.t((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, 0))
  const iy0 = h.y1 - 0.03
  const iy1 = c.y1 - w
  const innerTop = xform(box(c.x1 - c.x0 - 2 * w, iy1 - iy0, 2 * c.z - 2 * w), mat4.t((c.x0 + c.x1) / 2, (iy0 + iy1) / 2, 0))
  const vHole = (x: number, y: number, r: number) => xform(cylinder(r, 0.1, 24), mat4.t(x, y, 0))
  return csg(outerLow, [
    { op: 'add', geometry: outerTop },
    { op: 'sub', geometry: innerLow },
    { op: 'sub', geometry: innerTop },
    { op: 'sub', geometry: xform(cylinder(0.034, 1, 32), mat4.c(mat4.t(C.x, C.y, 0), AXIS_Z)) },
    { op: 'sub', geometry: vHole(L.portT, c.y1, 0.014) },
    { op: 'sub', geometry: vHole(0.2, c.y1, 0.03) },
    { op: 'sub', geometry: vHole(L.pump.x, h.y1, 0.014) },
    { op: 'sub', geometry: vHole(0.97, h.y1, 0.012) },
  ])
}

/** Oil in the reservoir (sits inside the housing walls). */
function reservoirOil() {
  const h = L.housing
  const w = L.wall + 0.0005
  return xform(box(h.x1 - h.x0 - 2 * w, L.oilY - h.y0 - w, 2 * h.z - 2 * w), mat4.t((h.x0 + h.x1) / 2, (h.y0 + w + L.oilY) / 2, 0))
}

/** Control-valve body: block with the spool bore and three ports (P top, A and T underneath). */
function valveBody() {
  const v = L.valve
  const body = xform(box(v.x1 - v.x0, v.h, v.w), mat4.t((v.x0 + v.x1) / 2, v.y, 0))
  const port = (x: number, up: boolean) => xform(cylinder(0.0085, v.h / 2 + 0.01, 20), mat4.t(x, v.y + (up ? 1 : -1) * (v.h / 4 + 0.005), 0))
  return csg(body, [
    { op: 'sub', geometry: xform(cylinder(v.boreR, v.x1 - v.x0 + 0.02, 40), mat4.c(mat4.t((v.x0 + v.x1) / 2, v.y, 0), mat4.rz(PI / 2))) },
    { op: 'sub', geometry: port(L.portP, true) },
    { op: 'sub', geometry: port(L.portA, false) },
    { op: 'sub', geometry: port(L.portT, false) },
  ])
}

/** Spool with three lands, along +X, centred on x = 0 (moves ±0.03). */
function spool() {
  const r = L.valve.boreR - 0.0004
  const n = 0.008
  const len = L.valve.x1 - L.valve.x0 + 0.08
  const x0 = -len / 2
  const lands: [number, number][] = [
    [0.03, 0.075],
    [0.105, 0.15],
    [0.18, 0.225],
  ]
  const pts: V2[] = [
    [0, x0],
    [n, x0],
  ]
  for (const [a, b] of lands) pts.push([n, x0 + a], [r, x0 + a], [r, x0 + b], [n, x0 + b])
  pts.push([n, x0 + len], [0, x0 + len])
  return alongX(pts, 40)
}

/** Relief valve: body with an internal seat, side inlet (below the seat) and outlet (above), poppet and spring. */
export const RELIEF_SEAT = 0.86
function reliefParts() {
  const r = L.relief
  const ri = r.r - 0.006
  const ys = RELIEF_SEAT
  const shell = lathe(
    [
      [0, r.y0],
      [r.r, r.y0],
      [r.r, r.y1],
      [0, r.y1],
      [0, r.y1 - 0.008],
      [ri, r.y1 - 0.008],
      [ri, ys + 0.006],
      [0.009, ys + 0.006],
      [0.009, ys],
      [ri, ys],
      [ri, r.y0 + 0.008],
      [0, r.y0 + 0.008],
    ],
    40,
  )
  const side = (y: number, dx: number) => xform(cylinder(0.0075, 0.03, 16), mat4.c(mat4.t(r.x + dx, y, 0), mat4.rz(PI / 2)))
  const body = csg(xform(shell, mat4.t(r.x, 0, 0)), [
    { op: 'sub', geometry: side(0.835, -r.r) },
    { op: 'sub', geometry: side(0.95, r.r) },
  ])
  const poppet = lathe(
    [
      [0, -0.012],
      [0.012, 0],
      [0.017, 0.004],
      [0.017, 0.014],
      [0, 0.014],
    ],
    32,
  )
  const spring = helixSpring(0.011, 0.0018, 1, 7)
  return { body, poppet, spring }
}

function filterParts() {
  const f = L.filter
  const can = lathe(
    [
      [0.01, f.y0],
      [f.r, f.y0],
      [f.r, f.y1],
      [0.012, f.y1],
      [0.012, f.y1 - 0.006],
      [f.r - 0.005, f.y1 - 0.006],
      [f.r - 0.005, f.y0 + 0.006],
      [0.01, f.y0 + 0.006],
    ],
    40,
  )
  const element = xform(tube(f.r - 0.012, 0.018, f.y1 - f.y0 - 0.03, 40), mat4.t(0, (f.y0 + f.y1) / 2, 0))
  return { can: xform(can, mat4.t(f.x, 0, 0)), element: xform(element, mat4.t(f.x, 0, 0)) }
}

/** Gear pump block with a figure-of-eight cavity, and its two gears (axes along Z). */
const PUMP_M = 0.004
const PUMP_Z = 10
export const PUMP_C = PUMP_M * PUMP_Z
function pumpParts() {
  const p = L.pump
  const blk = xform(box(0.16, 0.11, 0.06), mat4.t(p.x, p.y, 0))
  const cav = (dx: number) => xform(cylinder(PUMP_M * (PUMP_Z / 2 + 1) + 0.0012, 0.04, 40), mat4.c(mat4.t(p.x + dx, p.y, 0), AXIS_Z))
  const body = csg(blk, [
    { op: 'sub', geometry: cav(-PUMP_C / 2) },
    { op: 'sub', geometry: cav(PUMP_C / 2) },
    { op: 'sub', geometry: xform(cylinder(0.008, 0.06, 16), mat4.t(p.x, p.y - 0.04, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.008, 0.06, 16), mat4.t(p.x, p.y + 0.04, 0)) },
  ])
  const g = gear({ teeth: PUMP_Z, module: PUMP_M, width: 0.038, bore: 0.006 })
  return { body, gear: g }
}

/** Ram: barrel (closed cap, open rod end) built along +X from the pivot. */
function ramParts() {
  const R = RAM_BORE / 2
  const Ro = R + 0.01
  const barrel = alongX(
    [
      [0, -0.02],
      [Ro, -0.02],
      [Ro, BARREL_LEN],
      [R, BARREL_LEN],
      [R, 0],
      [0, 0],
    ],
    56,
  )
  const lug = xform(xform(cylinder(0.022, 0.06, 24), AXIS_Z), mat4.t(-0.035, 0, 0))
  const piston = alongX(
    [
      [0, 0],
      [R - 0.0005, 0],
      [R - 0.0005, 0.035],
      [0, 0.035],
    ],
    48,
  )
  const seal = alongX(
    [
      [R - 0.006, 0.012],
      [R - 0.0002, 0.012],
      [R - 0.0002, 0.022],
      [R - 0.006, 0.022],
    ],
    48,
  )
  const rod = alongX(
    [
      [0, 0.035],
      [0.017, 0.035],
      [0.017, ROD_LEN],
      [0, ROD_LEN],
    ],
    32,
  )
  const oil = alongX(
    [
      [0, 0],
      [R - 0.0003, 0],
      [R - 0.0003, 1],
      [0, 1],
    ],
    48,
  )
  return { barrel: merge(barrel, lug), piston, seal, rod, oil }
}

export function buildStatic() {
  return {
    housing: housing(),
    oil: reservoirOil(),
    valveBody: valveBody(),
    spool: spool(),
    relief: reliefParts(),
    filter: filterParts(),
    pump: pumpParts(),
    ram: ramParts(),
    rockshaft: xform(cylinder(0.028, 2 * L.shaftZ + 0.04, 32), AXIS_Z),
    bar: box(1, 1, 1),
    rod: xform(cylinder(0.5, 1, 16), mat4.t(0, 0.5, 0)),
    ball: lathe(Array.from({ length: 13 }, (_, i): V2 => [0.03 * Math.sin((PI * i) / 12), -0.03 * Math.cos((PI * i) / 12)]), 20),
    weight: box(0.34, 0.42, 0.7),
  }
}

export type StaticLiftGeometry = ReturnType<typeof buildStatic>

let ready: StaticLiftGeometry | null = null

export async function prepareLiftGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('hydraulics/lift-circuit', buildStatic)
  return ready
}

export function buildLiftGeometry(): StaticLiftGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
