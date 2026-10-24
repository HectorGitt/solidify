/**
 * Tractor electrical, ignition and starting systems — AEE509.
 * Sources:
 *  - 509 Lecture 4 (battery/coil ignition: 6/12 V, primary 200–300 turns of 20 SWG, secondary ≈ 21 000 turns
 *    of 40 SWG; breaker cam with 4 corners for 4 cylinders, a hexagon for 6);
 *  - extract fromtextbook(509) ch.5: spark needs 10–15 kV (p27); magneto field reverses every half
 *    revolution (p28); plug gap ≈ 0.6 mm and spark ≈ 25° BTDC (p30); 2 V per cell, 12 V tractor
 *    battery, SG 1.27, 100 Ah = 5 A for 20 h or 10 A for 10 h (p31); starter 12 V or 24 V (p32).
 * RL current build-up, transformer step-up and the generator charging curve are standard
 * electrical theory added for the mechanism (flagged "beyond notes" in the UI).
 */

/* ------------------------------ Battery ------------------------------ */

/** Nominal lead–acid cell voltage (TB p31). */
export const CELL_VOLTS = 2

export function batteryVoltage(cells: number) {
  return cells * CELL_VOLTS
}

export function cellsFor(volts: number) {
  return Math.round(volts / CELL_VOLTS)
}

/** Hours a battery of capacity Ah can supply a current I (TB p31: 100 Ah → 5 A × 20 h, 10 A × 10 h). */
export function batteryHours(capacityAh: number, currentA: number) {
  return capacityAh / currentA
}

/** Electrolyte specific gravity, fully charged (TB p31). */
export const SG_CHARGED = 1.27

/* ------------------------------ Coil ignition ------------------------------ */

/** Breaker-cam lobes = cylinders (L4: 4 corners for a 4-cylinder engine, hexagon for 6). */
export function breakerLobes(cylinders: number) {
  return cylinders
}

/** Sparks per minute for a four-stroke engine: each cylinder fires once per 2 revolutions. */
export function sparksPerMinute(rpm: number, cylinders: number) {
  return (rpm * cylinders) / 2
}

/** Ideal step-up of the ignition coil (auto-transformer): V₂ = V₁ · N₂/N₁. */
export function coilSecondaryVoltage(primaryVolts: number, primaryTurns: number, secondaryTurns: number) {
  return primaryVolts * (secondaryTurns / primaryTurns)
}

/**
 * Time the contact-breaker points stay closed per spark. dwellFraction is the fraction of each
 * lobe interval the points are closed (e.g. 0.6 → 54° of the 90° per lobe on a 4-cylinder cam).
 */
export function dwellTime(rpm: number, cylinders: number, dwellFraction: number) {
  return (60 / sparksPerMinute(rpm, cylinders)) * dwellFraction
}

/** Primary current after the points have been closed for t seconds: i = (V/R)(1 − e^(−tR/L)). */
export function primaryCurrent(t: number, volts: number, resistance: number, inductance: number) {
  return (volts / resistance) * (1 - Math.exp((-t * resistance) / inductance))
}

/** Energy stored in the coil's magnetic field, ½ L i², J. */
export function coilEnergy(inductance: number, current: number) {
  return 0.5 * inductance * current * current
}

/** Time (s) by which a spark at `deg` before TDC leads TDC at engine speed rpm. */
export function advanceTime(deg: number, rpm: number) {
  return deg / (6 * rpm)
}

/** Magneto: the field through the armature reverses every half revolution → 2 sparks per rev (TB p28). */
export const MAGNETO_SPARKS_PER_REV = 2

/* ------------------------------ Starting ------------------------------ */

/** Starter pinion → flywheel ring-gear reduction. */
export function starterRatio(ringTeeth: number, pinionTeeth: number) {
  return ringTeeth / pinionTeeth
}

/** Electrical power drawn by the starter, W. */
export function starterPower(volts: number, amps: number) {
  return volts * amps
}

/* ------------------------------ Charging ------------------------------ */

export interface GeneratorModel {
  /** open-circuit EMF per generator rpm, V/rpm */
  kE: number
  /** internal + line resistance, Ω */
  resistance: number
  /** current limit set by the regulator / stator, A */
  maxCurrent: number
}

/**
 * Charging current into a battery at voltage Vb. The cut-out (dynamo) or diodes (alternator)
 * prevent the battery discharging back into the generator when E < Vb (TB p31–32).
 */
export function chargeCurrent(genRpm: number, batteryVolts: number, g: GeneratorModel) {
  const E = g.kE * genRpm
  if (E <= batteryVolts) return 0
  return Math.min(g.maxCurrent, (E - batteryVolts) / g.resistance)
}

/** Generator speed at which charging begins (cut-in). */
export function cutInRpm(batteryVolts: number, g: GeneratorModel) {
  return batteryVolts / g.kE
}

/** Typical dynamo vs alternator (beyond notes): the alternator charges from a lower speed. */
export const DYNAMO: GeneratorModel = { kE: 13.6 / 1500, resistance: 0.12, maxCurrent: 22 }
export const ALTERNATOR: GeneratorModel = { kE: 13.6 / 1000, resistance: 0.06, maxCurrent: 45 }
