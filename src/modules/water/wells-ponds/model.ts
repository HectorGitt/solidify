import { create } from 'zustand'
import { confinedHead, confinedQ, pondNeeds, pondStorage, unconfinedHead, unconfinedQ, type PondDemand } from '@/physics/water'
import { C } from '../_shared/cites'

export { C }

export type Mode = 'unconfined' | 'confined' | 'pond'

export interface WellParams extends PondDemand {
  mode: Mode
  pumping: boolean
  /** hydraulic conductivity, m/day */
  K: number
  /** saturated thickness (unconfined) or piezometric head above the base (confined), m */
  H: number
  /** drawdown in the pumped well, m */
  sw: number
  R: number
  rw: number
  /** confined aquifer thickness, m */
  d: number
  /** observation wells, m from the pumped well */
  r1: number
  r2: number
  /* pond */
  loss: number
  /** sim seconds per pond season */
  season: number
}

export const POND_S1 = { persons: 10, fire: true, steers: 1000, milkCows: 500, horses: 0, turkeys: 0, chickens: 10000, swine: 100, sheep: 0, irrHa: 10, irrDepth: 0.7, loss: 0.2 }

export const DEFAULTS: WellParams = { mode: 'unconfined', pumping: true, K: 1.824, H: 24.38, sw: 9.14, R: 183, rw: 0.305, d: 12, r1: 14, r2: 40, ...POND_S1, season: 30 }

interface Store extends WellParams {
  set: (p: Partial<WellParams>) => void
  reset: () => void
}
export const useWells = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function wellOf(p: WellParams) {
  const hw = p.H - p.sw
  const confined = p.mode === 'confined'
  const Q = confined ? confinedQ(p.K, p.d, p.H, hw, p.R, p.rw) : unconfinedQ(p.K, p.H, hw, p.R, p.rw)
  const head = (r: number) => (r >= p.R ? p.H : confined ? confinedHead(Q, p.K, p.d, hw, p.rw, r) : unconfinedHead(Q, p.K, hw, p.rw, r))
  return { hw, Q, head, s1: p.H - head(p.r1), s2: p.H - head(p.r2), T: p.K * (confined ? p.d : p.H) }
}

export function pondOf(p: WellParams) {
  const nd = pondNeeds(p)
  return { ...nd, storage: pondStorage(nd.total, p.loss) }
}

export const live = { k: 0, vol: 1 }
