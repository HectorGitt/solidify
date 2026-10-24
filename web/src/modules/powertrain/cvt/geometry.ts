import * as THREE from 'three'
import { cylinder, extrudeTwisted, mat4, merge, pipe, xform } from '@/geometry'
import { CVT } from '@/physics/cvt'
import { planetCarrier } from '@/parts/lib/driveline'
import { flywheel } from '@/parts/lib/engine'
import { axial, internalGear, ringZ, shaftZ, spur } from '@/parts/lib/shapes'
import { roundedPath } from '../hydrostatic/geometry'
import { DAMPER_Z, G, M, MOTOR_Z0, N_PLANETS, OUTPUT_Z, PG_W, PUMP_Z0, RC, RR, UNIT_SCALE } from './model'

/**
 * Power-split CVT geometry (worker-safe). Gears lie in XY, shafts along Z (parts-library convention).
 * The pump and motor rotating groups come from the hydrostatic scene and are placed in Scene3D.
 */

const { PI } = Math
const HW = PG_W / 2
const PLATE_T = 0.01
export const PLATE_Z = HW + 0.005 + PLATE_T / 2

/** Ring hub: the ring gear's drum closes towards +Z and runs on as a hollow shaft round the sun shaft. */
const HUB_IN = 0.034
const HUB_OUT = 0.046
const HUB_END = G.takeZ + G.width / 2 + 0.006

/** Bell housing round the planetary set and the gear train (sectioned in the scene). */
function housing() {
  return axial(
    [
      [0.05, -0.1],
      [0.205, -0.1],
      [0.205, 0.04],
      [0.197, 0.04],
      [0.197, -0.09],
      [0.05, -0.09],
    ],
    96,
  )
}

/** Gear case round the take-off and summing pairs: a rounded box section from z0 to z1. */
function gearCase(z0: number, z1: number) {
  const w = 0.36
  const top = G.pumpY + 0.135
  const bot = G.motorY - 0.135
  const outer = roundedRect(w, top, bot, 0.06)
  const inner = roundedRect(w - 0.016, top - 0.008, bot + 0.008, 0.052).reverse()
  const wall = extrudeTwisted(outer, [inner], z1 - z0)
  return xform(wall, mat4.t(0, 0, (z0 + z1) / 2))
}

function roundedRect(w: number, top: number, bot: number, r: number) {
  const pts: THREE.Vector2[] = []
  const corners: [number, number, number][] = [
    [w / 2 - r, top - r, 0],
    [-w / 2 + r, top - r, PI / 2],
    [-w / 2 + r, bot + r, PI],
    [w / 2 - r, bot + r, 1.5 * PI],
  ]
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 8; k++) {
    const a = a0 + (k / 8) * (PI / 2)
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)))
  }
  return pts
}

/** Hydraulic line paths, pump ports → motor ports (world). */
export function pipePaths() {
  const s = UNIT_SCALE
  const portX = 0.035 * s
  const bossZ = -0.095 * s
  const pz = PUMP_Z0 - bossZ
  const mz = MOTOR_Z0 - bossZ
  const yP = G.pumpY
  const yM = G.motorY
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  // the unit is turned half round about Y, so local +x is world −x
  const A = [v(portX, yP, pz), v(portX, yP, 0.6), v(portX, -0.15, 0.6), v(-portX, -0.15, 0.6), v(-portX, yM, 0.6), v(-portX, yM, mz)]
  const B = [v(-portX, yP, pz), v(-portX, yP, 0.665), v(-portX, 0.15, 0.665), v(portX, 0.15, 0.665), v(portX, yM, 0.665), v(portX, yM, mz)]
  return { A, B }
}

const rounded = roundedPath

export function pipeCurves() {
  const p = pipePaths()
  return { A: rounded(p.A, 0.03), B: rounded(p.B, 0.03), Ar: rounded([...p.A].reverse(), 0.03), Br: rounded([...p.B].reverse(), 0.03) }
}

export function buildStatic() {
  const carrier = planetCarrier({ n: N_PLANETS, rc: RC, pinR: 0.011, plateT: PLATE_T, plateZ: PLATE_Z, rHub: 0.07, lobeClear: 0.026, frontBore: 0.032 })

  const ringDrum = axial(
    [
      [RR + 0.004, HW],
      [RR + 0.016, HW],
      [RR + 0.016, HW + 0.032],
      [HUB_OUT, HW + 0.032],
      [HUB_OUT, HUB_END],
      [HUB_IN, HUB_END],
      [HUB_IN, HW + 0.022],
      [RR + 0.004, HW + 0.022],
    ],
    96,
  )

  // torsional damper on the input: the engine flywheel (library part, with its starter ring gear)
  // carrying coil springs round its face
  const fw = flywheel({ r: 0.23, width: 0.044 })
  const atDamper = mat4.t(0, 0, DAMPER_Z + 0.022)
  const springs: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const a = (2 * PI * i) / 6 + PI / 6
    springs.push(xform(cylinder(0.016, 0.07, 16), mat4.c(mat4.t(0.15 * Math.cos(a), 0.15 * Math.sin(a), DAMPER_Z + 0.03), mat4.rz(a))))
  }

  const p = pipePaths()
  const pr = 0.011 * UNIT_SCALE
  const pIn = 0.0085 * UNIT_SCALE
  const curves = { A: rounded(p.A, 0.03), B: rounded(p.B, 0.03) }

  return {
    sun: spur(CVT.zs, M, PG_W, 0, 4),
    planet: spur(CVT.zp, M, PG_W, 0.0115, 4),
    ring: internalGear(CVT.zr, M, PG_W, RR + 0.016, 4),
    ringDrum,
    takeoff: spur(G.zTake, M, G.width, HUB_OUT - 0.001, 4),
    pumpGear: spur(G.zPump, M, G.width, 0, 4),
    sumGear: spur(G.zSum, M, G.width, 0, 4),
    motorGear: spur(G.zMotor, M, G.width, 0, 4),
    carrier,
    inputShaft: merge(shaftZ(0.032, DAMPER_Z - 0.03, -PLATE_Z - PLATE_T / 2, 32), ringZ(0.06, 0.03, -PLATE_Z - PLATE_T / 2 - 0.03, -PLATE_Z - PLATE_T / 2, 48)),
    damper: { disc: xform(fw.disc, atDamper), ring: xform(fw.ring, atDamper), springs: merge(...springs) },
    outputShaft: merge(shaftZ(0.026, -0.015, OUTPUT_Z, 32), ringZ(0.1, 0.026, OUTPUT_Z - 0.03, OUTPUT_Z, 64)),
    housing: housing(),
    gearCase: gearCase(0.06, 0.18),
    pipeWall: { A: pipe(curves.A, pr, pIn, 96, 16), B: pipe(curves.B, pr, pIn, 96, 16) },
    pipeOil: { A: pipe(curves.A, pIn - 0.0004, 0, 96, 12), B: pipe(curves.B, pIn - 0.0004, 0, 96, 12) },
  }
}

export type CvtGeometry = ReturnType<typeof buildStatic>

let ready: CvtGeometry | null = null

export async function prepareCvtGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/cvt', buildStatic)
  return ready
}

export function getCvtGeometry(): CvtGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export { RR }
