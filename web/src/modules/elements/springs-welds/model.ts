import { create } from 'zustand'
import {
  WELD_ALLOWABLE,
  barWeld,
  bracketWeld,
  helicalDeflection,
  helicalStiffness,
  helicalStress,
  leafDeflection,
  leafNip,
  leafStressFull,
  leafStressGraduated,
  leafStressPrestressed,
  shearStressFactor,
  springIndex,
  wahlFactor,
} from '@/physics/elements'

export type Mode = 'helical' | 'leaf' | 'weld'
export type WeldCase = 'bar' | 'bracket'

export interface SWParams {
  mode: Mode
  /* helical compression spring (MG21 Q4d) */
  F: number
  d: number
  D: number
  n: number
  G: number
  tau: number
  factor: 'wahl' | 'ks'
  /** free length (m) */
  L0: number
  /* leaf spring (MG17 Q4c) */
  lF: number
  L: number
  b: number
  t: number
  ne: number
  ng: number
  E: number
  prestressed: boolean
  /* welds (M11) */
  weld: WeldCase
  V: number
  arm: number
  barD: number
  leg: number
  s: number
  /** bracket weld flange b and web d (m) */
  wb: number
  wd: number
}

export const DEFAULTS: SWParams = {
  mode: 'helical',
  F: 500,
  d: 0.006,
  D: 0.048,
  n: 6.15,
  G: 84e9,
  tau: 350e6,
  factor: 'wahl',
  L0: 0.09,
  lF: 2000,
  L: 1,
  b: 0.045,
  t: 0.0123,
  ne: 1,
  ng: 8,
  E: 200e9,
  prestressed: false,
  weld: 'bar',
  V: 10e3,
  arm: 0.2,
  barD: 0.05,
  leg: 0.0154,
  s: WELD_ALLOWABLE,
  wb: 0.12,
  wd: 0.24,
}

interface Store extends SWParams {
  set: (p: Partial<SWParams>) => void
  reset: () => void
}
export const useSW = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function helicalResult(p: SWParams) {
  const C = springIndex(p.D, p.d)
  const Kw = wahlFactor(C)
  const Ks = shearStressFactor(C)
  const K = p.factor === 'wahl' ? Kw : Ks
  const y = helicalDeflection(p.F, p.D, p.d, p.n, p.G)
  const k = helicalStiffness(p.D, p.d, p.n, p.G)
  const tau = helicalStress(p.F, p.D, p.d, K)
  // solid length with two inactive end coils (squared and ground ends — beyond notes)
  const solid = (p.n + 2) * p.d
  const len = Math.max(solid, p.L0 - y)
  return { C, Kw, Ks, K, y, k, tau, solid, len, bottomed: p.L0 - y <= solid, Fsolid: k * (p.L0 - solid) }
}

export function leafResult(p: SWParams) {
  const n = p.ne + p.ng
  return {
    n,
    y: leafDeflection(p.lF, p.L, p.b, p.t, p.E, p.ne, p.ng),
    se: leafStressFull(p.lF, p.L, p.b, p.t, p.ne, p.ng),
    sg: leafStressGraduated(p.lF, p.L, p.b, p.t, p.ne, p.ng),
    s: leafStressPrestressed(p.lF, p.L, p.b, p.t, n),
    h: leafNip(p.lF, p.L, p.b, p.t, n, p.E),
  }
}

export function weldResult(p: SWParams) {
  if (p.weld === 'bar') {
    const r = barWeld(p.V, p.arm, p.barD, p.s)
    return { kind: 'bar' as const, ...r, sActual: r.f / (0.707 * p.leg) }
  }
  const r = bracketWeld(p.V, p.arm, p.wb, p.wd, p.s)
  return { kind: 'bracket' as const, ...r, sActual: r.f / (0.707 * p.leg) }
}

export const live = { phase: 0 }
