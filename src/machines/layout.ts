import { CAM_X, CAM_Y, CROWN_TDC, DEFAULTS, DIM, deckGap } from '@/modules/engine/four-stroke/model'

/**
 * Where the parts of the shared engine sit (src/machines/Engine), without any geometry code, so a
 * scene's model can place its own parts against the engine. Engine frame: crank axis = Z, cylinder 1
 * at the front (+Z), Y up, origin at the crank centre.
 */

/** cylinder pitch along the crank */
export const PITCH = 0.135
/** head deck height at the standard compression ratio */
export const HEAD_Y = CROWN_TDC + deckGap(DEFAULTS.r)

/** Usual firing orders of inline four-strokes, by cylinder count. */
export const FIRING_ORDERS: Record<number, number[]> = {
  1: [1],
  2: [1, 2],
  3: [1, 2, 3],
  4: [1, 3, 4, 2],
  5: [1, 2, 4, 5, 3],
  6: [1, 5, 3, 6, 2, 4],
  8: [1, 6, 2, 5, 8, 3, 7, 4],
}

/** Firing angle (deg in the 720° cycle) of each cylinder, indexed by cylinder number − 1, for an evenly firing order. */
export function firingFromOrder(order: number[]) {
  const step = 720 / order.length
  const out: number[] = []
  order.forEach((cyl, i) => (out[cyl - 1] = i * step))
  return out
}

/** the tractor's four: firing order 1-3-4-2 */
export const FIRING_4 = firingFromOrder(FIRING_ORDERS[4])

/** Where everything sits for a given firing layout (one firing angle per cylinder). */
export function engineLayout(firing: number[]) {
  const n = firing.length
  /** cylinder centres, no. 1 at the front */
  const cylZ = firing.map((_, i) => ((n - 1) / 2 - i) * PITCH)
  const front = cylZ[0]
  const rear = cylZ[n - 1]
  return {
    n,
    firing,
    cylZ,
    front,
    rear,
    /** half-way between neighbouring cylinders: the bulkheads */
    mids: cylZ.slice(1).map((z, i) => (z + cylZ[i]) / 2),
    /** lengths of the cylinder barrel (upper block) and the crankcase: the single plus a pitch per extra cylinder */
    lu: (n - 1) * PITCH + 0.14,
    ll: (n - 1) * PITCH + 0.16,
    /** flywheel, ring gear and pulley along the crank */
    flywheelZ: rear - 0.107,
    ringGearZ: rear - 0.115,
    pulleyZ: front + 0.112,
  }
}
export type EngineLayout = ReturnType<typeof engineLayout>

/** sump: inner floor and the default oil level */
export const SUMP = { floorY: -0.169, oilTop: -0.119 }
/** camshaft axis (engine frame x, y) */
export const CAM_AXIS = { x: CAM_X, y: CAM_Y }
/** rocker shaft (engine frame x, y) */
export const ROCKER_AXIS = { x: DIM.rockerX, y: HEAD_Y + DIM.rockerY }
/** the head's water passage (head-local heights above the deck), its wall and the boss round each port, guide and bore */
export const HEAD_PASSAGE = { y0: 0.03, y1: 0.068, wall: 0.012, boss: 0.005 }
/**
 * Coolant outlet through the top of the head for the thermostat: engine-frame x, z = front + dz (over
 * cylinder 1's exhaust port, clear of the rocker cover and injector); its top face is at HEAD_Y + headHeight.
 */
export const HEAD_OUTLET = { x: 0.055, dz: -0.03, r: 0.012, topY: HEAD_Y + DIM.headHeight }
/** water-pump inlet into the jacket through the front of the block (engine frame x, y; it runs from cylinder 1's jacket out to the block's front face) */
export const BLOCK_INLET = { x: 0, y: CROWN_TDC - 0.09, r: 0.012 }
export { CROWN_TDC }
