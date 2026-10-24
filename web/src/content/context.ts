import type { SceneContext } from '@/modules/types'

/** Helpers for handing live values from one scene to a detail scene (drill-down context). */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const roundTo = (v: number, step: number) => Math.round(v / step) * step

/** Soil class from a cone index in kPa (the classes the traction scenes use). */
export function soilFromCI(CI: number): 'soft' | 'tilled' | 'firm' {
  return CI < 650 ? 'soft' : CI < 1200 ? 'tilled' : 'firm'
}

/** Keep only finite numbers and known strings (a stalled engine gives NaN rpm, for instance). */
export function cleanContext(c: SceneContext): SceneContext {
  const out: SceneContext = {}
  for (const [k, v] of Object.entries(c) as [keyof SceneContext, SceneContext[keyof SceneContext]][]) {
    if (typeof v === 'number' ? Number.isFinite(v) : v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

/** A short line describing what was carried over, for the arrival notice. */
export function describeContext(c: SceneContext) {
  const parts: string[] = []
  if (c.rpm !== undefined) parts.push(`${Math.round(c.rpm)} rpm`)
  if (c.pullKN !== undefined) parts.push(`${c.pullKN.toFixed(1)} kN pull`)
  if (c.wheelLoadKN !== undefined) parts.push(`${c.wheelLoadKN.toFixed(1)} kN wheel load`)
  if (c.slip !== undefined) parts.push(`${(c.slip * 100).toFixed(0)} % slip`)
  if (c.speedKmh !== undefined) parts.push(`${c.speedKmh.toFixed(1)} km/h`)
  if (c.CI !== undefined) parts.push(`${soilFromCI(c.CI)} soil`)
  if (c.tyre) parts.push(`${c.tyre} tyres`)
  return parts.join(' · ')
}
