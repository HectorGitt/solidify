import { create } from 'zustand'
import { CVT } from '@/physics/cvt'

/**
 * Hydro-mechanical power-split CVT (input-coupled, Vario-type layout). Typical sizes, not a
 * specific model: planetary z_s 42 / z_p 18 / z_r 78, module 4 mm; ring take-off 72 → pump 48;
 * summing gear 60 → motor 60; pump and motor are the hydrostatic scene's axial-piston units
 * scaled 1.5× (≈ 181 cm³/rev at 18°).
 *
 * Frame: metres, Y up. Main axis along Z: engine at −Z, output at +Z. The pump sits above the
 * main axis, the motor below, both with their shafts pointing to −Z (towards their gears).
 */

export const M = 0.004
export const RS = (M * CVT.zs) / 2
export const RP = (M * CVT.zp) / 2
export const RR = (M * CVT.zr) / 2
export const RC = RS + RP
export const PG_W = 0.04
export const N_PLANETS = 4

export const G = {
  /** ring take-off gear (on the ring hub) and the pump gear */
  zTake: 72,
  zPump: 48,
  takeZ: 0.08,
  /** summing gear (on the output shaft) and the motor gear */
  zSum: 60,
  zMotor: 60,
  sumZ: 0.145,
  width: 0.026,
  /** pump and motor axis offsets */
  pumpY: (M * (72 + 48)) / 2,
  motorY: -(M * (60 + 60)) / 2,
}

/** Hydrostatic-unit scale and the world z of each unit's local origin (unit turned to face −Z). */
export const UNIT_SCALE = 1.5
/** local shaft end of the hydrostatic unit (its coupling flange) */
const SHAFT_END = 0.16
export const PUMP_Z0 = G.takeZ + SHAFT_END * UNIT_SCALE - 0.002
export const MOTOR_Z0 = G.sumZ + SHAFT_END * UNIT_SCALE - 0.002

export const DAMPER_Z = -0.42
export const OUTPUT_Z = 0.78

export type Range = 'field' | 'road'

export interface CvtParams {
  /** engine speed, rpm */
  rpm: number
  /** requested ground speed, km/h (negative = reverse) */
  target: number
  range: Range
  /** drawbar pull, kN */
  pull: number
  /** drive the lever directly instead of by speed (lever 0…2, below 0 reverse) */
  manual: boolean
  lever: number
  flows: boolean
  powerFlow: boolean
}

export const DEFAULTS: CvtParams = {
  rpm: 1700,
  target: 8,
  range: 'field',
  pull: 20,
  manual: false,
  lever: 0.6,
  flows: true,
  powerFlow: true,
}

interface Store extends CvtParams {
  set: (p: Partial<CvtParams>) => void
  reset: () => void
}

export const useCvt = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Values written by the physics step every frame and read by the panel. */
export const live = {
  /** lever as it slews towards the target */
  L: DEFAULTS.lever,
  alpha: 0,
  beta: 1,
  engine: 0,
  out: 0,
  ring: 0,
  pump: 0,
  motor: 0,
  speed: 0,
  dp: 0,
  hydShare: 0,
  efficiency: 0,
  Pout: 0,
  Pin: 0,
  Te: 0,
  limited: false,
}

export const radToRpm = (w: number) => (w * 60) / (2 * Math.PI)
export const rpmToRad = (n: number) => (n * 2 * Math.PI) / 60
