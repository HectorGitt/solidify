import { bandBrake, planetCarrier, plateStackZ } from '@/parts/lib/driveline'
import { axial, internalGear, ringZ, shaftZ, spur } from '@/parts/lib/shapes'
import { PG, RC, RP, RR, RS } from './model'

/**
 * Planetary set geometry (worker-safe). Gears lie in XY, shafts along Z (parts-library convention).
 * Set 1 is centred on z = 0; set 2 of the compound train reuses the gears at SET2_Z.
 */


const W = PG.width
const HW = W / 2

const PLATE_T = 0.008
const PLATE_GAP = 0.004
export const PLATE_Z = HW + PLATE_GAP + PLATE_T / 2

function carrier(shaftTo: number) {
  // four-armed spider plates (PT p5 figure) with the pins on their lobes
  const c = planetCarrier({ n: PG.n, rc: RC, pinR: 0.0105, plateT: PLATE_T, plateZ: PLATE_Z, rHub: 0.047, lobeClear: 0.021, frontBore: 0.022 })
  const shaft = shaftZ(0.022, shaftTo, -PLATE_Z - PLATE_T / 2, 32)
  return { plates: c.plates, pins: c.pins, shaft }
}

/** Ring gear, drum and hollow ring shaft (towards +Z). */
function ring(hubEnd: number, hubIn: number) {
  const gearPart = internalGear(PG.zr, PG.m, W, RR + 0.012, 4)
  const drum = axial(
    [
      [0.122, HW],
      [RR + 0.012, HW],
      [RR + 0.012, 0.053],
      [hubIn + 0.01, 0.053],
      [hubIn + 0.01, hubEnd],
      [hubIn, hubEnd],
      [hubIn, 0.045],
      [0.122, 0.045],
    ],
    96,
  )
  return { gear: gearPart, drum }
}

/** Lock-up clutch between the ring shaft (drum) and the sun shaft (hub). */
function lockClutch(z0: number) {
  const drum = axial(
    [
      [0.032, z0],
      [0.074, z0],
      [0.074, z0 + 0.05],
      [0.068, z0 + 0.05],
      [0.068, z0 + 0.006],
      [0.032, z0 + 0.006],
    ],
    64,
  )
  const hub = ringZ(0.042, 0.018, z0 + 0.008, z0 + 0.048, 48)
  // steel plates (in the drum) alternating with friction plates (on the hub)
  const pack = plateStackZ({ count: 7, z0: z0 + 0.01, pitch: 0.0052, t: 0.0034, a: { rOut: 0.0675, rIn: 0.05 }, b: { rOut: 0.062, rIn: 0.0425 }, segments: 64 })
  return { drum, hub, steel: pack.a, friction: pack.b! }
}

function brakeDrum(r: number, t: number, bore: number) {
  return ringZ(r, bore, -t / 2, t / 2, 64)
}

/** Band brake (stationary) round a drum of radius r, with an anchor lug. */
const band = (r: number, width: number) => bandBrake({ r, width })

/** Cast housing round one set: shell plus end walls with shaft bores. */
function housing(zFront: number, zRear: number, frontBore: number, rearBore: number) {
  return axial(
    [
      [frontBore, zFront],
      [0.158, zFront],
      [0.158, zRear],
      [rearBore, zRear],
      [rearBore, zRear - 0.008],
      [0.15, zRear - 0.008],
      [0.15, zFront + 0.008],
      [frontBore, zFront + 0.008],
    ],
    96,
  )
}

export const LOCK_Z = 0.2
export const SUN_BRAKE_Z = 0.29
export const CARRIER_BRAKE_Z = -0.13
export const RING2_HUB_END = 0.075

export function buildStatic() {
  const c1 = carrier(-0.2)
  return {
    sun: spur(PG.zs, PG.m, W, 0, 4),
    sunShaft: shaftZ(0.018, -0.005, 0.33, 32),
    sun2Shaft: shaftZ(0.016, -0.02, 0.03, 24),
    planet: spur(PG.zp, PG.m, W, 0.0108, 4),
    carrier: c1,
    carrierShaftLong: shaftZ(0.022, -0.26 + 0.02, -PLATE_Z - PLATE_T / 2, 32),
    carrier2Shaft: shaftZ(0.022, -0.2, -PLATE_Z - PLATE_T / 2, 32),
    ring: ring(LOCK_Z, 0.022),
    ring2: ring(RING2_HUB_END, 0.026),
    lock: lockClutch(LOCK_Z),
    drumSun: brakeDrum(0.06, 0.022, 0.018),
    drumCarrier: brakeDrum(0.07, 0.022, 0.022),
    bandSun: band(0.06, 0.018),
    bandCarrier: band(0.07, 0.018),
    bandRing: band(RR + 0.012, 0.026),
    housing: housing(-0.08, 0.075, 0.026, 0.036),
    housing2: housing(-0.08, 0.075, 0.026, 0.04),
    /** planet tip radius, for tests */
    planetTip: RP + PG.m,
    sunTip: RS + PG.m,
  }
}

export type PlanetaryGeometry = ReturnType<typeof buildStatic>

let ready: PlanetaryGeometry | null = null

export async function preparePlanetaryGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/planetary', buildStatic)
  return ready
}

export function getPlanetaryGeometry(): PlanetaryGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
