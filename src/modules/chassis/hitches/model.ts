import { create } from 'zustand'
import { FARMLAND, hitchConditionLimits, hitchLoads, staticFront, staticRear, weightTransferHitchLoads, type HitchKind, type SoilForce } from '@/physics/chassis'

/**
 * Trailed vs semi-mounted vs fully mounted hitches under the same soil force S (Macmillan Ch 6,
 * Figs 6.1–6.3 and 6.10–6.12, Eqs 6.11–6.21), plus the weight-transfer hitch (Fig 6.15,
 * Eqs 6.30–6.31). All hitches use the same hitch point x′, y′ (the Farmland drawbar), as in
 * Macmillan's comparison.
 */

export type Hitch = HitchKind | 'wth'

export interface HitchParams {
  hitch: Hitch
  /** soil force, kN */
  S: number
  /** soil-force angle below horizontal, deg */
  theta: number
  /** soil force behind the hitch, m */
  b: number
  /** soil force depth below the ground, m */
  z: number
  /** semi-mounted: castor wheel behind the hitch, m */
  a: number
  /** weight-transfer hitch: trailer weight W′ (kN), lift force F (kN) and its arm c (m) */
  Wt: number
  F: number
  c: number
}

export const DEFAULTS: HitchParams = { hitch: 'mounted', S: 10, theta: 20, b: 1.2, z: 0.15, a: 2.0, Wt: 6, F: 3, c: 0.4 }

interface Store extends HitchParams {
  set: (p: Partial<HitchParams>) => void
  reset: () => void
}

export const useHitch = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const CH = FARMLAND
/** Weight-transfer hitch trailer: axle 2.4 m behind the hitch, W′ acting 1.6 m behind it (typical). */
export const WTH_A = 2.4
export const WTH_B = 1.6

const deg = Math.PI / 180

export const HITCH_LABEL: Record<Hitch, string> = { trailed: 'Trailed', semi: 'Semi-mounted', mounted: 'Fully mounted', wth: 'Weight-transfer hitch' }

export function soilOf(p: HitchParams): SoilForce {
  return { S: p.S * 1000, theta: p.theta * deg, a: p.a, b: p.b, z: p.z }
}

export function loadsFor(p: HitchParams, h: Hitch) {
  const s = soilOf(p)
  if (h === 'wth') {
    const r = weightTransferHitchLoads(CH, { Wt: p.Wt * 1000, a: WTH_A, b: WTH_B, P: s.S * Math.cos(s.theta), F: p.F * 1000, c: p.c })
    return { Vf: r.Vf, Vr: r.Vr, gainRear: r.gainRear, lossFront: r.lossFront, T: r.T }
  }
  return { ...hitchLoads(CH, s, h), T: 0 }
}

export function solve(p: HitchParams) {
  const s = soilOf(p)
  const all = { trailed: loadsFor(p, 'trailed'), semi: loadsFor(p, 'semi'), mounted: loadsFor(p, 'mounted'), wth: loadsFor(p, 'wth') }
  const lim = hitchConditionLimits(CH, s)
  const t = Math.tan(s.theta)
  const conditions = [
    { eq: '6.17', what: 'Mounted: rear axle gains weight', lim: lim.mountedRearGains, stated: t > lim.mountedRearGains, actual: all.mounted.gainRear > 0 },
    { eq: '6.18', what: 'Mounted: front axle loses weight', lim: lim.mountedFrontLoses, stated: t > lim.mountedFrontLoses, actual: all.mounted.lossFront > 0 },
    { eq: '6.19', what: 'Mounted gains more than semi-mounted', lim: lim.mountedOverSemi, stated: t > lim.mountedOverSemi, actual: all.mounted.gainRear > all.semi.gainRear },
    { eq: '6.20', what: 'Mounted gains more than trailed', lim: lim.mountedOverTrailed, stated: t > lim.mountedOverTrailed, actual: all.mounted.gainRear > all.trailed.gainRear },
    { eq: '6.21', what: 'Semi-mounted gains more than trailed', lim: lim.semiOverTrailed, stated: t > lim.semiOverTrailed, actual: all.semi.gainRear > all.trailed.gainRear },
  ]
  return { s, all, sel: all[p.hitch], Wf: staticFront(CH), Wr: staticRear(CH), tanTheta: t, conditions }
}

/** Walking (two-wheel) tractor, typical values (beyond notes): weight 2.4 kN, xr 0.15 m, r 0.3 m, yg 0.1 m, handle 1.2 m. */
export const WALKER = { W: 2400, xr: 0.15, r: 0.3, yg: 0.1, xh: 1.2, xd: 0.5, yd: 0.35 }
