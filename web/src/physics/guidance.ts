/**
 * GNSS auto-steer: positioning error models, a pure-pursuit path follower on a kinematic
 * bicycle, the A-B pass plan with headland U-turns, and coverage (overlap / gap) accounting.
 *
 * Field frame: metres, +X along the passes, +Z to the right of a tractor heading +X, Y up.
 * A heading h means the tractor faces (cos h, 0, −sin h); its right is (sin h, 0, cos h).
 * Steer δ > 0 turns right, so dh/dt = −v·tan δ / wheelbase.
 */

/* ------------------------------ random numbers (deterministic) ------------------------------ */

export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  const gauss = () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let u = 0
    while (u < 1e-12) u = next()
    const v = next()
    const r = Math.sqrt(-2 * Math.log(u))
    spare = r * Math.sin(2 * Math.PI * v)
    return r * Math.cos(2 * Math.PI * v)
  }
  return { next, gauss }
}

/* ------------------------------ positioning ------------------------------ */

export type FixMode = 'manual' | 'gps' | 'sbas' | 'rtk'

export interface FixSpec {
  label: string
  /** 1σ horizontal error per axis, m */
  sigma: number
  /** correlation time, s — how slowly the error wanders */
  tau: number
  /** typical pass-to-pass accuracy quoted by makers */
  passToPass: string
  note: string
}

export const FIX: Record<FixMode, FixSpec> = {
  manual: {
    label: 'Driver by eye',
    sigma: 0.4,
    tau: 20,
    passToPass: '±0.3–0.5 m',
    note: 'A driver judges the previous pass’s edge by eye, from 2 m up and a few metres ahead. Most drivers leave a safety overlap of 5–10 %.',
  },
  gps: {
    label: 'Standalone GNSS',
    sigma: 1.2,
    tau: 300,
    passToPass: '±0.6–1 m',
    note: 'No corrections: satellite clock, orbit and atmosphere errors make the position wander by a metre or more over minutes. Fine for mapping, not for steering.',
  },
  sbas: {
    label: 'SBAS (free correction)',
    sigma: 0.3,
    tau: 300,
    passToPass: '±15–30 cm',
    note: 'Corrections broadcast by satellite (WAAS, EGNOS, …) remove much of the atmosphere and orbit error. Good enough for spraying and spreading.',
  },
  rtk: {
    label: 'RTK',
    sigma: 0.012,
    tau: 10,
    passToPass: '±2–2.5 cm',
    note: 'A base station on a known point sends carrier-phase corrections by radio or the mobile network. Centimetre repeatable — for planting, strip-till and controlled traffic.',
  },
}

/** One step of a first-order Gauss–Markov process with stationary standard deviation σ. */
export function gaussMarkov(e: number, dt: number, sigma: number, tau: number, n: number) {
  const a = Math.exp(-dt / tau)
  return a * e + sigma * Math.sqrt(1 - a * a) * n
}

/* ------------------------------ path ------------------------------ */

export interface Pass {
  /** pass index across the field */
  k: number
  z: number
  /** direction of travel: +1 along +X, −1 along −X */
  dir: 1 | -1
}

export interface PathPoint {
  x: number
  z: number
  /** heading of the path, rad */
  h: number
  /** index of the pass this point belongs to, or −1 on a headland turn */
  pass: number
}

export interface Plan {
  passes: Pass[]
  pts: PathPoint[]
  /** spacing between points, m */
  ds: number
  x0: number
  x1: number
}

/**
 * Back-and-forth plan: n passes of length L spaced W apart (centred on z = 0), joined by
 * semicircular headland turns of radius W/2 beyond each end. A short lead-in precedes pass 0.
 */
export function makePlan(L: number, W: number, n: number, ds = 0.25): Plan {
  const x0 = -L / 2
  const x1 = L / 2
  const passes: Pass[] = []
  for (let k = 0; k < n; k++) passes.push({ k, z: (k - (n - 1) / 2) * W, dir: k % 2 === 0 ? 1 : -1 })
  const pts: PathPoint[] = []
  const line = (xa: number, xb: number, z: number, pass: number) => {
    const len = Math.abs(xb - xa)
    const m = Math.max(1, Math.round(len / ds))
    const h = xb > xa ? 0 : Math.PI
    for (let i = 0; i < m; i++) pts.push({ x: xa + ((xb - xa) * i) / m, z, h, pass })
  }
  const R = W / 2
  // lead-in
  line(x0 - 10, x0, passes[0].z, -1)
  for (const p of passes) {
    const xs = p.dir > 0 ? x0 : x1
    const xe = p.dir > 0 ? x1 : x0
    line(xs, xe, p.z, p.k)
    if (p.k < n - 1) {
      // U-turn to the next pass (+Z): centre at (xe, z + R)
      const m = Math.max(4, Math.round((Math.PI * R) / ds))
      for (let i = 0; i < m; i++) {
        const t = (i / m) * Math.PI
        const x = xe + p.dir * R * Math.sin(t)
        const z = p.z + R - R * Math.cos(t)
        // tangent: dx = dir·R·cos t, dz = R·sin t → h = atan2(−dz, dx)
        pts.push({ x, z, h: Math.atan2(-R * Math.sin(t), p.dir * R * Math.cos(t)), pass: -1 })
      }
    } else line(xe, xe + p.dir * 10, p.z, -1)
  }
  return { passes, pts, ds, x0, x1 }
}

