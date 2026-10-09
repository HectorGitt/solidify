import { create } from 'zustand'
import { blaneyCriddle, jensenHaise, leachingRequirement, surfaceEvent } from '@/physics/water'
import { C } from '../_shared/cites'

export { C }

export interface ReqParams {
  etMethod: 'bc' | 'jh'
  /* Blaney–Criddle */
  T: number
  p: number
  kc: number
  adjusted: boolean
  RH: number
  /* Jensen–Haise */
  Rs: number
  Tmax: number
  Tmin: number
  E: number
  /* leaching */
  ECi: number
  ECd: number
  /* irrigation event */
  Qsource: number
  Qfield: number
  hours: number
  areaHa: number
  Qrunoff: number
  runoffHours: number
  dHead: number
  dTail: number
  root: number
  /** cm of water per m of soil */
  whc: number
  depletion: number
  /** evaporation during application, fraction of W_d (illustrative, for E_cu) */
  evap: number
  /** days per sim second for the soil-water bucket */
  speed: number
}

export const EXAM_EVENT = { Qsource: 0.175, Qfield: 0.105, hours: 8, areaHa: 2, Qrunoff: 0.05, runoffHours: 3, dHead: 1.8, dTail: 1.2, root: 1.8, whc: 20, depletion: 0.6 }
export const ILE_IFE = { T: 21.2, p: 8.75, kc: 1.06, RH: 84, Rs: 549, Tmax: 30.8, Tmin: 15.6, E: 540 }

export const DEFAULTS: ReqParams = {
  etMethod: 'bc',
  ...ILE_IFE,
  adjusted: false,
  ECi: 1.2,
  ECd: 8,
  ...EXAM_EVENT,
  evap: 0.05,
  speed: 2,
}

interface Store extends ReqParams {
  set: (p: Partial<ReqParams>) => void
  reset: () => void
}
export const useReq = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Everything the panel and the 3D view derive from the parameters. */
export function derive(p: ReqParams) {
  const bc = blaneyCriddle({ T: p.T, p: p.p, kc: p.kc, RH: p.adjusted ? p.RH : undefined })
  const jh = jensenHaise({ T: p.T, Rs: p.Rs, Tmax: p.Tmax, Tmin: p.Tmin, E: p.E })
  const etDay = p.etMethod === 'bc' ? bc.ET / 31 : jh.ETmm
  const ev = surfaceEvent({ Qsource: p.Qsource, Qfield: p.Qfield, hours: p.hours, area: p.areaHa * 1e4, Qrunoff: p.Qrunoff, runoffHours: p.runoffHours, dHead: p.dHead, dTail: p.dTail, root: p.root, whc: p.whc / 100, depletion: p.depletion })
  const LR = leachingRequirement(p.ECi, p.ECd)
  // water beneficially used: stored water plus deep percolation up to the leaching need
  const leach = Math.min(ev.deep, LR * ev.Wd)
  const Wu = ev.Ws + leach
  // consumptive use between irrigations = the root-zone deficit that is refilled; net depletion adds deep percolation and evaporation
  const Wcu = Math.min(ev.Ws, ev.Wn)
  const evapLoss = p.evap * ev.Wd
  const WdNet = Wcu + ev.deep + evapLoss
  const interval = (p.whc / 100) * p.root * p.depletion * 1000 / Math.max(0.1, etDay)
  return { bc, jh, etDay, ev, LR, leach, Wu, Eu: Wu / ev.Wd, Wcu, WdNet, Ecu: Wcu / WdNet, evapLoss, interval }
}

/* ------------------------------ live ------------------------------ */

export const live = { day: 0, avail: 1, irrigating: false }
