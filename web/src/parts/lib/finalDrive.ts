import { cylinder, mat4, merge, xform } from '@/geometry'
import { brakeDisc, plateStackZ } from './driveline'
import { internalGear, ringZ, shaftZ, spur } from './shapes'

/**
 * Shared parts library — inboard epicyclic final drive with an oil-immersed (wet) disc brake and a
 * diff-lock plate pack, as on the Massey Ferguson rear axle. One side of the axle, in a LOCAL frame
 * whose +Z runs out along the half shaft from the differential centre (Y up). Cheap: no CSG.
 *
 * Kinematics (ring held in the axle housing): carrier = sun · zs/(zs + zr); planets turn on their
 * pins at −(sun − carrier)·zs/zp relative to the carrier.
 */
export interface EpicyclicSpec {
  sun: number
  planet: number
  ring: number
  module: number
  width: number
  planets: number
}

export interface FinalDriveStations {
  /** where the half shaft starts (out of the differential) */
  shaftFrom: number
  brake: number
  /** centre of the epicyclic */
  reduction: number
  hub: number
}

/** reduction ratio of the set (sun in, carrier out, ring held) */
export const epicyclicRatio = (e: EpicyclicSpec) => (e.sun + e.ring) / e.sun
/** planet pin circle radius */
export const carrierRadius = (e: EpicyclicSpec) => (e.module * (e.sun + e.planet)) / 2

/** Sun, planet and annulus (ring) gears of the set, each centred on z = 0 (axis Z). */
export function epicyclicGears(e: EpicyclicSpec) {
  const ringR = (e.module * e.ring) / 2
  return {
    sun: spur(e.sun, e.module, e.width, 0.022),
    planet: spur(e.planet, e.module, e.width * 0.95, 0.012),
    ring: internalGear(e.ring, e.module, e.width, ringR + 0.022),
  }
}

/** Final-drive planet carrier for a set centred on z: two plates joined by the planet pins, and the axle out to the hub at toHub. */
export function epicyclicCarrier(e: EpicyclicSpec, z: number, toHub: number) {
  const { PI } = Math
  const rc = carrierRadius(e)
  return merge(
    ringZ(rc + 0.025, 0.0, z + e.width / 2 + 0.002, z + e.width / 2 + 0.016, 64),
    ringZ(rc + 0.025, 0.026, z - e.width / 2 - 0.012, z - e.width / 2 - 0.002, 64),
    ...Array.from({ length: e.planets }, (_, k) => xform(shaftZ(0.0115, z - e.width / 2 - 0.002, z + e.width / 2 + 0.002, 16), mat4.t(rc * Math.cos((2 * PI * k) / e.planets), rc * Math.sin((2 * PI * k) / e.planets), 0))),
    shaftZ(0.035, z + e.width / 2 + 0.016, toHub, 32),
  )
}

/** Wheel hub flange at z (facing +Z) with its eight wheel studs. */
export function wheelHub(z: number) {
  const { PI } = Math
  return merge(ringZ(0.13, 0.0, z, z + 0.02, 64), ...Array.from({ length: 8 }, (_, k) => xform(cylinder(0.008, 0.05, 12), mat4.c(mat4.rz((2 * PI * k) / 8), mat4.t(0.1, 0, z + 0.035), mat4.rx(PI / 2)))))
}

/** Half-shaft brake disc (splined on a 30 mm bore) with a lining on each face, centred on z. */
export function axleBrakeDisc(r: number, z: number, w = 0.012) {
  const d = brakeDisc({ rOut: r, bore: 0.03, t: w, z, lining: { rIn: r * 0.55, t: 0.003, inset: 0.003 } })
  return { disc: d.disc, lining: d.lining! }
}

/** Diff-lock plate pack: six plates on the half shaft from z0 outwards. */
export const diffLockPlates = (z0: number) => plateStackZ({ count: 6, z0, pitch: 0.0045, t: 0.0025, a: { rOut: 0.058, rIn: 0.032 }, segments: 48 }).all

export function epicyclicFinalDrive(e: EpicyclicSpec, st: FinalDriveStations, opts: { brakeR?: number; brakeW?: number; lockPack?: boolean } = {}) {
  const { PI } = Math
  const rc = carrierRadius(e)
  const z = st.reduction
  const brakeR = opts.brakeR ?? 0.185
  const brakeW = opts.brakeW ?? 0.01
  const gears = epicyclicGears(e)
  // sun gear on the outer end of the half shaft (gears are centred on their z)
  const sun = merge(shaftZ(0.022, st.shaftFrom, z + e.width / 2, 24), xform(gears.sun, mat4.t(0, 0, z)))
  const planet = gears.planet
  const ring = xform(gears.ring, mat4.t(0, 0, z))
  // carrier: two plates joined by the planet pins, and the axle out to the hub flange
  const carrier = epicyclicCarrier(e, z, st.hub)
  const hub = wheelHub(st.hub)
  // wet brake: a disc splined to the half shaft between two linings, applied by an annular piston
  const { disc, lining } = axleBrakeDisc(brakeR, st.brake, brakeW)
  const brakePiston = ringZ(brakeR, brakeR * 0.65, st.brake - brakeW / 2 - 0.0125, st.brake - brakeW / 2 - 0.0035, 64)
  const lock = opts.lockPack
    ? {
        plates: diffLockPlates(st.shaftFrom - 0.017),
        piston: ringZ(0.058, 0.032, st.shaftFrom + 0.011, st.shaftFrom + 0.016, 48),
      }
    : null
  /** planet pin positions (angle on the pin circle) */
  const planetAngles = Array.from({ length: e.planets }, (_, k) => (2 * PI * k) / e.planets)
  return { sun, planet, ring, carrier, hub, disc, lining, brakePiston, lock, planetAngles, rc }
}
