import { create } from 'zustand'
import { logWind } from '@/physics/water'
import { C } from '../_shared/cites'

export { C }

export type Cover = 'bare' | 'flat' | 'standing'

export interface WindParams {
  /** wind speed at 0.3 m over the open field, m/s */
  u: number
  cover: Cover
  moist: boolean
  rough: boolean
  windbreak: boolean
  /** windbreak height, m */
  H: number
  strips: boolean
}

export const DEFAULTS: WindParams = { u: 8, cover: 'bare', moist: false, rough: false, windbreak: true, H: 6, strips: false }

interface Store extends WindParams {
  set: (p: Partial<WindParams>) => void
  reset: () => void
}
export const useWind = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Field frame: wind blows +X; windbreak at x = BREAK_X; field from FIELD.x0 to FIELD.x1. */
export const FIELD = { x0: -18, x1: 26, w: 24 }
export const BREAK_X = -20
/** Fluid threshold at 0.3 m for mineral soils (≤ 5 m/s non-erosive). */
export const THRESHOLD = 5
/** Crop strips normal to the wind: [x0, x1] ranges. */
export const STRIPS: [number, number][] = [
  [-4, 0],
  [10, 14],
]

/**
 * Threshold raised by surface condition. The notes say residue, roughness and moisture raise the
 * threshold; the increments here are illustrative only (no numbers in the notes).
 */
export function thresholdOf(p: WindParams) {
  if (p.moist) return Infinity
  return THRESHOLD + (p.cover === 'flat' ? 1.5 : p.cover === 'standing' ? 3 : 0) + (p.rough ? 1 : 0)
}

/**
 * Wind at 0.3 m at x, reduced in the lee of the windbreak. Protected-zone shape and length
 * (≈ 70 % reduction near the break, recovering by about 12H) are typical textbook values, not in the notes.
 */
export function shelter(p: WindParams, x: number) {
  if (!p.windbreak) return 1
  const d = x - BREAK_X
  if (d < -2 * p.H || d > 12 * p.H) return 1
  if (d < 0) return 1 - 0.2 * (1 + d / (2 * p.H))
  return 1 - 0.7 * (1 - d / (12 * p.H))
}

export const uAt = (p: WindParams, x: number) => p.u * shelter(p, x)

export const inStrip = (p: WindParams, x: number) => p.strips && STRIPS.some(([a, b]) => x >= a && x <= b)

/** Erosion intensity 0…1 at x (0 below threshold, protected strips or moist soil). */
export function intensity(p: WindParams, x: number) {
  if (x < FIELD.x0 || x > FIELD.x1 || inStrip(p, x)) return 0
  const ut = thresholdOf(p)
  if (!Number.isFinite(ut)) return 0
  return Math.max(0, Math.min(1, (uAt(p, x) - ut) / ut))
}

/** Log profile through the 0.3 m speed (z₀ = 1 mm bare, 2 cm rough/standing) — standard form, beyond the notes. */
export const z0Of = (p: WindParams) => (p.cover === 'standing' || p.rough ? 0.02 : 0.001)
export const profile = (p: WindParams, u03: number, z: number) => logWind(u03, 0.3, z0Of(p), z)

export const live = { eroding: 0, moved: 0 }
