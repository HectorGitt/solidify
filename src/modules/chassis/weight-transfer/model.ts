import { create } from 'zustand'
import {
  FARMLAND,
  cgFromFrontWeight,
  cgFromRaisedFront,
  cgHeightFromRaise,
  dynamicLoads,
  liftPull,
  raiseAngle,
  raisedFrontReading,
  raisedSpacing,
  requiredPsi,
  staticFront,
  staticRear,
  type Chassis,
} from '@/physics/chassis'
import { TRACTOR } from '@/tractor/dims'

/**
 * Weight transfer (Macmillan Ch 6, eqs 6.1–6.8) for the shared "Farmland" tractor pulling through
 * its drawbar on a slope, plus the "raise the front" method of finding the CG height.
 * Inputs in the store use display units (deg, kN); the physics is SI.
 */

export type ChassisId = 'farmland' | 'exam'
export type Mode = 'pull' | 'cg'

export interface WTParams {
  mode: Mode
  chassis: ChassisId
  /** slope, deg (negative = facing downhill) */
  alpha: number
  /** drawbar pull, kN */
  pull: number
  /** pull angle below the horizontal, deg */
  theta: number
  /** drawbar height y′, m */
  yd: number
  /** drawbar overhang x′ behind the rear contact point, m */
  xd: number
  /** rolling-resistance coefficient ρ */
  rho: number
  /** CG mode: front-axle height when raised, m */
  lift: number
}

export const DEFAULTS: WTParams = { mode: 'pull', chassis: 'farmland', alpha: 0, pull: 10, theta: 5, yd: 0.45, xd: 0.6, rho: 0.05, lift: 1.25 }

interface Store extends WTParams {
  set: (p: Partial<WTParams>) => void
  reset: () => void
}

export const useWT = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** The AEE510 2022/23 exam tractor (Q2c): W 28.5 kN, Rf 9 kN, L 2083 mm; r and yg not given (Farmland values used). */
export const EXAM_TRACTOR: Chassis = { W: 28.5e3, x: 2.083, xr: cgFromFrontWeight(9, 28.5, 2.083), yg: 0.13, r: 0.635, xd: 0.6, yd: 0.58 }

export const CHASSIS: Record<ChassisId, Chassis> = { farmland: FARMLAND, exam: EXAM_TRACTOR }

/** Front tyre rolling radius of the shared tractor (typical 7.50-16). */
export const RF = TRACTOR.front.radius

const deg = Math.PI / 180

export function chassisOf(p: Pick<WTParams, 'chassis' | 'xd' | 'yd'>): Chassis {
  return { ...CHASSIS[p.chassis], xd: p.xd, yd: p.yd }
}

export function solve(p: WTParams) {
  const c = chassisOf(p)
  const P = p.pull * 1000
  const th = p.theta * deg
  const al = p.mode === 'cg' ? 0 : p.alpha * deg
  const d = dynamicLoads(c, P, th, al)
  const Wf = staticFront(c)
  const Wr = staticRear(c)
  const psi = requiredPsi(c, P, th, al, p.rho)
  const H = c.W * Math.sin(al) + P * Math.cos(th) + p.rho * (c.W * Math.cos(al) + P * Math.sin(th))
  const Plift = liftPull(c, th, al)
  const slopeT = (c.W * Math.sin(al) * (c.r + c.yg)) / c.x
  const pullT = (P * Math.cos(th) * c.yd) / c.x
  const vertT = (P * Math.sin(th) * c.xd) / c.x
  return { c, P, th, al, ...d, Wf, Wr, psi, H, Plift, slopeT, pullT, vertT, h: c.yd / (c.r + c.yg), rearShare: d.Vr / (d.Vf + d.Vr) }
}

export type Solved = ReturnType<typeof solve>

/** "Raise the front" CG method (Eqs 6.1–6.3), simulated scale readings for the chosen chassis. */
export function solveCg(p: WTParams) {
  const c = chassisOf(p)
  const rr = c.r
  const yLift = Math.max(p.lift, RF + 0.05)
  const xpp = raisedSpacing(rr, RF, c.x, yLift)
  const beta = raiseAngle(rr, RF, c.x, yLift, xpp)
  const Wf = staticFront(c)
  const Wf2 = raisedFrontReading(c, beta, xpp)
  const xr = cgFromFrontWeight(Wf, c.W, c.x)
  const xr2 = cgFromRaisedFront(Wf2, c.W, xpp)
  const yg = cgHeightFromRaise(xr, xr2, beta)
  return { c, rr, yLift, xpp, beta, Wf, Wf2, xr, xr2, yg }
}

/** Live values written by the viewport. */
export const live = { pitch: 0, lifted: false }
