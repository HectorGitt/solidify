import { create } from 'zustand'
import { cite } from '@/content/citations'
import { FARMLAND, dynamicLoads, instabilityPsi, liftPull, maxSlopes, pullForPsi, staticOverturnTan, tippingDrawbarHeight, type Chassis } from '@/physics/chassis'
import { LINKAGE, TRACTOR } from '@/tractor/dims'

/**
 * Slopes and overturning (Macmillan Ch 6, eqs 6.9–6.10 and 6.35; Problem 6.16) for the Farmland
 * tractor. Rear overturn: a load anchored behind the tractor (a stump) is pulled with a rising
 * force until either the rear tyres slip (ψ′ reaches what the soil gives) or the front lifts
 * (Vf = 0). Eq 6.35 decides which comes first. Side-slope rollover is beyond the notes.
 */

export type Mode = 'rear' | 'slope' | 'side'
export type HitchPoint = 'drawbar' | 'custom' | 'toplink'

export interface StabParams {
  mode: Mode
  hitchPoint: HitchPoint
  /** custom drawbar height y′, m */
  yd: number
  /** slope (uphill), deg */
  alpha: number
  /** largest gross tractive coefficient the soil/tyres can develop */
  psiMax: number
  /** rolling-resistance coefficient for the slope limits */
  rho: number
  /** side slope, deg */
  beta: number
}

const g = 9.81
const deg = Math.PI / 180

/** Problem 6.16 soil: A = 0.076 m² contact, c = 2 kPa, φ = 32°; with all the weight on the rear, ψ′ = (Ac + W tanφ)/W. */
export const P616 = { A: 0.076, c: 2000, phi: 32 * deg }
export const PSI_616 = (P616.A * P616.c + FARMLAND.W * Math.tan(P616.phi)) / FARMLAND.W

export const DEFAULTS: StabParams = { mode: 'rear', hitchPoint: 'drawbar', yd: 0.85, alpha: 0, psiMax: Math.round(PSI_616 * 100) / 100, rho: 0.05, beta: 15 }

interface Store extends StabParams {
  set: (p: Partial<StabParams>) => void
  reset: () => void
}

export const useStab = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Pull point for each choice: drawbar pin, raised drawbar, or the top-link chassis pin. */
export function hitchOf(p: Pick<StabParams, 'hitchPoint' | 'yd'>): { xd: number; yd: number } {
  if (p.hitchPoint === 'toplink') return { xd: -LINKAGE.topPivot.x, yd: LINKAGE.topPivot.y }
  if (p.hitchPoint === 'custom') return { xd: FARMLAND.xd, yd: p.yd }
  return { xd: FARMLAND.xd, yd: FARMLAND.yd }
}

export function chassisOf(p: StabParams): Chassis {
  return { ...FARMLAND, ...hitchOf(p) }
}

/** Static side-overturn angle on a side slope: tanβ = (track/2)/CG height (beyond notes; rigid axle). */
export function sideTipTan(track = TRACTOR.rear.track, hcg = FARMLAND.r + FARMLAND.yg) {
  return track / 2 / hcg
}

export function solve(p: StabParams) {
  const c = chassisOf(p)
  const al = p.mode === 'side' ? 0 : p.alpha * deg
  const ta = Math.tan(al)
  const tas = staticOverturnTan(c)
  const h = c.yd / (c.r + c.yg)
  const psiInst = instabilityPsi(ta, tas, h)
  // horizontal pull (θ = 0) at which the front lifts, and the pull the tyres can give at psiMax
  const Plift = liftPull(c, 0, al)
  const Pslip = pullForPsi(c, p.psiMax, 0, al, 0)
  const rears = p.psiMax > psiInst && al < Math.atan(tas)
  const slopes = maxSlopes(c, p.psiMax, p.rho)
  const yTip = tippingDrawbarHeight(FARMLAND.W, FARMLAND.xr, P616.A, P616.c, P616.phi)
  const sideTan = sideTipTan()
  return {
    c,
    al,
    ta,
    tas,
    alphaS: Math.atan(tas),
    h,
    psiInst,
    Plift,
    Pslip,
    rears,
    slopes,
    yTip,
    sideTan,
    sideTips: p.beta * deg > Math.atan(sideTan),
    staticOver: al >= Math.atan(tas),
  }
}

export type Solved = ReturnType<typeof solve>

/** Front load at a given pull (for the live readout). */
export function frontAt(p: StabParams, P: number) {
  const c = chassisOf(p)
  return dynamicLoads(c, P, 0, p.mode === 'side' ? 0 : p.alpha * deg).Vf
}

/** Live values written by the viewport. */
export const live = { P: 0, pitch: 0, roll: 0, phase: 'pulling' as 'pulling' | 'slipping' | 'rearing' | 'over' | 'rolling', t: 0 }

export const HFS = (where: string) => cite('AEE510', 'Human Factors in Agricultural Tractor Safety.pdf', where)
export const W_KG = FARMLAND.W / g
