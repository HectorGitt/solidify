import { cylinder } from '@/geometry'
import { annulusOil, cylinderBarrel, cylinderCap, directionalValve, oilColumn, pistonRod, rodGland, sealedPiston } from '@/parts/lib/hydraulics'
import { BARREL_IN, BARREL_LEN, DIM, PORT_CAP_X, PORT_ROD_X, REF_R, REF_RO, VALVE } from './model'

/**
 * Double-acting cylinder scene geometry, from the shared parts library (src/parts/lib/hydraulics.ts).
 * Cylinder axis along +X from the cap face (x = 0); the barrel, cap and piston are built at the
 * reference bore and scaled radially by the scene; gland, rod and annulus oil follow the rod slider.
 */

/** cap-end clevis eye */
const CAP_EYE = { len: 0.058, halfH: 0.022, holeR: 0.0105, thick: 0.03 }
export const CAP_PIN_X = -DIM.capT - CAP_EYE.len + CAP_EYE.halfH

/** Heavy / parameter-independent parts — built once, in the geometry worker. */
export function buildStatic() {
  const p = sealedPiston({ R: REF_R, width: DIM.pistonW })
  const v = directionalValve(VALVE)
  return {
    barrel: cylinderBarrel({ R: REF_R, Ro: REF_RO, length: BARREL_LEN, ports: [PORT_CAP_X, PORT_ROD_X], portR: DIM.portR, bossR: DIM.portBossR, bossH: DIM.portBossH }),
    cap: cylinderCap({ Ro: REF_RO, capT: DIM.capT, eye: CAP_EYE }).cap,
    piston: p.piston,
    seals: p.seals,
    wearRing: p.wearRing,
    unitOil: oilColumn(1, 64),
    pin: cylinder(0.0098, 0.05, 24).rotateX(Math.PI / 2),
    valveBody: v.body,
    spool: v.spool,
  }
}

export type StaticCylGeometry = ReturnType<typeof buildStatic>

/* ---------------- cheap parts that depend on bore / rod — built on the main thread ---------------- */

export const glandParts = (rodR: number, boreR: number, boreRo: number) => rodGland({ rodR, R: boreR, Ro: boreRo, x0: BARREL_IN, x1: BARREL_LEN, out: DIM.glandOut })

/** Rod (from the piston's rod face, local x = 0) with its threaded-on rod eye. */
export function rodParts(rodR: number, rodLen: number) {
  const r = pistonRod({ rodR, length: rodLen })
  return { rod: r.rod, eye: r.eye!, eyePinX: r.eyePinX }
}

export { annulusOil }

let ready: StaticCylGeometry | null = null

export async function prepareCylinderGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('hydraulics/cylinder', buildStatic)
  return ready
}

export function buildCylinderGeometry(): StaticCylGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
