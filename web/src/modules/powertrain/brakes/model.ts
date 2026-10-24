import { create } from 'zustand'
import { balancedPressures, hydraulicBrake, frictionBrakeTorque } from '@/physics/drives'
import { ballRampBrake, expandingShoeBrake, type ExpandingShoeGeometry } from '@/physics/transmission'
import { frictionRadiusUniformWear } from '@/physics/clutch'

/**
 * Tractor brakes (TTS Figs 36–37 p11–13; TOP Fig A2.14 p9). One brake is drawn at a time, axis
 * along Z through the origin, with the two brake pedals, master cylinders and balancing valve
 * to its right (+X). Sizes are typical; the notes give none.
 */
export type BrakeType = 'shoe' | 'disc' | 'wet'

export const PEDALS = { x: 0.42, pivotY: 0.3, arm: 0.26, z: 0.055, mcY: 0.24, mcX: 0.58 }

/** Expanding shoe (AEE503 M9 geometry convention: angles from the pivot line). */
export const SHOE: ExpandingShoeGeometry = { r: 0.15, w: 0.045, a: 0.12, c: 0.24, f: 0.35, theta1: (10 * Math.PI) / 180, theta2: (150 * Math.PI) / 180 }
/** Cam lever: actuating force at each shoe tip per newton of pedal force (mechanical advantage). */
export const SHOE_LEVER = 12

/** Ball-ramp disc brake (TOP Fig A2.14). */
export const DISC = { rIn: 0.07, rOut: 0.13, rBall: 0.085, ramp: (35 * Math.PI) / 180, f: 0.35, surfaces: 4, linkRatio: 7 }

/** Wet multi-plate brake: 4 sintered discs → 8 friction surfaces; annular piston. */
export const WET = { discs: 4, plates: 5, rIn: 0.06, rOut: 0.15, f: 0.1, pistonR0: 0.09, pistonR1: 0.115, returnForce: 2000 }

/** Hydraulic brake circuit: pedal ratio and Ø19 mm master cylinders (typical). */
export const HYD = { pedalRatio: 5, masterArea: (Math.PI / 4) * 0.019 ** 2 }

export interface BrakeParams {
  type: BrakeType
  /** pedal travel 0…1 */
  left: number
  right: number
  latched: boolean
  /** maximum pedal force, N */
  pedalForce: number
  /** fast-shaft speed when rolling, rpm */
  shaftRpm: number
  /** final-reduction ratio between brake shaft and wheel */
  finalRatio: number
}

export const DEFAULTS: BrakeParams = { type: 'disc', left: 0, right: 0, latched: true, pedalForce: 400, shaftRpm: 300, finalRatio: 4.8 }

interface Store extends BrakeParams {
  set: (p: Partial<BrakeParams>) => void
  reset: () => void
}

export const useBrakes = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Effective pedal travel at each brake: latched pedals move together. */
export function pedalTravel(p: Pick<BrakeParams, 'left' | 'right' | 'latched'>) {
  if (!p.latched) return { left: p.left, right: p.right }
  const m = Math.max(p.left, p.right)
  return { left: m, right: m }
}

/** Torque at the left brake for the selected type (N·m), with the intermediate values. */
export function brakeTorque(p: BrakeParams) {
  const travel = pedalTravel(p)
  const Fp = travel.left * p.pedalForce
  const hydL = hydraulicBrake(travel.left * p.pedalForce, HYD.pedalRatio, HYD.masterArea, 1)
  const hydR = hydraulicBrake(travel.right * p.pedalForce, HYD.pedalRatio, HYD.masterArea, 1)
  const pr = balancedPressures(hydL.p, hydR.p, p.latched)
  if (p.type === 'shoe') {
    const F = Fp * SHOE_LEVER
    const r = expandingShoeBrake(F, SHOE)
    return { T: Fp > 0 ? r.T : 0, F, detail: r, pressure: pr.left }
  }
  if (p.type === 'disc') {
    const P = Fp * DISC.linkRatio
    const r = ballRampBrake({ P, rampAngle: DISC.ramp, rBall: DISC.rBall, rFriction: frictionRadiusUniformWear(DISC.rOut, DISC.rIn), f: DISC.f, surfaces: DISC.surfaces })
    return { T: r.T, F: r.F, detail: r, pressure: pr.left }
  }
  const area = Math.PI * (WET.pistonR1 ** 2 - WET.pistonR0 ** 2)
  const F = Math.max(0, pr.left * area - WET.returnForce)
  // each sintered disc has a steel plate on both faces: 2 friction surfaces per disc
  const surfaces = 2 * WET.discs
  const T = frictionBrakeTorque(WET.f, F, frictionRadiusUniformWear(WET.rOut, WET.rIn), surfaces)
  return { T, F, detail: { area, surfaces }, pressure: pr.left }
}

export const live = { shaft: 0, left: 0, right: 0 }
