import type { PedalSpec } from '@/physics/gearing'
import { TYPICAL_PEDAL } from '@/physics/gearing'

/**
 * Clutch dimensions (metres). Shaft axis = Z; the flywheel friction face is z = 0, the engine is
 * towards −Z and the gearbox towards +Z (TTS Fig 31 is drawn the same way round, engine left).
 * Sizes are typical for a 40–60 kW tractor (the notes give no dimensions).
 */
export const SP = {
  /** single plate: lining outer / inner radius (300 × 180 mm facings) */
  Ro: 0.15,
  Ri: 0.09,
  lining: 0.0035,
  core: 0.002,
  /** pressure plate */
  ppIn: 0.086,
  ppOut: 0.153,
  ppT: 0.024,
  /** nine coil springs on this radius */
  springR: 0.112,
  springs: 9,
  springFree: 0.062,
  springCoil: 0.012,
  /** clamp load of all springs together, N */
  clampLoad: 7200,
  mu: 0.3,
  coverZ: 0.078,
  levers: 3,
  /** release lever: inner end, pivot and outer (pressure-plate) end radii */
  leverIn: 0.048,
  leverPivot: 0.124,
  leverOut: 0.146,
  bearingIn: 0.034,
  bearingOut: 0.056,
  shaftR: 0.02,
  /** flywheel and starter ring gear */
  flyR: 0.19,
  ringTeeth: 136,
  ringModule: 0.003,
}

export const DISC_T = 2 * SP.lining + SP.core
/** visual exaggeration of axial clearances (real lift ≈ 1.6 mm) */
export const GAP_X = 4
export const LEVER_RATIO = (SP.leverPivot - SP.leverIn) / (SP.leverOut - SP.leverPivot)
/** pedal mm per mm of release-bearing travel */
export const PEDAL_RATIO = 12

/** Dual clutch (TOP Fig A2.9): primary = transmission plate, secondary = PTO plate. */
export const DC = {
  pRo: 0.14,
  pRi: 0.085,
  sRo: 0.135,
  sRi: 0.08,
  ppZ: DISC_T,
  ppT: 0.022,
  ffZ0: 0.07,
  ffZ1: 0.098,
  sDiscZ: 0.098,
  spZ: 0.098 + DISC_T,
  spT: 0.02,
  coverZ: 0.142,
  ptoIn: 0.026,
  ptoOut: 0.034,
  primaryLoad: 6000,
  secondaryLoad: 4500,
  mu: 0.3,
}

/** Two-stage pedal: the first half frees the transmission plate, full travel the PTO plate. */
export const DUAL_PRIMARY: PedalSpec = { ...TYPICAL_PEDAL, bite: 25, liftPerMm: 0.04, cleanLift: 1.0 }
export const DUAL_STAGE2 = 62

/** Wet multi-plate IPTO clutch (TOP Fig A2.10). */
export const WP = {
  hubR: 0.05,
  fIn: 0.052,
  fOut: 0.085,
  sIn: 0.058,
  sOut: 0.095,
  drumIn: 0.097,
  drumOut: 0.106,
  friction: 5,
  plateT: 0.0028,
  steelT: 0.002,
  pistonIn: 0.055,
  pistonOut: 0.095,
  mu: 0.1,
  /** working pressure, Pa (≈ 15 bar; beyond notes) */
  pressure: 15e5,
  belleville: 3000,
  /** pressure rise / fall time constant through the fixed orifice, s */
  tau: 0.25,
}
export const WP_STACK = WP.friction * WP.plateT + (WP.friction - 1) * WP.steelT
export const PISTON_AREA = Math.PI * (WP.pistonOut ** 2 - WP.pistonIn ** 2)
