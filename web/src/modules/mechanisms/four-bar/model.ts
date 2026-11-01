import { create } from 'zustand'
import { classify, crankRange, solve, transmissionLimits, type FourBar, type LinkageKind, type Pose } from '@/physics/fourbar'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

/** drawn at twice bench size, so the links read clearly: a link's length in cm, in metres */
export const CM = 0.02

export type FixedChoice = 'crank' | 'frame' | 'coupler'

export interface FourBarParams extends FourBar {
  rpm: number
  branch: 1 | -1
  trace: boolean
  set: (p: Partial<FourBarParams>) => void
  reset: () => void
}

/** the rig's first set-up, in cm: S + L < P + Q, shortest link as the crank */
export const DEFAULTS = { frame: 8, crank: 4, coupler: 12, rocker: 10, rpm: 12, branch: 1 as const, trace: true }

export const useFourBar = create<FourBarParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const lengths = (s: FourBar): FourBar => ({ frame: s.frame, crank: s.crank, coupler: s.coupler, rocker: s.rocker })

/** The same four bars on the board, with the shortest as the crank, the frame, or opposite the frame. */
export function arrange(values: number[], choice: FixedChoice): FourBar {
  const [S, P, Q, L] = [...values].sort((a, b) => a - b)
  if (choice === 'frame') return { frame: S, crank: P, coupler: L, rocker: Q }
  if (choice === 'coupler') return { frame: P, crank: L, coupler: S, rocker: Q }
  return { frame: P, crank: S, coupler: L, rocker: Q }
}

/** which of the three a set-up is; null if the shortest link is the output lever */
export function fixedChoice(l: FourBar): FixedChoice | null {
  const s = classify(l).shortest
  return s === 'rocker' ? null : s
}

export const KIND_LABEL: Record<LinkageKind, string> = {
  'crank-rocker': 'Crank-rocker',
  'double-crank': 'Double crank',
  'double-rocker': 'Double rocker',
  'change-point': 'Change point',
  impossible: 'Will not assemble',
}

export const KIND_NOTE: Record<LinkageKind, string> = {
  'crank-rocker': 'The crank turns fully; the output lever only swings between two limits.',
  'double-crank': 'The fixed link is the shortest, so both of its neighbours turn fully.',
  'double-rocker': 'Neither link on the frame can turn fully: both only swing.',
  'change-point': 'S + L = P + Q: the links can all fall in line, and there the motion can go either way.',
  impossible: 'One link is as long as the other three together, so the loop cannot close.',
}

/** written by the 3D scene, read by the panel */
export const live: { theta: number; pose: Pose | null } = { theta: 0, pose: null }

/** the crank angle for a running phase: right round if it can, otherwise to and fro between its limits */
export function crankAt(l: FourBar, phase: number) {
  const r = crankRange(l)
  if (!r) return phase
  const mid = (r.lo + r.hi) / 2
  // stop just short of the dead points, where the loop only just closes
  const half = ((r.hi - r.lo) / 2) * 0.998
  return mid + half * Math.sin(phase)
}

/** The crank-radius experiment: frame 8, coupler 12, output lever 10 cm, crank in each of its four holes. */
export const CRANK_HOLES = [1, 2, 3, 4]
export const crankHole = (r: number): FourBar => ({ frame: 8, crank: r, coupler: 12, rocker: 10 })

export function limitsDeg(l: FourBar) {
  const t = transmissionLimits(l)
  return { min: deg(t.min), max: deg(t.max) }
}

export { solve }
