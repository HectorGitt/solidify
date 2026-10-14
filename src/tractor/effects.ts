import { FARMLAND_ENGINE, torqueAt } from '@/physics/tractor'
import type { EffectsInput } from '@/render/Effects'

/** Rated speed of the Farmland engine (top of its full-load curve, before governor run-out). */
export const RATED_RPM = 2250
const RATED_T = torqueAt(FARMLAND_ENGINE, RATED_RPM)

/** Engine load: torque demanded ÷ the most the engine can give at that speed (full-fuel line). */
export function farmlandLoad(Te: number, rpm: number) {
  if (!Number.isFinite(rpm) || rpm <= 0) return 0
  const full = rpm <= RATED_RPM ? torqueAt(FARMLAND_ENGINE, rpm) : RATED_T
  return Math.max(0, Math.min(1, Te / full))
}

/** Effects input for the Farmland tractor at an operating point. */
export function farmlandEffects(o: { Te: number; rpm: number; V: number; slip?: number; stalled?: boolean }, dust: number): EffectsInput {
  if (o.stalled || !Number.isFinite(o.rpm)) return { speed: 0, dust }
  return { load: farmlandLoad(o.Te, o.rpm), rpm: o.rpm, ratedRpm: RATED_RPM, speed: o.V, slip: o.slip ?? 0, dust }
}
