import { create } from 'zustand'
import { pendulumPeriod, suspensionPeriod } from '@/physics/machinedynamics'

export type Mode = 'pendulum' | 'bifilar' | 'trifilar'

export interface InertiaParams {
  mode: Mode
  /** pendulum: the bar's mass (kg), length (m) and G's distance below the pivot (m) */
  mBar: number
  length: number
  h: number
  /** suspension: wire length and radius of the wires (m), platform and block masses (kg) */
  L: number
  r: number
  mPlatform: number
  mBlock: number
  /** the block's radius, m */
  rBlock: number
  block: boolean
  set: (p: Partial<InertiaParams>) => void
  reset: () => void
}

export const DEFAULTS = { mode: 'pendulum' as Mode, mBar: 4, length: 1.4, h: 0.62, L: 0.42, r: 0.25, mPlatform: 2, mBlock: 3.5, rBlock: 0.1, block: true }

export const useInertia = create<InertiaParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const live = { t: 0 }

export type InertiaInputs = Omit<InertiaParams, 'set' | 'reset'>

/** the platform is a uniform disc just beyond the wires: its own inertia about the vertical axis */
export const platformI = (p: InertiaInputs) => 0.5 * p.mPlatform * (p.r * 1.1) ** 2
/** the block is a solid disc on the axis */
export const blockI = (p: InertiaInputs) => 0.5 * p.mBlock * p.rBlock ** 2

/** the true period of what is on the rig */
export function truePeriod(p: InertiaInputs) {
  if (p.mode === 'pendulum') return pendulumPeriod(p.length / Math.sqrt(12), p.h)
  const m = p.mPlatform + (p.block ? p.mBlock : 0)
  const I = platformI(p) + (p.block ? blockI(p) : 0)
  return suspensionPeriod(I, m, p.r, p.L)
}

/** five stopwatch timings of 20 swings, with a human's small scatter (fixed, so the table is repeatable) */
export const REACTION = [0.0031, -0.0018, 0.0012, -0.0026, 0.0009]
export const timings = (T: number) => REACTION.map((e) => T * (1 + e))
