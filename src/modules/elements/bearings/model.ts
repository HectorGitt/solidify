import { create } from 'zustand'
import { ROTATION_FACTOR, cageSpeed, equivalentLoad, lifeHours, ratingLife } from '@/physics/elements'

const { PI } = Math

export type { BearingType } from '@/parts/lib/elements'
import type { BearingType } from '@/parts/lib/elements'

export interface TypeSpec {
  label: string
  code: string
  /** bore, outside diameter, width (m) */
  d: number
  D: number
  B: number
  /** rolling elements: number, diameter, pitch diameter (m), contact angle */
  Z: number
  Dw: number
  Dp: number
  alpha: number
  /** typical catalogue basic dynamic rating C (N) — beyond notes */
  C: number
  /** life exponent: 3 for balls (notes), 10/3 for rollers (ISO, beyond notes) */
  exponent: number
  takes: string
}

/**
 * Sizes for a 40 mm shaft (the "208" family used in the notes' Example 1). Element counts and
 * ratings are typical catalogue values (beyond notes) except the 6208's 9 × 12 mm balls (M7 Ex 1).
 */
export const TYPES: Record<BearingType, TypeSpec> = {
  ball: { label: 'Deep-groove ball', code: '6208', d: 0.04, D: 0.08, B: 0.018, Z: 9, Dw: 0.012, Dp: 0.06, alpha: 0, C: 29100, exponent: 3, takes: 'radial + moderate thrust; small and medium loads' },
  roller: { label: 'Cylindrical roller', code: 'NU208', d: 0.04, D: 0.08, B: 0.018, Z: 14, Dw: 0.011, Dp: 0.06, alpha: 0, C: 51000, exponent: 10 / 3, takes: 'heavy radial only — the straight roller takes no thrust' },
  taper: { label: 'Tapered roller', code: '30208', d: 0.04, D: 0.08, B: 0.0198, Z: 16, Dw: 0.0093, Dp: 0.06, alpha: (15 * PI) / 180, C: 63000, exponent: 10 / 3, takes: 'heavy radial and thrust combined' },
  needle: { label: 'Needle roller', code: 'NA4908', d: 0.04, D: 0.062, B: 0.022, Z: 46, Dw: 0.003, Dp: 0.051, alpha: 0, C: 43000, exponent: 10 / 3, takes: 'radial, where radial space is tight' },
  thrust: { label: 'Thrust ball', code: '51208', d: 0.04, D: 0.068, B: 0.019, Z: 13, Dw: 0.011, Dp: 0.054, alpha: PI / 2, C: 47000, exponent: 3, takes: 'axial (thrust) load only' },
  journal: { label: 'Journal (plain)', code: 'bush', d: 0.04, D: 0.072, B: 0.03, Z: 0, Dw: 0, Dp: 0, alpha: 0, C: 0, exponent: 3, takes: 'heavy radial; sliding on an oil film' },
}

export interface BearingParams {
  type: BearingType
  rpm: number
  /** loads, N */
  Fr: number
  Fa: number
  X: number
  Y: number
  ring: 'inner' | 'outer'
  /** dynamic rating (N), defaults to the type's typical value */
  C: number
  /* static capacity (Stribeck / AFBMA) */
  K: number
  f0: number
  sZ: number
  sD: number
  rows: number
  X0: number
  Y0: number
  showLoads: boolean
}

export const DEFAULTS: BearingParams = {
  type: 'ball',
  rpm: 1000,
  Fr: 3000,
  Fa: 600,
  X: 0.56,
  Y: 1.5,
  ring: 'inner',
  C: TYPES.ball.C,
  K: 60.8e6,
  f0: 12.26e6,
  sZ: 9,
  sD: 0.012,
  rows: 1,
  X0: 0.6,
  Y0: 0.5,
  showLoads: true,
}

interface Store extends BearingParams {
  set: (p: Partial<BearingParams>) => void
  reset: () => void
}
export const useBearings = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export function lifeResult(p: BearingParams) {
  const t = TYPES[p.type]
  const V = ROTATION_FACTOR[p.ring]
  const P = p.type === 'thrust' ? p.Fa : equivalentLoad(p.X, V, p.Fr, p.Y, p.Fa)
  const L = ratingLife(p.C, P, t.exponent)
  return { V, P, L, hours: lifeHours(L, p.rpm), exponent: t.exponent }
}

export function cageOmega(p: BearingParams, omega: number) {
  const t = TYPES[p.type]
  if (!t.Z) return 0
  if (p.type === 'thrust') return omega / 2
  return cageSpeed(omega, t.Dw, t.Dp, p.type === 'taper' ? 0 : t.alpha)
}

export const live = { theta: 0, cage: 0 }
