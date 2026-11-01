/** Descriptive geometry: true lengths from auxiliary views, and the curve where two cylinders meet. */

const deg = (r: number) => (r * 180) / Math.PI

/** a line across a block: along x (width), y (height) and z (depth) */
export function trueLength(dx: number, dy: number, dz: number) {
  const length = Math.hypot(dx, dy, dz)
  return {
    length,
    plan: Math.hypot(dx, dz),
    front: Math.hypot(dx, dy),
    end: Math.hypot(dy, dz),
    /** angle to the horizontal plane, and to the frontal plane */
    toHorizontal: deg(Math.asin(dy / length)),
    toFrontal: deg(Math.asin(dz / length)),
    /** the bearing of the plan view from the x axis: the viewing plane must lie parallel to this */
    bearing: deg(Math.atan2(dz, dx)),
  }
}

/** the length seen on a vertical plane turned a from the frontal plane */
export function apparentLength(dx: number, dy: number, dz: number, aDeg: number) {
  const a = (aDeg * Math.PI) / 180
  return Math.hypot(dy, dx * Math.cos(a) + dz * Math.sin(a))
}

export interface Junction {
  /** radius of the main (upright) cylinder and of the branch */
  R: number
  r: number
  /** angle between the two axes, degrees: 90 is a square tee */
  angle: number
  /** branch axis offset from the main axis, in z */
  offset: number
}

/** the point on the curve for the generator at phi around the branch; t is its distance along the branch axis from the main axis */
export function curvePoint({ R, r, angle, offset }: Junction, phi: number) {
  const th = (angle * Math.PI) / 180
  const z = r * Math.sin(phi) + offset
  const x = Math.sqrt(Math.max(0, R * R - z * z))
  const across = r * Math.cos(phi)
  const t = (x - across * Math.cos(th)) / Math.sin(th)
  const y = t * Math.cos(th) - across * Math.sin(th)
  return { x, y, z, t, reaches: Math.abs(z) <= R }
}

/** does the whole branch meet the main cylinder? */
export const meets = (j: Junction) => j.r + Math.abs(j.offset) <= j.R + 1e-9

/** the branch's flat pattern: distance round its surface against the length of each generator up to `end` */
export function development(j: Junction, end: number, n = 48) {
  const s: number[] = []
  const L: number[] = []
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * 2 * Math.PI
    s.push(j.r * phi)
    L.push(end - curvePoint(j, phi).t)
  }
  return { s, L }
}
