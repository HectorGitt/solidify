import { evaluateCalculations, type NoteSceneSpec } from './schema'

/**
 * New numbers for a solved problem, to try it again: each given moves within ±`spread` of its stated value,
 * kept on its slider and its step. A set is only used if every step of the solution still works out and gives
 * the same sign as with the stated numbers (a load can't end up past the end of its beam, a reaction can't turn
 * round). Gives up (null) when no such set is found.
 */
export function freshNumbers(spec: Pick<NoteSceneSpec, 'parameters' | 'calculations'>, spread = 0.3, tries = 40, random = Math.random): Record<string, number> | null {
  const stated = Object.fromEntries(spec.parameters.map((p) => [p.id, p.value]))
  const stated_ = evaluateCalculations(spec.calculations, stated).results
  const base = stated_.map((r) => r.value)
  // a problem that can't be worked out with its own numbers has nothing to vary
  if (stated_.some((r) => r.broken)) return null
  const sign = (v: number) => (Math.abs(v) < 1e-12 ? 0 : Math.sign(v))
  for (let t = 0; t < tries; t++) {
    const next: Record<string, number> = {}
    for (const p of spec.parameters) {
      const lo = Math.max(p.min, p.value - Math.abs(p.value) * spread)
      const hi = Math.min(p.max, p.value + Math.abs(p.value) * spread)
      const step = p.step > 0 ? p.step : (hi - lo) / 20 || 1
      // on the slider's steps, inside the band (round to the nearest step, then step back in if that left it)
      const raw = lo + random() * (hi - lo)
      let snapped = p.min + Math.round((raw - p.min) / step) * step
      if (snapped > hi + 1e-9) snapped -= step
      if (snapped < lo - 1e-9) snapped += step
      if (snapped > hi + 1e-9 || snapped < lo - 1e-9) snapped = p.value
      next[p.id] = Number(snapped.toPrecision(10))
    }
    if (spec.parameters.every((p) => next[p.id] === p.value)) continue
    const now = evaluateCalculations(spec.calculations, next).results
    if (now.every((r, i) => !r.broken && Number.isFinite(r.value) && sign(r.value) === sign(base[i]))) return next
  }
  return null
}
