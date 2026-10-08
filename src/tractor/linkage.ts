import { LINKAGE } from './dims'

/**
 * Three-point linkage as a four-bar chain (Macmillan Figs 6.4–6.5; AEE502 Hitching notes):
 * chassis A–B, lower link A–L, implement mast L–U, top link B–U. Side view in the X–Y plane.
 * The virtual hitch point V is where the lower-link and top-link lines meet; it is the
 * instantaneous centre of the implement's motion relative to the tractor.
 */

export type P2 = { x: number; y: number }

export interface LinkageGeom {
  A: P2
  B: P2
  lower: number
  top: number
  mast: number
  C: P2
  liftArm: number
  liftRod: number
  liftRodAt: number
}

export const DEFAULT_LINKAGE: LinkageGeom = {
  A: { x: LINKAGE.lowerPivot.x, y: LINKAGE.lowerPivot.y },
  B: { ...LINKAGE.topPivot },
  lower: LINKAGE.lowerLength,
  top: LINKAGE.topLength,
  mast: LINKAGE.mastHeight,
  C: { x: LINKAGE.rockshaft.x, y: LINKAGE.rockshaft.y },
  liftArm: LINKAGE.liftArm,
  liftRod: LINKAGE.liftRod,
  liftRodAt: LINKAGE.liftRodAt,
}

export interface LinkagePose {
  /** lower-link angle below the rearward horizontal (positive = hitch below pivot) */
  phi: number
  /** lower hitch point */
  L: P2
  /** mast top (top-link implement pin) */
  U: P2
  /** mast tilt from vertical (positive = top leaning forward, toward the tractor) */
  mastTilt: number
  /** virtual hitch point (null if links are parallel) */
  V: P2 | null
  /** lift-arm angle above the rearward horizontal, and its end D */
  beta: number
  D: P2
  /** lift-rod attachment on the lower link */
  E: P2
  valid: boolean
}

const sub = (a: P2, b: P2): P2 => ({ x: a.x - b.x, y: a.y - b.y })
const len = (a: P2) => Math.hypot(a.x, a.y)

/** Intersection of circles (c0, r0) and (c1, r1); returns the two points or null. */
export function circleIntersect(c0: P2, r0: number, c1: P2, r1: number): [P2, P2] | null {
  const d = len(sub(c1, c0))
  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a))
  const ex = (c1.x - c0.x) / d
  const ey = (c1.y - c0.y) / d
  const mx = c0.x + a * ex
  const my = c0.y + a * ey
  return [
    { x: mx - h * ey, y: my + h * ex },
    { x: mx + h * ey, y: my - h * ex },
  ]
}

/** Intersection of line p0→p1 with line q0→q1 (infinite lines). */
export function lineIntersect(p0: P2, p1: P2, q0: P2, q1: P2): P2 | null {
  const r = sub(p1, p0)
  const s = sub(q1, q0)
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((q0.x - p0.x) * s.y - (q0.y - p0.y) * s.x) / den
  return { x: p0.x + t * r.x, y: p0.y + t * r.y }
}

/** Solve the linkage for a lower-link angle phi (rad, + = hitch below the pivot). */
export function solveLinkage(phi: number, g: LinkageGeom = DEFAULT_LINKAGE): LinkagePose {
  const dir = { x: -Math.cos(phi), y: -Math.sin(phi) }
  const L = { x: g.A.x + g.lower * dir.x, y: g.A.y + g.lower * dir.y }
  const E = { x: g.A.x + g.liftRodAt * dir.x, y: g.A.y + g.liftRodAt * dir.y }
  // mast top: |U−L| = mast, |U−B| = top; take the upper solution
  const sols = circleIntersect(L, g.mast, g.B, g.top)
  let U: P2 = { x: L.x, y: L.y + g.mast }
  let valid = true
  if (sols) U = sols[0].y > sols[1].y ? sols[0] : sols[1]
  else valid = false
  const m = sub(U, L)
  const mastTilt = Math.atan2(m.x, m.y)
  const V = lineIntersect(g.A, L, g.B, U)
  // lift arm: |D − E| = rod with D = C + arm(−cosβ, sinβ); take the solution with D behind C
  const dsols = circleIntersect(g.C, g.liftArm, E, g.liftRod)
  let D: P2 = { x: g.C.x - g.liftArm, y: g.C.y }
  if (dsols) D = dsols[0].x < dsols[1].x ? dsols[0] : dsols[1]
  else valid = false
  const beta = Math.atan2(D.y - g.C.y, g.C.x - D.x)
  return { phi, L, U, mastTilt, V, beta, D, E, valid }
}

/** Lower-link angle that puts the lower hitch point at height y (clamped to the reach). */
export function phiForHitchHeight(y: number, g: LinkageGeom = DEFAULT_LINKAGE) {
  const s = Math.max(-1, Math.min(1, (g.A.y - y) / g.lower))
  return Math.asin(s)
}

/** Operating range of the lower link (rad) for which the chain closes. */
export function linkageRange(g: LinkageGeom = DEFAULT_LINKAGE) {
  let lo = NaN
  let hi = NaN
  for (let p = -0.9; p <= 1.2; p += 0.005) {
    if (solveLinkage(p, g).valid) {
      if (Number.isNaN(lo)) lo = p
      hi = p
    }
  }
  return { lo, hi }
}
