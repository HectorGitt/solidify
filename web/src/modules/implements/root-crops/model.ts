import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { elevatorRatio, leverAdvantage, recovered, soilLifted } from '@/physics/harvest'
import { fieldCapacity } from '@/physics/implements'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'

export const C = {
  am: (w: string) => SRC.am502(w),
  mgmt: (w: string) => SRC.mgmt501(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
}

export type Machine = 'groundnut' | 'cassava'

/** Working hitch height; the digger frame is drawn with y = 0 at the ground when working. */
export const HW = 0.4
export const HRAISED = 0.85
export const LK = solveLinkage(phiForHitchHeight(HW))
/** PTO stub in the digger frame (hitch frame shifted down by HW). */
export const PTO_LOCAL: [number, number, number] = [PTO_STUB_X - 0.06 - LK.L.x, PTO_Y - LK.L.y + HW, 0]

/**
 * Digger layout (digger frame: x rearward negative from the hitch balls, y up from the ground
 * when working). The digging unit (blade + elevator + coulters) is drawn at zero depth and moved
 * down by the depth setting. Sizes typical (beyond notes); parts from §20.
 */
export const DIG = {
  /** blade tip x, blade rear x and rise, working width */
  tipX: -0.5,
  bladeX1: -0.9,
  bladeRise: 0.14,
  W: 1.1,
  /** elevator front and rear ends (at zero depth) */
  elevF: [-0.88, 0.14] as [number, number],
  elevR: [-2.05, 0.62] as [number, number],
  /** depth wheels */
  wheelX: -0.25,
  wheelZ: 0.72,
  wheelR: 0.24,
  /** disc coulters (cassava) */
  discX: -0.42,
  discZ: 0.52,
  discR: 0.28,
  frameY: 0.68,
}
export const ELEV_LEN = Math.hypot(DIG.elevR[0] - DIG.elevF[0], DIG.elevR[1] - DIG.elevF[1])

export const MACHINES: Record<Machine, { label: string; rows: number[]; spacing: number; depth: [number, number, number]; recovery: number; yield: number }> = {
  groundnut: { label: 'Groundnut digger-shaker', rows: [-0.3, 0.3], spacing: 0.2, depth: [0.06, 0.12, 0.2], recovery: 0.9, yield: 1.5 },
  cassava: { label: 'Cassava digger-elevator', rows: [0], spacing: 0.8, depth: [0.1, 0.25, 0.3], recovery: 0.85, yield: 20 },
}

export interface RootParams {
  machine: Machine
  /** forward speed, km/h */
  speed: number
  /** digging depth, m */
  depth: number
  /** elevator speed ÷ forward speed */
  ratio: number
  agitators: boolean
  /** crop yield, t/ha */
  yield: number
  /** manual lifter: effort and lift, N */
  effort: number
  lift: number
}

export const DEFAULTS: RootParams = { machine: 'cassava', speed: 3, depth: 0.25, ratio: 1.5, agitators: true, yield: 20, effort: 400, lift: 1500 }

interface Store extends RootParams {
  set: (p: Partial<RootParams>) => void
  reset: () => void
}

export const useRoots = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

/** Bulk density of loosened soil on the elevator, t/m³ (typical, beyond notes). */
export const SOIL_T_M3 = 1.3

/** Fraction of the lifted soil that sifts through the rods before the end of the elevator (teaching model). */
export function siftedFraction(ratio: number, agitators: boolean) {
  const base = 1 - Math.exp(-1.6 * Math.max(0, ratio - 0.6))
  return Math.min(0.98, base * (agitators ? 1 : 0.7))
}

export function digger(p: RootParams) {
  const v = p.speed / 3.6
  const ve = p.ratio * v
  const m = MACHINES[p.machine]
  const soil = soilLifted(DIG.W, p.depth, p.speed)
  const sift = siftedFraction(p.ratio, p.agitators)
  // a shallow blade cuts tubers/pods; recovery falls when the blade runs above the roots
  const tooShallow = p.depth < m.depth[0] + 0.02
  const rec = m.recovery * (tooShallow ? 0.7 : 1) * (p.ratio < 1 ? 0.9 : 1)
  return {
    v,
    ve,
    ratio: elevatorRatio(ve, v),
    soil,
    soilT: soil * SOIL_T_M3,
    sift,
    cap: fieldCapacity(DIG.W, p.speed),
    rec,
    recovered: recovered(p.yield, rec),
    tooShallow,
    lever: leverAdvantage(p.lift, p.effort),
  }
}

export const live = { lifted: 0, dropped: 0 }
export function resetLive() {
  live.lifted = 0
  live.dropped = 0
}
