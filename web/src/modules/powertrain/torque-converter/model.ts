import { create } from 'zustand'
import { converterPoint } from '@/physics/drives'
import { TYPICAL_CONVERTER } from '@/physics/transmission'

/**
 * Three-element torque converter (design D of PT p10: 1 pump, 1 stator, 1 turbine).
 * Frame: metres, axis along Z, engine at −Z, transmission at +Z. The torus has centre radius
 * RC and radius A; the impeller (pump) is the rear (+Z) half, welded to the front cover that
 * the engine drives; the turbine is the front half, splined to the output shaft; the stator
 * sits at the inner gap on a one-way clutch on the stationary sleeve. Sizes are typical.
 */
export const TC = {
  RC: 0.12,
  A: 0.07,
  /** core ring radius (blades span B…A from the torus centre) */
  B: 0.034,
  shell: 0.006,
  /** shells stop this far short of the inner point to leave room for the stator (rad) */
  innerGap: 0.55,
  impellerBlades: 27,
  turbineBlades: 25,
  statorBlades: 13,
  statorR0: 0.05,
  statorR1: 0.084,
  statorHalf: 0.016,
  sleeveR0: 0.02,
  sleeveR1: 0.028,
  rollerR: 0.031,
  shaftR: 0.017,
  housingR: 0.225,
  coverZ: -0.105,
}

export interface TcParams {
  /** speed ratio N_turbine / N_impeller */
  SR: number
  rpm: number
  /** engine torque into the impeller, N·m */
  torque: number
  flows: boolean
}

export const DEFAULTS: TcParams = { SR: 0, rpm: 1800, torque: 300, flows: true }

interface TcStore extends TcParams {
  set: (p: Partial<TcParams>) => void
  reset: () => void
}

export const useTc = create<TcStore>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const SPEC = TYPICAL_CONVERTER

export const point = (p: Pick<TcParams, 'SR' | 'rpm' | 'torque'>) => converterPoint(p.rpm, p.torque, p.SR, SPEC)

export const live = { impeller: 0, turbine: 0, stator: 0 }

export const rpmToRad = (n: number) => (n * 2 * Math.PI) / 60
export const radToRpm = (w: number) => (w * 60) / (2 * Math.PI)
