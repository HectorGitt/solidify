import { create } from 'zustand'
import { FARMLAND, dynamicLoads } from '@/physics/chassis'
import { BRIXIUS, brixius, mobilityNumber, slipForNTR } from '@/physics/traction'
import { FARMLAND_D, FARMLAND_GEARS, gearTrainEfficiency, operatingPoint, overallEfficiency } from '@/physics/tractor'

/**
 * Traction lab: the Farmland tractor (Macmillan Ch 2, MECH p1–10) on a test track, with the
 * slip and rolling resistance either set by hand (Macmillan's lossy analysis) or predicted from
 * the soil by the Brixius equations (Lecture27, Zoz & Grisso). Display units in the store.
 */

export type Gear = '3' | '5' | '7'
export type View = 'tractor' | 'wheel'
export type Soil = 'firm' | 'tilled' | 'soft'
export type TyreKind = 'bias' | 'radial'
export type SlipMode = 'brixius' | 'manual'

export interface LabParams {
  view: View
  gear: Gear
  /** drawbar pull, kN */
  pull: number
  soil: Soil
  tyre: TyreKind
  slipMode: SlipMode
  /** manual wheelslip, fraction */
  slip: number
  /** manual rolling resistance, kN */
  rolling: number
  /** ideal analysis: no slip, no rolling resistance, ηr = 1 */
  ideal: boolean
  /** rear ballast, kg */
  ballast: number
  /** engine (thermal) efficiency for ηo */
  etaE: number
}

export const DEFAULTS: LabParams = { view: 'tractor', gear: '3', pull: 12, soil: 'tilled', tyre: 'bias', slipMode: 'brixius', slip: 0.12, rolling: 1.5, ideal: false, ballast: 0, etaE: 0.3 }

interface Store extends LabParams {
  set: (p: Partial<LabParams>) => void
  reset: () => void
}

export const useLab = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

const g = 9.81
export const D = FARMLAND_D
export const ETA_R = gearTrainEfficiency(5)

/**
 * 14.9-28 rear tyre: section width b 0.378 m, unloaded diameter d 1.32 m, section height h 0.304 m;
 * deflection δ = r − slr with slr = rr/1.06 (L27 p6). Front 7.50-16 typical.
 */
export const REAR_TYRE = { b: 0.378, d: 1.32, h: 0.304, delta: 0.66 - 0.635 / 1.06 }
export const FRONT_TYRE = { b: 0.19, d: 0.78, h: 0.19, delta: 0.025 }

/** Cone index (Pa). 860 kPa is the L27 example input; the others are typical values (Fig 45 is not in the extract). */
export const SOILS: Record<Soil, { CI: number; label: string; pde: number; beyond: boolean }> = {
  firm: { CI: 1500e3, label: 'Firm (CI 1500 kPa)', pde: 1, beyond: true },
  tilled: { CI: 860e3, label: 'Tilled (CI 860 kPa)', pde: 2, beyond: false },
  soft: { CI: 450e3, label: 'Soft (CI 450 kPa)', pde: 3, beyond: true },
}

export function chassisOf(ballast: number) {
  const W = FARMLAND.W + ballast * g
  return { ...FARMLAND, W, xr: (FARMLAND.W * FARMLAND.xr) / W }
}

export function solve(p: LabParams) {
  const c = chassisOf(p.ballast)
  const P = p.pull * 1000
  const loads = dynamicLoads(c, P, 0, 0)
  const q = FARMLAND_GEARS[Number(p.gear)]
  const k = BRIXIUS[p.tyre]
  const CI = SOILS[p.soil].CI
  const BnR = mobilityNumber(CI, REAR_TYRE.b, REAR_TYRE.d, loads.Vr / 2, REAR_TYRE.delta, REAR_TYRE.h)
  const BnF = mobilityNumber(CI, FRONT_TYRE.b, FRONT_TYRE.d, Math.max(loads.Vf, 1) / 2, FRONT_TYRE.delta, FRONT_TYRE.h)
  let i: number
  let R: number
  let etaR = ETA_R
  let spin = false
  const Rf = brixius(BnF, 0, k).MRR * Math.max(loads.Vf, 0)
  const NTR = (P + Rf) / loads.Vr
  let br = brixius(BnR, 0, k)
  if (p.ideal) {
    i = 0
    R = 0
    etaR = 1
  } else if (p.slipMode === 'manual') {
    i = p.slip
    R = p.rolling * 1000
  } else {
    const s = slipForNTR(BnR, NTR, k)
    spin = !Number.isFinite(s)
    i = spin ? 1 : s
    br = brixius(BnR, spin ? 0.99 : s, k)
    R = Rf + br.MRR * loads.Vr
  }
  const op = operatingPoint(P, R, Math.min(i, 0.999), q, D, etaR)
  const etaO = overallEfficiency(p.etaE, etaR, op.etaT)
  return { c, P, ...loads, q, BnR, BnF, Rf, NTR, br, i, R, etaR, spin, op, etaO, stalled: op.stalled }
}

export type Solved = ReturnType<typeof solve>

/** Simple sinkage for the ruts (display only, beyond notes): deeper on soft soil and at high slip. */
export function sinkage(Bn: number, slip: number) {
  return Math.min(0.08, 0.5 / Math.max(Bn, 5) + 0.03 * slip)
}

/** Live values written by the viewport. */
export const live = { x: -6, V: 0, V0: 0, slip: 0 }
