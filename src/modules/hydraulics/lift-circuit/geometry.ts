import { box, csg, cylinder, lathe, mat4, xform, type V2 } from '@/geometry'
import { filterCan, gearPump, ram, reliefValve, spoolValve, type GearPumpSpec, type SpoolValveSpec } from '@/parts/lib/hydraulics'
import { BARREL_LEN, C, RAM_BORE, ROD_LEN } from './model'

const { PI } = Math
const AXIS_Z = mat4.rx(PI / 2)

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

/*
 * Pump, control valve, relief valve, filter and ram are the shared parts library's builders
 * (src/parts/lib/hydraulics.ts) — the same ones the whole-tractor view uses — placed here in the
 * scene's tractor frame.
 */

/** Gear pump: m 4 mm, 10 teeth, 40 mm wide, in a 160 × 110 × 60 mm block. */
const PUMP_M = 0.004
const PUMP_Z = 10
export const PUMP_C = PUMP_M * PUMP_Z
export const PUMP_SPEC: GearPumpSpec = { module: PUMP_M, teeth: PUMP_Z, width: 0.04, block: [0.16, 0.11, 0.06], cavityDepth: 0.04 }

export const VALVE_SPEC: SpoolValveSpec = {
  length: L.valve.x1 - L.valve.x0,
  h: L.valve.h,
  w: L.valve.w,
  boreR: L.valve.boreR,
  ports: [
    { x: L.portP - L.valve.x0, up: true },
    { x: L.portA - L.valve.x0, up: false },
    { x: L.portT - L.valve.x0, up: false },
  ],
}

/** Relief-valve seat height (tractor frame). */
export const RELIEF_SEAT = 0.86

function pumpParts() {
  const p = gearPump(PUMP_SPEC)
  return { body: xform(p.body, mat4.t(L.pump.x, L.pump.y, 0)), gear: p.gear }
}

function valveParts() {
  const v = spoolValve(VALVE_SPEC)
  return { body: xform(v.body, mat4.t((L.valve.x0 + L.valve.x1) / 2, L.valve.y, 0)), spool: v.spool }
}

function reliefParts() {
  const r = L.relief
  const v = reliefValve({ r: r.r, height: r.y1 - r.y0, seat: RELIEF_SEAT - r.y0 })
  return { body: xform(v.body, mat4.t(r.x, r.y0, 0)), poppet: v.poppet, spring: v.spring }
}

function filterParts() {
  const f = L.filter
  const c = filterCan({ r: f.r, height: f.y1 - f.y0 })
  const at = mat4.t(f.x, f.y0, 0)
  return { can: xform(c.can, at), element: xform(c.element, at) }
}

export function buildStatic() {
  return {
    housing: housing(),
    oil: reservoirOil(),
    ...(() => {
      const v = valveParts()
      return { valveBody: v.body, spool: v.spool }
    })(),
    relief: reliefParts(),
    filter: filterParts(),
    pump: pumpParts(),
    ram: ram({ bore: RAM_BORE, barrelLen: BARREL_LEN, rodLen: ROD_LEN }),
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
