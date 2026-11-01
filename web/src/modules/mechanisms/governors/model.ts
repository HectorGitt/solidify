import { create } from 'zustand'
import { createRun } from '@/lab/run'
import { porter, radToRpm, rpmToRad } from '@/physics/machinedynamics'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI
const G = 9.81

export type Kind = 'watt' | 'porter' | 'hartnell'

export interface GovParams {
  kind: Kind
  rpm: number
  /** ball mass, kg */
  m: number
  /** Porter's central load, kg */
  M: number
  /** arm, mm */
  arm: number
  /** Porter: arm offset from the spindle, mm */
  offset: number
  /** Hartnell: ball arm, sleeve arm, r₀ (mm); N₀ (rpm); stiffness (N/mm) */
  a: number
  b: number
  r0: number
  n0: number
  k: number
  set: (p: Partial<GovParams>) => void
  reset: () => void
}

export const DEFAULTS = { kind: 'porter' as Kind, rpm: 178, m: 3, M: 20, arm: 200, offset: 36, a: 150, b: 90, r0: 120, n0: 300, k: 29.7 }

export const useGov = create<GovParams>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const live = { theta: 0, rpm: 0 }

/** the bench test: the speed is raised in steps across the governor's range, and the sleeve read at each */
export const govRun = createRun()
export const GOV_PROC = { steps: 10, moveSeconds: 0.04, dwellSeconds: 0.02 }

export type GovInputs = Omit<GovParams, 'set' | 'reset'>

/** the stops: the arm's angle range, and for Hartnell the sleeve's movement either way (mm) */
export const ALPHA_MIN = rad(12)
export const ALPHA_MAX = rad(55)
export const HARTNELL_TRAVEL = 15

export interface GovState {
  /** ball radius, mm */
  r: number
  /** the arm's angle from the vertical (Watt, Porter), or the bell crank's turn (Hartnell) */
  alpha: number
  /** the sleeve's lift from its lowest position, mm */
  lift: number
  /** controlling force per ball, N */
  F: number
  /** the stops are holding it: not in equilibrium */
  atStop: boolean
}

const speedAt = (p: GovInputs, alpha: number) => {
  if (p.kind === 'watt') return Math.sqrt((G * Math.tan(alpha)) / ((p.arm / 1000) * Math.sin(alpha)))
  return porter(p.m, p.M, p.arm / 1000, p.offset / 1000, alpha).w
}

/** the equilibrium at this speed: found by bisection since speed rises with the arm's angle */
export function equilibrium(p: GovInputs, rpm = p.rpm): GovState {
  const w = rpmToRad(rpm)
  if (p.kind === 'hartnell') {
    const a = p.a / 1000
    const b = p.b / 1000
    const r0 = p.r0 / 1000
    const w0 = rpmToRad(p.n0)
    const k = p.k * 1000
    // spring load at the mid position balances the balls at N₀: S = 2 m ω₀² r₀ a/b + k x, x the sleeve's rise from there
    const S0 = (2 * p.m * w0 * w0 * r0 * a) / b
    // 2 m ω² (r₀ + x a/b) a/b = S0 + k x
    const denom = k - (2 * p.m * w * w * a * a) / (b * b)
    let x = denom !== 0 ? ((2 * p.m * w * w * r0 * a) / b - S0) / denom : 0
    const lim = HARTNELL_TRAVEL / 1000
    const atStop = Math.abs(x) >= lim || denom <= 0
    x = denom <= 0 ? lim : Math.max(-lim, Math.min(lim, x))
    const r = r0 + (x * a) / b
    return { r: r * 1000, alpha: x / b, lift: (x + lim) * 1000, F: p.m * w * w * r, atStop }
  }
  let lo = ALPHA_MIN
  let hi = ALPHA_MAX
  const atStop = w <= speedAt(p, lo) || w >= speedAt(p, hi)
  if (w <= speedAt(p, lo)) hi = lo
  else if (w >= speedAt(p, hi)) lo = hi
  else
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2
      if (speedAt(p, mid) < w) lo = mid
      else hi = mid
    }
  const alpha = (lo + hi) / 2
  const arm = p.arm / 1000
  const off = p.kind === 'watt' ? 0 : p.offset / 1000
  const r = off + arm * Math.sin(alpha)
  const factor = p.kind === 'watt' ? 1 : 2
  const lift = factor * arm * (Math.cos(ALPHA_MIN) - Math.cos(alpha))
  return { r: r * 1000, alpha, lift: lift * 1000, F: p.m * w * w * r, atStop }
}

/** the speeds at the stops */
export function speedRange(p: GovInputs) {
  if (p.kind === 'hartnell') {
    const a = p.a / 1000
    const b = p.b / 1000
    const r0 = p.r0 / 1000
    const w0 = rpmToRad(p.n0)
    const S0 = (2 * p.m * w0 * w0 * r0 * a) / b
    const at = (x: number) => Math.sqrt((S0 + p.k * 1000 * x) / ((2 * p.m * (r0 + (x * a) / b) * a) / b))
    const lim = HARTNELL_TRAVEL / 1000
    return { lo: radToRpm(at(-lim)), hi: radToRpm(at(lim)) }
  }
  return { lo: radToRpm(speedAt(p, ALPHA_MIN)), hi: radToRpm(speedAt(p, ALPHA_MAX)) }
}

/** the controlling force curve: F against r, per ball */
export function controllingCurve(p: GovInputs) {
  const rs: number[] = []
  const Fs: number[] = []
  const { lo, hi } = speedRange(p)
  for (let i = 0; i <= 60; i++) {
    const s = equilibrium(p, lo + ((hi - lo) * i) / 60 + 1e-6)
    rs.push(s.r)
    Fs.push(s.F)
  }
  return { rs, Fs }
}
