import { create } from 'zustand'
import { hydroLoop, type HydroLoopResult, type PistonUnit } from '@/physics/drives'
import type { HydroCombo } from '@/physics/transmission'

/**
 * Hydrostatic drive: an axial-piston swashplate pump driving an axial-piston motor through a
 * closed loop of high- and low-pressure lines (PT p8–9; TTS p5). Both units are the same size
 * (typical; the notes give no data): 9 pistons, 18 mm bore on a 72 mm pitch circle, 18° maximum
 * swashplate angle → 53.6 cm³/rev.
 *
 * Frame: metres, Y up. Unit axes along Z (shafts out to +Z), pump centred at x = −UNIT_X, motor at
 * x = +UNIT_X. In each unit the swashplate face is z = SW_Z + y·tan β, the cylinder block sits
 * behind it and the valve plate and end cover behind that.
 */
export const UNIT: PistonUnit = { pistons: 9, bore: 0.018, pitchR: 0.036, maxAngle: (18 * Math.PI) / 180 }

export const DIM = {
  unitX: 0.22,
  /** cylinder block */
  blockR: 0.058,
  blockZ0: -0.042,
  blockZ1: 0.028,
  /** swashplate face (at the shaft axis) */
  swZ: 0.052,
  swR: 0.062,
  swT: 0.014,
  slipperR: 0.0105,
  slipperT: 0.006,
  /** piston: ball centre to bottom */
  pistonL: 0.064,
  pistonR: 0.0088,
  /** valve plate and end cover */
  valveZ0: -0.05,
  coverZ0: -0.075,
  bossZ: -0.095,
  /** port centres on the end cover (x offset from the unit axis) */
  portX: 0.035,
  /** housing */
  housingR: 0.085,
  housingIn: 0.077,
  housingZ1: 0.09,
  shaftR: 0.014,
  /** pipe run depths behind the units */
  outerZ: -0.175,
  innerZ: -0.135,
  pipeR: 0.011,
  pipeIn: 0.0085,
  /** output wheel on the motor shaft */
  wheelZ: 0.215,
  wheelR: 0.12,
}

/* ------------------------------ Parameters ------------------------------ */

export interface HydroParams {
  combo: HydroCombo
  /** pump swashplate lever, −1…1 */
  pumpLever: number
  /** motor swashplate lever, 0.3…1 (variable motors only) */
  motorLever: number
  /** engine (pump) speed, rpm */
  rpm: number
  /** loop pressure difference, MPa */
  dp: number
  etaV: number
  etaT: number
  flows: boolean
}

export const DEFAULTS: HydroParams = { combo: 'VDP-FDM', pumpLever: 0.6, motorLever: 1, rpm: 2000, dp: 20, etaV: 0.95, etaT: 0.92, flows: true }

interface HydroStore extends HydroParams {
  set: (p: Partial<HydroParams>) => void
  reset: () => void
}

export const useHydro = create<HydroStore>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function solveLoop(p: HydroParams): HydroLoopResult {
  return hydroLoop({ combo: p.combo, setting: { pumpLever: p.pumpLever, motorLever: p.motorLever }, pump: UNIT, motor: UNIT, Np: p.rpm, dp: p.dp, etaV: p.etaV, etaT: p.etaT })
}

/* ------------------------------ Live values ------------------------------ */

export interface LiveHydro {
  pumpRpm: number
  motorRpm: number
  /** displayed swashplate angles (they slew towards the lever), rad */
  pumpAngle: number
  motorAngle: number
}

export const live: LiveHydro = { pumpRpm: 0, motorRpm: 0, pumpAngle: 0, motorAngle: UNIT.maxAngle }

/** Piston ball-centre z (unit frame) for a piston at absolute angle φ on a plate at angle β. */
export function pistonBallZ(phi: number, beta: number) {
  return DIM.swZ + UNIT.pitchR * Math.sin(phi) * Math.tan(beta) - DIM.slipperT
}

export const rpmToRad = (n: number) => (n * 2 * Math.PI) / 60
export const radToRpm = (w: number) => (w * 60) / (2 * Math.PI)
