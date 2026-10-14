import { TRACTOR } from './dims'
import { KINGPIN_Z } from './geometry'

/** Ackermann steer angles (inner, outer) for a mean angle (beyond notes: Ackermann geometry). */
export function ackermann(steer: number, wheelbase = TRACTOR.wheelbase, track = 2 * KINGPIN_Z) {
  if (Math.abs(steer) < 1e-6) return { left: 0, right: 0 }
  const Rm = wheelbase / Math.tan(Math.abs(steer))
  const inner = Math.atan(wheelbase / (Rm - track / 2))
  const outer = Math.atan(wheelbase / (Rm + track / 2))
  return steer > 0 ? { left: inner, right: outer } : { left: -outer, right: -inner }
}
