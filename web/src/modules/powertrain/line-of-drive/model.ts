import { create } from 'zustand'
import { FARMLAND_D, FARMLAND_GEARS, farmlandTorque, gearTrainEfficiency, operatingPoint } from '@/physics/tractor'
import { epicyclicReduction, reductionTable, type Stage } from '@/physics/transmission'
import { CROWN } from '@/tractor/geometry'

/**
 * Line of drive: the "Farmland" tractor of Tractor Mechanics AEE502 (Macmillan Ch. 2) with
 * the engine curve and overall ratios q of MECH p4. The engine is a governed torque source, the
 * transmission a ratio q with efficiency ηr, and the wheel a rolling diameter D with slip.
 * q is split into the three reductions of TTS p1/p10: gearbox × crown wheel & pinion × final.
 */

export type Gear = '3' | '5' | '7'
export type Drive = '1wd' | '2wd' | '4wd'

export interface DriveParams {
  gear: Gear
  /** drawbar pull, kN */
  pull: number
  /** rolling resistance, kN */
  rolling: number
  /** wheelslip, fraction */
  slip: number
  /** transmission efficiency */
  etaR: number
  drive: Drive
  /** show the power-flow particles */
  flow: boolean
}

export const DEFAULTS: DriveParams = { gear: '3', pull: 12, rolling: 1.2, slip: 0.12, etaR: gearTrainEfficiency(5), drive: '2wd', flow: true }

interface Store extends DriveParams {
  set: (p: Partial<DriveParams>) => void
  reset: () => void
}

export const useDrive = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Engine-to-PTO ratio: 540 rpm at 2100 engine rpm (typical; the notes give only the 540 standard). */
export const PTO_RATIO = 2100 / 540

export const D = FARMLAND_D

/** Crown wheel & pinion of the shared tractor (37 : 9) and a 15/57 epicyclic final drive (typical). */
export const CROWN_RATIO = CROWN.teeth / CROWN.pinion
export const FINAL_RATIO = epicyclicReduction(15, 57)

/** Gearbox ratio implied by the overall ratio q of MECH p4. */
export const gearboxRatio = (q: number) => q / (CROWN_RATIO * FINAL_RATIO)

/** Front axle of a front-wheel-assist tractor runs ≈ 3 % faster than the rear (typical lead; beyond notes). */
export const FRONT_LEAD = 1.03

export function solve(p: Pick<DriveParams, 'gear' | 'pull' | 'rolling' | 'slip' | 'etaR'>) {
  const q = FARMLAND_GEARS[Number(p.gear)]
  const op = operatingPoint(p.pull * 1000, p.rolling * 1000, p.slip, q, D, p.etaR)
  const Ne = op.rpm / 60
  const Nw = Ne / q
  const Qw = 2 * Math.PI * op.Tw * Nw // wheel power
  return { q, ...op, Ne, Nw, Qw, etaRcheck: Qw / Math.max(op.Qe, 1e-9), Tcurve: farmlandTorque(op.rpm) }
}

export type Solved = ReturnType<typeof solve>

/** Speed and torque after each of the three reductions (TTS p1, p10). */
export function stages(q: number, rpm: number, Te: number) {
  const s: Stage[] = [
    { name: 'Gearbox', ratio: gearboxRatio(q), pairs: 3 },
    { name: 'Crown wheel & pinion', ratio: CROWN_RATIO, pairs: 1 },
    { name: 'Final reduction', ratio: FINAL_RATIO, pairs: 1 },
  ]
  return reductionTable(rpm, Te, s)
}

/** Live values for the panel (written by the viewport each frame). */
export const live = { t: 0, rpm: 0, V: 0, V0: 0 }