/** Index of the path point nearest (x, z), searching around a previous index. */
export function nearest(plan: Plan, x: number, z: number, from: number, window = 60) {
  let best = from
  let bd = Infinity
  const a = Math.max(0, from - 5)
  const b = Math.min(plan.pts.length - 1, from + window)
  for (let i = a; i <= b; i++) {
    const p = plan.pts[i]
    const d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

/** Signed cross-track error of (x, z) from the path at index i: + = right of the path. */
export function crossTrack(plan: Plan, i: number, x: number, z: number) {
  const p = plan.pts[i]
  return (x - p.x) * Math.sin(p.h) + (z - p.z) * Math.cos(p.h)
}

/* ------------------------------ control and vehicle ------------------------------ */

/**
 * Pure pursuit: aim at the path point one look-ahead distance ahead and steer onto the arc
 * through it: κ = 2·y/Ld², δ = atan(κ·wheelbase), y = target's offset to the right.
 */
export function purePursuit(plan: Plan, i: number, x: number, z: number, h: number, Ld: number, wheelbase: number, maxSteer: number) {
  const j = Math.min(plan.pts.length - 1, i + Math.max(1, Math.round(Ld / plan.ds)))
  const t = plan.pts[j]
  const dx = t.x - x
  const dz = t.z - z
  const y = dx * Math.sin(h) + dz * Math.cos(h)
  const d2 = Math.max(1e-6, dx * dx + dz * dz)
  const kappa = (2 * y) / d2
  const steer = Math.max(-maxSteer, Math.min(maxSteer, Math.atan(kappa * wheelbase)))
  return { steer, target: t, j }
}

export interface Vehicle {
  x: number
  z: number
  h: number
  /** actual front-wheel steer, rad */
  steer: number
}

/** Kinematic bicycle (rear-axle reference) with a lagging, rate-limited steering actuator. */
export function stepVehicle(v: Vehicle, cmd: number, speed: number, dt: number, wheelbase: number, lag: number, rate: number) {
  const want = v.steer + (cmd - v.steer) * (1 - Math.exp(-dt / Math.max(1e-3, lag)))
  const d = Math.max(-rate * dt, Math.min(rate * dt, want - v.steer))
  v.steer += d
  v.x += speed * Math.cos(v.h) * dt
  v.z += -speed * Math.sin(v.h) * dt
  v.h += (-speed * Math.tan(v.steer) * dt) / wheelbase
}

/* ------------------------------ coverage ------------------------------ */

export interface Coverage {
  x0: number
  z0: number
  /** cell sizes along X and across (Z), m */
  cx: number
  cz: number
  nx: number
  nz: number
  /** times each cell was covered (by different passes) */
  count: Uint8Array
  /** last pass that covered the cell (+1; 0 = never) */
  last: Uint8Array
}

export function makeCoverage(x0: number, x1: number, z0: number, z1: number, cx = 0.5, cz = 0.05): Coverage {
  const nx = Math.ceil((x1 - x0) / cx)
  const nz = Math.ceil((z1 - z0) / cz)
  return { x0, z0, cx, cz, nx, nz, count: new Uint8Array(nx * nz), last: new Uint8Array(nx * nz) }
}

export function clearCoverage(c: Coverage) {
  c.count.fill(0)
  c.last.fill(0)
}

/** Mark a working width W centred at (x, z), across the heading h, for pass `pass`. */
export function paint(c: Coverage, x: number, z: number, h: number, W: number, pass: number) {
  const sx = Math.sin(h)
  const sz = Math.cos(h)
  const steps = Math.ceil(W / (c.cz * 0.7))
  let changed = false
  for (let s = 0; s <= steps; s++) {
    const o = -W / 2 + (W * s) / steps
    const i = Math.floor((x + o * sx - c.x0) / c.cx)
    const k = Math.floor((z + o * sz - c.z0) / c.cz)
    if (i < 0 || k < 0 || i >= c.nx || k >= c.nz) continue
    const idx = k * c.nx + i
    if (c.last[idx] !== pass + 1) {
      c.last[idx] = pass + 1
      if (c.count[idx] < 255) c.count[idx]++
      changed = true
    }
  }
  return changed
}

/**
 * Overlap and gap fractions over the columns the implement has finished. Only the band between
 * the outer edges of the passes done so far counts: gaps are cells left bare inside it.
 */
export function coverageStats(c: Coverage, zLo: number, zHi: number, xLo: number, xHi: number) {
  const k0 = Math.max(0, Math.floor((zLo - c.z0) / c.cz))
  const k1 = Math.min(c.nz - 1, Math.floor((zHi - c.z0) / c.cz))
  const i0 = Math.max(0, Math.floor((xLo - c.x0) / c.cx))
  const i1 = Math.min(c.nx - 1, Math.floor((xHi - c.x0) / c.cx))
  let cells = 0
  let over = 0
  let gap = 0
  for (let k = k0; k <= k1; k++)
    for (let i = i0; i <= i1; i++) {
      const n = c.count[k * c.nx + i]
      cells++
      if (n === 0) gap++
      else if (n > 1) over++
    }
  return { cells, overlap: cells ? over / cells : 0, gap: cells ? gap / cells : 0, area: cells * c.cx * c.cz }
}
