import * as THREE from 'three'
import { cylinder, mat4, merge, pipe, xform, type V2 } from '@/geometry'
import { axial, boxFrom, casing, dogRing, internalSplinePlate, shaftZ, spur } from '../common/geo'
import { CS_Y, M, PACK, ST, Z } from './dims'

/** Powershift unit geometry (worker-safe). */

const { PI } = Math
const GW = 0.028

/** Clutch packs: closed end of the drum at z0, opening towards dir (+1 / −1). */
export const PACKS = {
  H: { z0: 0.08, dir: 1 as 1 | -1, drumIn: 0.024 },
  L: { z0: 0.218, dir: 1 as 1 | -1, drumIn: 0.03 },
  R: { z0: 0.392, dir: -1 as 1 | -1, drumIn: 0.03 },
}
const DRUM_L = 0.05
export const STROKE = 0.003
export const PISTON_Z = 0.006
export const PACK_Z = 0.021
const DISC_T = 0.0025
const PLATE_T = 0.002

function prof(points: V2[], z0: number, dir: 1 | -1) {
  const pts = points.map(([r, z]) => [r, z0 + dir * z] as V2)
  return axial(dir > 0 ? pts : pts.reverse(), 72)
}

function pack(z0: number, dir: 1 | -1, drumIn: number) {
  const drum = merge(
    prof(
      [
        [drumIn, 0],
        [0.088, 0],
        [0.088, DRUM_L],
        [0.0815, DRUM_L],
        [0.0815, 0.006],
        [drumIn, 0.006],
      ],
      z0,
      dir,
    ),
    // backing plate held in the drum by a snap ring
    prof(
      [
        [0.06, 0.0405],
        [0.0815, 0.0405],
        [0.0815, 0.0455],
        [0.06, 0.0455],
      ],
      z0,
      dir,
    ),
  )
  const piston = prof(
    [
      [PACK.pistonIn, 0],
      [PACK.pistonOut, 0],
      [PACK.pistonOut, 0.012],
      [PACK.pistonIn, 0.012],
    ],
    0,
    dir,
  )
  // discs: friction-lined, external teeth into the drum; plates: steel, internal teeth on the hub (PT p4)
  const disc = dogRing(30, PACK.Ro, 0.081, PACK.Ri, DISC_T)
  const plate = internalSplinePlate(24, 0.074, 0.0445, 0.0415, PLATE_T)
  const discs: THREE.BufferGeometry[] = []
  const plates: THREE.BufferGeometry[] = []
  for (let k = 0; k < PACK.discs; k++) {
    const zd = PACK_Z + k * (DISC_T + PLATE_T) + DISC_T / 2
    discs.push(xform(disc, mat4.t(0, 0, dir * zd)))
    plates.push(xform(plate, mat4.t(0, 0, dir * (zd + DISC_T / 2 + PLATE_T / 2))))
  }
  const hub = xform(dogRing(24, 0.04, 0.0435, 0.024, 0.03), mat4.t(0, 0, z0 + dir * 0.03))
  return { drum, piston, discs: merge(...discs), plates: merge(...plates), hub }
}

/* ------------------------------ oil circuit ------------------------------ */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2)

export const CIRCUIT = {
  screen: v(0.06, -0.24, 0.32),
  pump: v(0.22, -0.13, 0.02),
  filter: v(0.25, -0.02, 0.05),
  relief: v(0.305, -0.02, 0.05),
  regulator: v(0.25, 0.07, 0.13),
  shiftValve: v(0.25, 0.15, 0.26),
}

export const PATHS = {
  suction: () => curve([v(0.06, -0.24, 0.32), v(0.12, -0.24, 0.3), v(0.2, -0.22, 0.2), v(0.22, -0.18, 0.06), v(0.22, -0.15, 0.02)]),
  pressure: () => curve([v(0.22, -0.11, 0.02), v(0.235, -0.07, 0.035), v(0.25, -0.05, 0.05)]),
  toRegulator: () => curve([v(0.25, 0.0, 0.05), v(0.25, 0.03, 0.08), v(0.25, 0.05, 0.12)]),
  relief: () => curve([v(0.25, -0.05, 0.05), v(0.29, -0.06, 0.05), v(0.305, -0.04, 0.05), v(0.31, -0.2, 0.15), v(0.14, -0.24, 0.25)]),
  control: () => curve([v(0.25, 0.09, 0.13), v(0.25, 0.12, 0.18), v(0.25, 0.14, 0.24)]),
  lube: () => curve([v(0.27, 0.07, 0.14), v(0.2, 0.15, 0.25), v(0.05, 0.15, 0.42), v(0.0, 0.1, 0.44), v(0.0, 0.05, 0.44)]),
  feed: (z: number) => curve([v(0.24, 0.16, 0.27), v(0.15, 0.16, z), v(0.02, 0.15, z), v(0.0, 0.1, z), v(0.0, 0.04, z)]),
}

