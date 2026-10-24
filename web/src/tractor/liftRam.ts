import { DEFAULT_LINKAGE, linkageRange, solveLinkage, type P2 } from './linkage'

/**
 * The tractor's hydraulic lift ram and its crank on the rockshaft: geometry and kinematics shared
 * by the lift-circuit scene and the whole-tractor view. Side view in X–Y, tractor frame (+X
 * forward, origin on the ground under the rear axle); the linkage itself is solved by solveLinkage.
 */
export const G = DEFAULT_LINKAGE
export const C = G.C

/** Ram crank arm on the rockshaft (rigid with the lift arms). */
export const CRANK = 0.12
/** Fixed ram pivot (front end of the ram cylinder). */
export const RAM_PIVOT: P2 = { x: C.x + 0.58, y: C.y - 0.13 }
export const RAM_BORE = 0.09

/** Crank-pin position for a lift-arm angle β (crank hangs straight down at β = 0). */
export function crankPin(beta: number): P2 {
  const a = (3 * Math.PI) / 2 - beta
  return { x: C.x + CRANK * Math.cos(a), y: C.y + CRANK * Math.sin(a) }
}

export function ramLength(phi: number) {
  const pose = solveLinkage(phi)
  const K = crankPin(pose.beta)
  return { pose, K, L: Math.hypot(K.x - RAM_PIVOT.x, K.y - RAM_PIVOT.y) }
}

/** Working range of the lower links: hitch from near the ground to fully raised. */
const range = linkageRange()
export const PHI_LOW = Math.min(range.hi - 0.02, Math.asin((G.A.y - 0.12) / G.lower))
export const PHI_HIGH = Math.max(range.lo + 0.02, Math.asin((G.A.y - 0.78) / G.lower))

export const RAM_MIN = Math.min(ramLength(PHI_LOW).L, ramLength(PHI_HIGH).L)
export const RAM_MAX = Math.max(ramLength(PHI_LOW).L, ramLength(PHI_HIGH).L)
/** rod length (piston face → crank pin) and barrel length, so the piston stays in the barrel */
export const ROD_LEN = RAM_MIN - 0.05
export const BARREL_LEN = RAM_MAX - ROD_LEN + 0.07

/**
 * Effective lever ratio dy_hitch / dL_ram (virtual work): ram force F = W·dy/dL for a load W
 * hanging on the lower hitch points.
 */
export function leverRatio(phi: number) {
  const h = 1e-4
  const a = ramLength(phi - h)
  const b = ramLength(phi + h)
  const dL = b.L - a.L
  const dy = b.pose.L.y - a.pose.L.y
  return Math.abs(dy / dL)
}
