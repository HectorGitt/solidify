import * as THREE from 'three'
import { box, csg, cylinder, extrude, lathe, mat4, merge, pipe, roundedRect, xform, type CsgOp } from '@/geometry'
import { CROWN_TDC, DIM, cylZ, type CylCount } from './model'

/**
 * Inline-engine castings for 2, 3, 4, 6 and 8 cylinders (worker-safe: no React, no DOM).
 * Frame: crank axis = Z (cylinder 1 at +Z), cylinders vertical, crank centre at the origin.
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)

export const CRANK = { r: DIM.crankR, pinR: 0.024, journalR: 0.028, webT: 0.016, cwR: 0.062, pinLen: 0.03 }
export const LINER_OUT = 0.046
export const DECK = CROWN_TDC + 0.0012
export const HEAD_H = 0.07
export const CASE_X = 0.11
export const BARREL_X = 0.078
export const RAIL_Y = -0.072
export const BARREL_Y0 = 0.118
export const INJ_X = 0.012

export const blockLength = (n: number) => n * DIM.pitch + 0.05

function block(n: CylCount) {
  const L = blockLength(n)
  // crankcase + barrel as one T-shaped side profile, extruded along the crank axis (no union needed)
  const prof = new THREE.Shape()
  prof.moveTo(-CASE_X, RAIL_Y)
  prof.lineTo(CASE_X, RAIL_Y)
  prof.lineTo(CASE_X, BARREL_Y0)
  prof.lineTo(BARREL_X, BARREL_Y0)
  prof.lineTo(BARREL_X, DECK + 0.0002)
  prof.lineTo(-BARREL_X, DECK + 0.0002)
  prof.lineTo(-BARREL_X, BARREL_Y0)
  prof.lineTo(-CASE_X, BARREL_Y0)
  const shell = extrude(prof, L)
  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))
  // water jacket: a stadium-shaped cavity round all the bores
  const jw = 0.058
  const jl = zs[0] - zs[n - 1] + 2 * jw
  const slot = extrude(roundedRect(2 * jw, jl, jw * 0.98), 0.082, { curveSegments: 20 })
  // crank-throw bays between the main-bearing bulkheads (round top, open bottom)
  const bay = new THREE.Shape()
  bay.moveTo(0.09, 0)
  bay.absarc(0, 0, 0.09, 0, PI, false)
  bay.lineTo(-0.09, RAIL_Y - 0.08)
  bay.lineTo(0.09, RAIL_Y - 0.08)
  const bayG = extrude(bay, DIM.pitch - 0.03, { curveSegments: 20 })
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(slot, mat4.c(mat4.t(0, 0.196, 0), mat4.rx(-PI / 2))) },
    { op: 'sub', geometry: merge(...zs.map((z) => xform(cylinder(LINER_OUT, 0.24, 40), mat4.t(0, 0.17, z)))) },
    { op: 'sub', geometry: merge(...zs.map((z) => xform(bayG, mat4.t(0, 0, z)))) },
    // main-bearing bores through the bulkheads and end walls
    { op: 'sub', geometry: xform(cylinder(CRANK.journalR + 0.0025, L + 0.1, 32), alongZ) },
  ]
  return csg(shell, ops)
}

function coolant(n: CylCount) {
  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))
  const jw = 0.058 - 0.0003
  const jl = zs[0] - zs[n - 1] + 2 * jw
  const s = roundedRect(2 * jw, jl, jw * 0.98)
  for (const z of zs) {
    const h = new THREE.Path()
    // shape is in XY before the rotation: x → X, y → −Z
    h.absarc(0, -z, LINER_OUT + 0.0003, 0, PI * 2, true)
    s.holes.push(h)
  }
  return xform(extrude(s, 0.0814, { curveSegments: 24 }), mat4.c(mat4.t(0, 0.196, 0), mat4.rx(-PI / 2)))
}

function head(n: CylCount) {
  const L = blockLength(n)
  const body = xform(box(2 * BARREL_X + 0.004, HEAD_H, L), mat4.t(0, HEAD_H / 2, 0))
  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))
  const holes = merge(...zs.map((z) => xform(cylinder(0.0095, 0.2, 20), mat4.t(INJ_X, 0.05, z))))
  // shallow valve pockets either side of each injector
  const pockets = merge(...zs.flatMap((z) => [0.022, -0.022].map((dz) => xform(cylinder(0.017, 0.006, 28), mat4.t(-0.014, 0.0015, z + dz)))))
  return csg(body, [
    { op: 'sub', geometry: holes },
    { op: 'sub', geometry: pockets },
  ])
}

function rockerCover(n: CylCount) {
  const L = blockLength(n) - 0.01
  const h = 0.06
  const outer = xform(box(0.13, h, L), mat4.t(-0.012, HEAD_H + h / 2, 0))
  const inner = xform(box(0.118, h, L - 0.012), mat4.t(-0.012, HEAD_H + h / 2 - 0.006, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function sump(n: CylCount) {
  const L = blockLength(n)
  const d = 0.11
  const outer = xform(box(2 * CASE_X, d, L), mat4.t(0, RAIL_Y - d / 2, 0))
  const inner = xform(box(2 * CASE_X - 0.01, d, L - 0.01), mat4.t(0, RAIL_Y - d / 2 + 0.005, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function oil(n: CylCount) {
  const L = blockLength(n)
  return xform(box(2 * CASE_X - 0.0106, 0.045, L - 0.0106), mat4.t(0, RAIL_Y - 0.11 + 0.005 + 0.0226, 0))
}

function exhaustManifold(n: CylCount) {
  const parts: THREE.BufferGeometry[] = []
  const x0 = BARREL_X + 0.002
  const zs = Array.from({ length: n }, (_, i) => cylZ(i + 1, n))
  const yC = 0.04
  for (const z of zs) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, yC, z), new THREE.Vector3(x0 + 0.03, yC, z), new THREE.Vector3(x0 + 0.05, yC - 0.005, z * 0.9)])
    parts.push(pipe(c, 0.015, 0.011, 16, 16))
  }
  const z0 = zs[n - 1] - 0.03
  const z1 = zs[0] + 0.03
  parts.push(pipe(new THREE.LineCurve3(new THREE.Vector3(x0 + 0.055, yC - 0.005, z0), new THREE.Vector3(x0 + 0.055, yC - 0.005, z1)), 0.021, 0.016, 8, 20))
  return merge(...parts)
}

export interface MultiStatic {
  block: THREE.BufferGeometry
  coolant: THREE.BufferGeometry
  head: THREE.BufferGeometry
  cover: THREE.BufferGeometry
  sump: THREE.BufferGeometry
  oil: THREE.BufferGeometry
  exhaust: THREE.BufferGeometry
}

const COUNTS: CylCount[] = [2, 3, 4, 6, 8]

/** Heavy CSG castings for every cylinder count — built once, in the geometry worker. */
export function buildStatic() {
  const out: Record<string, MultiStatic> = {}
  for (const n of COUNTS) out[n] = { block: block(n), coolant: coolant(n), head: head(n), cover: rockerCover(n), sump: sump(n), oil: oil(n), exhaust: exhaustManifold(n) }
  return {
    byCount: out,
    liner: lathe([[DIM.bore / 2, 0.128], [LINER_OUT - 0.0002, 0.128], [LINER_OUT - 0.0002, DECK - 0.0002], [DIM.bore / 2, DECK - 0.0002]], 56),
    injector: lathe([[0, 0], [0.003, 0], [0.004, 0.012], [0.009, 0.02], [0.009, 0.075], [0.012, 0.078], [0.012, 0.1], [0.005, 0.104], [0.005, 0.118], [0, 0.118]], 24),
    gas: lathe([[0, 0], [DIM.bore / 2 - 0.0003, 0], [DIM.bore / 2 - 0.0003, 1], [0, 1]], 48),
    flywheel: xform(lathe([[0.03, 0], [0.16, 0], [0.16, 0.04], [0.13, 0.04], [0.12, 0.015], [0.05, 0.015], [0.045, 0.028], [0.03, 0.028]], 96), mat4.rx(-PI / 2)),
    pulley: xform(lathe([[0.016, 0], [0.065, 0], [0.065, 0.004], [0.052, 0.011], [0.065, 0.018], [0.065, 0.022], [0.016, 0.022]], 64), mat4.rx(PI / 2)),
  }
}

export type MultiGeometry = ReturnType<typeof buildStatic>

let ready: MultiGeometry | null = null

export async function prepareMultiGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/multi-cylinder', buildStatic)
  return ready
}

export function getMultiGeometry(): MultiGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