export const FEED_Z = { H: PACKS.H.z0 + 0.012, L: PACKS.L.z0 + 0.012, R: PACKS.R.z0 - 0.012 }

function circuit() {
  const P = (c: THREE.Curve<THREE.Vector3>, r = 0.007) => pipe(c, r, r * 0.7, 40, 12)
  const body = (p: THREE.Vector3, w: number, h: number, d: number) => boxFrom([p.x - w / 2, p.y - h / 2, p.z - d / 2], [p.x + w / 2, p.y + h / 2, p.z + d / 2])
  return {
    screen: xform(cylinder(0.022, 0.08, 20), mat4.c(mat4.t(CIRCUIT.screen.x, CIRCUIT.screen.y, CIRCUIT.screen.z), mat4.rz(PI / 2))),
    pump: merge(body(CIRCUIT.pump, 0.07, 0.06, 0.06), xform(cylinder(0.02, 0.05, 20), mat4.c(mat4.t(CIRCUIT.pump.x, CIRCUIT.pump.y, CIRCUIT.pump.z - 0.05), mat4.rx(PI / 2)))),
    filter: xform(cylinder(0.03, 0.09, 28), mat4.t(CIRCUIT.filter.x, CIRCUIT.filter.y - 0.005, CIRCUIT.filter.z)),
    relief: merge(xform(cylinder(0.012, 0.05, 16), mat4.t(CIRCUIT.relief.x, CIRCUIT.relief.y, CIRCUIT.relief.z))),
    regulator: body(CIRCUIT.regulator, 0.06, 0.05, 0.07),
    shiftValve: body(CIRCUIT.shiftValve, 0.07, 0.05, 0.1),
    spool: xform(cylinder(0.009, 0.13, 16), mat4.c(mat4.t(CIRCUIT.shiftValve.x, CIRCUIT.shiftValve.y, CIRCUIT.shiftValve.z), mat4.rx(PI / 2))),
    pipes: merge(P(PATHS.suction(), 0.009), P(PATHS.pressure()), P(PATHS.toRegulator()), P(PATHS.control()), P(PATHS.lube(), 0.005), P(PATHS.relief(), 0.005)),
    feeds: merge(P(PATHS.feed(FEED_Z.H), 0.005), P(PATHS.feed(FEED_Z.L), 0.005), P(PATHS.feed(FEED_Z.R), 0.005)),
  }
}

export function buildStatic() {
  return {
    input: merge(shaftZ(0.024, -0.18, ST.inEnd, 32)),
    inputGear: spur(Z.a, M, GW, 0.024, 3),
    output: shaftZ(0.024, ST.outZ0, ST.outZ1, 32),
    counter: shaftZ(0.022, 0.0, 0.45, 24),
    gb: spur(Z.b, M, GW, 0.022, 3),
    gc: spur(Z.c, M, GW, 0.022, 3),
    ge: spur(Z.e, M, GW, 0.022, 3),
    idler: spur(Z.idler, M, GW, 0.014, 3),
    idlerShaft: shaftZ(0.014, ST.f - 0.035, ST.f + 0.035, 16),
    low: spur(Z.d, M, GW, 0.025, 3),
    rev: spur(Z.f, M, GW, 0.025, 3),
    packH: pack(PACKS.H.z0, PACKS.H.dir, PACKS.H.drumIn),
    packL: pack(PACKS.L.z0, PACKS.L.dir, PACKS.L.drumIn),
    packR: pack(PACKS.R.z0, PACKS.R.dir, PACKS.R.drumIn),
    casing: casing([-0.12, 0.13], [-0.27, 0.12], [-0.02, 0.48], 0.01, [
      { x: 0, y: 0, r: 0.03 },
      { x: 0, y: CS_Y, r: 0.026 },
    ]),
    sump: boxFrom([-0.109, -0.259, -0.009], [0.119, -0.205, 0.469]),
    circuit: circuit(),
  }
}

export type PSGeometry = ReturnType<typeof buildStatic>

let ready: PSGeometry | null = null

export async function preparePSGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/powershift', buildStatic)
  return ready
}

export function getPSGeometry(): PSGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
