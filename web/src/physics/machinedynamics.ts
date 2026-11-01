/**
 * Machine dynamics: moments of inertia by oscillation, balancing, governors, flywheels, cams, and
 * velocity and acceleration diagrams. SI units; angles in radians.
 */
const G = 9.81
const TAU = 2 * Math.PI
export const rpmToRad = (n: number) => (n * TAU) / 60
export const radToRpm = (w: number) => (w * 60) / TAU

/* ------------------------------------------------------------------ inertia by oscillation */
/** compound pendulum: I about the pivot, from its period, with G a distance h below the pivot */
export const pendulumInertia = (m: number, h: number, T: number) => m * G * h * (T / TAU) ** 2
/** the period of a body with radius of gyration k about G, swung a distance h from G */
export const pendulumPeriod = (k: number, h: number) => TAU * Math.sqrt((k * k + h * h) / (G * h))
/** bifilar or trifilar suspension: wires of length L at radius r from the axis */
export const suspensionInertia = (m: number, r: number, L: number, T: number) => (m * G * r * r * (T / TAU) ** 2) / L
export const suspensionPeriod = (I: number, m: number, r: number, L: number) => TAU * Math.sqrt((I * L) / (m * G * r * r))

/* ------------------------------------------------------------------ rotating balance */
export interface RotatingMass {
  /** kg */
  m: number
  /** radius, m */
  r: number
  /** angle, rad */
  angle: number
  /** position along the shaft, m */
  z?: number
}

const wrap = (a: number) => ((a % TAU) + TAU) % TAU

/** the out-of-balance mr vector */
export function resultantMr(ms: RotatingMass[]) {
  let x = 0
  let y = 0
  for (const q of ms) {
    x += q.m * q.r * Math.cos(q.angle)
    y += q.m * q.r * Math.sin(q.angle)
  }
  return { x, y, mag: Math.hypot(x, y), angle: wrap(Math.atan2(y, x)) }
}

/** the single balancing mass at radius rb, in one plane */
export function staticBalance(ms: RotatingMass[], rb: number) {
  const R = resultantMr(ms)
  return { mbrb: R.mag, mb: R.mag / rb, angle: wrap(R.angle + Math.PI), unbalancedForce: (w: number) => R.mag * w * w }
}

/** the two balancing mr vectors, in planes at zA and zB, that remove both the force and the couple */
export function dynamicBalance(ms: RotatingMass[], zA: number, zB: number) {
  const L = zB - zA
  let bx = 0
  let by = 0
  for (const q of ms) {
    const arm = (q.z ?? 0) - zA
    bx -= (q.m * q.r * arm * Math.cos(q.angle)) / L
    by -= (q.m * q.r * arm * Math.sin(q.angle)) / L
  }
  const R = resultantMr(ms)
  const ax = -R.x - bx
  const ay = -R.y - by
  return {
    a: { mr: Math.hypot(ax, ay), angle: wrap(Math.atan2(ay, ax)) },
    b: { mr: Math.hypot(bx, by), angle: wrap(Math.atan2(by, bx)) },
  }
}

/** the couple left about plane z = 0 */
export function coupleMrz(ms: RotatingMass[]) {
  let x = 0
  let y = 0
  for (const q of ms) {
    x += q.m * q.r * (q.z ?? 0) * Math.cos(q.angle)
    y += q.m * q.r * (q.z ?? 0) * Math.sin(q.angle)
  }
  return Math.hypot(x, y)
}

/** the ball-count experiment: hanging n balls of mass mBall on a pulley radius R lifts mr through 90° */
export const ballsToBalance = (mr: number, mBall: number, R: number) => mr / (mBall * R)

/* ------------------------------------------------------------------ reciprocating balance */
/** the inertia force of mass m with crank r and rod ratio n: primary, secondary, total */
export function reciprocatingForce(m: number, r: number, n: number, w: number, theta: number) {
  const primary = m * w * w * r * Math.cos(theta)
  const secondary = (m * w * w * r * Math.cos(2 * theta)) / n
  return { primary, secondary, total: primary + secondary }
}

/** two point masses dynamically equivalent to a link: a from G to the first, ab = k² */
export function equivalentMasses(m: number, I: number, a: number) {
  const k2 = I / m
  const b = k2 / a
  return { k2, b, m1: (m * b) / (a + b), m2: (m * a) / (a + b) }
}

/** the rod's parts at its two ends: reciprocating at the small end, rotating at the big end */
export function rodEnds(m: number, L: number, fromSmallEnd: number) {
  return { reciprocating: (m * (L - fromSmallEnd)) / L, rotating: (m * fromSmallEnd) / L }
}

/* ------------------------------------------------------------------ governors */
/** Watt: h = g/ω² (for arms meeting on the spindle) */
export const wattHeight = (w: number) => G / (w * w)
export const wattSpeed = (h: number) => Math.sqrt(G / h)

/**
 * Porter, equal upper and lower arms hung at offset from the spindle. α is the arm's angle to the
 * vertical; ball mass m, central load M on the sleeve (all of it, not per side).
 */
export function porter(m: number, M: number, arm: number, offset: number, alpha: number) {
  const r = offset + arm * Math.sin(alpha)
  const F = (m + M) * G * Math.tan(alpha)
  return { r, controllingForce: F, w: Math.sqrt(F / (m * r)), sleeve: 2 * arm * Math.cos(alpha) }
}

/** the arm's angle once the sleeve has risen by lift from where α₀ left it */
export const porterAlphaAfterLift = (arm: number, alpha0: number, lift: number) => Math.acos(Math.cos(alpha0) - lift / (2 * arm))

/** a governor's sensitivity: speed range over mean speed */
export const sensitivity = (n1: number, n2: number) => (2 * (n2 - n1)) / (n1 + n2)

/** Hartnell: bell crank with ball arm a and sleeve arm b; two balls */
export function hartnell(m: number, a: number, b: number, r0: number, n0: number, speedRise: number, sleeveMove: number) {
  const r1 = r0
  const r2 = r0 + (sleeveMove * a) / b
  const w1 = rpmToRad(n0)
  const w2 = w1 * (1 + speedRise)
  const F1 = m * w1 * w1 * r1
  const F2 = m * w2 * w2 * r2
  const S1 = (2 * F1 * a) / b
  const S2 = (2 * F2 * a) / b
  return { r2, F1, F2, S1, S2, k: (S2 - S1) / sleeveMove }
}

/* ------------------------------------------------------------------ flywheels */
export const flywheelInertia = (m: number, k: number) => m * k * k
/** energy given up between two speeds */
export const energyFluctuation = (I: number, w1: number, w2: number) => (I * (w1 * w1 - w2 * w2)) / 2
/** coefficient of fluctuation of speed */
export const speedFluctuation = (w1: number, w2: number) => (2 * (w1 - w2)) / (w1 + w2)
/** I needed for fluctuation Cs at mean speed w: ΔE = I ω² Cs */
export const requiredInertia = (dE: number, w: number, Cs: number) => dE / (w * w * Cs)

/* ------------------------------------------------------------------ cams */
export type CamMotion = 'uniform' | 'shm' | 'cycloidal' | 'parabolic'

export interface CamSegment {
  /** the angle at which it ends, rad */
  to: number
  /** lift at the end of the segment, m */
  lift: number
  motion: CamMotion
}

/** fraction of the rise done at fraction u of the segment */
export function motionLaw(motion: CamMotion, u: number) {
  if (motion === 'uniform') return u
  if (motion === 'shm') return (1 - Math.cos(Math.PI * u)) / 2
  if (motion === 'parabolic') return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2
  return u - Math.sin(TAU * u) / TAU
}

/** follower lift at cam angle θ */
export function camLift(segments: CamSegment[], theta: number) {
  const t = wrap(theta)
  let from = 0
  let start = segments.length ? segments[segments.length - 1].lift : 0
  for (const s of segments) {
    if (t <= s.to) return start + (s.lift - start) * motionLaw(s.motion, (t - from) / (s.to - from))
    from = s.to
    start = s.lift
  }
  return start
}

/** the classic exercise: lift uniformly to 120°, dwell to 180°, fall with SHM to 360° */
export const CLASSIC_CAM = (lift: number): CamSegment[] => [
  { to: (120 * Math.PI) / 180, lift, motion: 'uniform' },
  { to: Math.PI, lift, motion: 'uniform' },
  { to: TAU, lift: 0, motion: 'shm' },
]

/* ------------------------------------------------------------------ velocity and acceleration diagrams */
export interface LinkState {
  /** velocities, m/s, as vectors */
  vB: [number, number]
  vC: [number, number]
  vCB: [number, number]
  /** angular velocities of coupler and output */
  w3: number
  w4: number
  /** accelerations */
  aB: [number, number]
  aC: [number, number]
  /** components for the polygon */
  aCn: [number, number]
  aCt: [number, number]
  aCBn: [number, number]
  aCBt: [number, number]
  a3: number
  a4: number
}

const perp = (v: [number, number], w: number): [number, number] => [-w * v[1], w * v[0]]
const scale = (v: [number, number], k: number): [number, number] => [v[0] * k, v[1] * k]
const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]]
const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]]
const cross = (a: [number, number], b: [number, number]) => a[0] * b[1] - a[1] * b[0]

/**
 * A four-bar at one instant: A at the origin and D on +x, with pins B and C. The crank turns at
 * steady ω₂ unless α₂ is given. Solves the velocity and acceleration polygons by the relative
 * vector equations, exactly as they are drawn.
 */
export function fourBarDiagrams(B: [number, number], C: [number, number], D: [number, number], w2: number, a2 = 0): LinkState {
  const rB = B
  const rCB = sub(C, B)
  const rC = sub(C, D)
  const vB = perp(rB, w2)
  // vC = vB + w3 × rCB = w4 × rC
  const u3 = perp(rCB, 1)
  const u4 = perp(rC, 1)
  const det = cross(u4, u3)
  const w4 = cross(vB, u3) / det
  const w3 = cross(vB, u4) / det
  const vC = perp(rC, w4)
  const vCB = perp(rCB, w3)
  // aC = aB + aCB(n) + a3 × rCB = aC(n) + a4 × rC
  const aB = add(scale(rB, -w2 * w2), perp(rB, a2))
  const aCBn = scale(rCB, -w3 * w3)
  const aCn = scale(rC, -w4 * w4)
  const known = sub(add(aB, aCBn), aCn)
  const a4 = cross(known, u3) / det
  const a3 = cross(known, u4) / det
  const aCt = perp(rC, a4)
  const aCBt = perp(rCB, a3)
  return { vB, vC, vCB, w3, w4, aB, aC: add(aCn, aCt), aCn, aCt, aCBn, aCBt, a3, a4 }
}

/** the coupler's instantaneous centre: where the lines of the crank and the output lever meet */
export function instantaneousCentre(B: [number, number], C: [number, number], D: [number, number]): [number, number] | null {
  const dC: [number, number] = sub(C, D)
  const denom = cross(B, dC)
  if (Math.abs(denom) < 1e-9) return null
  const t = cross(D, dC) / denom
  return scale(B, t)
}

/* ------------------------------------------------------------------ turning moment */
export type TurningKind = 'four-stroke' | 'four-cylinder' | 'press'

/** one repeat of the turning moment, in radians of crank */
export const turningPeriod = (k: TurningKind) => (k === 'four-stroke' ? 4 * Math.PI : k === 'four-cylinder' ? Math.PI : 2 * Math.PI)

/**
 * A representative turning moment for peak torque Tp: a four-stroke's expansion, exhaust, suction and
 * compression; four such cylinders firing in turn; or a press that takes its load in one short stroke
 * (the load is then what varies, so the driving moment is steady and this returns the load torque).
 */
export function turningMoment(k: TurningKind, Tp: number, theta: number): number {
  const t = wrap(theta)
  if (k === 'press') return t < Math.PI / 3 ? Tp * Math.sin(3 * t) : 0.02 * Tp
  const single = (a: number) => {
    const q = ((a % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)
    const s = Math.sin(q % Math.PI)
    if (q < Math.PI) return Tp * s
    if (q < 2 * Math.PI) return -0.05 * Tp * s
    if (q < 3 * Math.PI) return -0.05 * Tp * s
    return -0.25 * Tp * s
  }
  if (k === 'four-stroke') return single(theta)
  return single(theta) + single(theta + Math.PI) + single(theta + 2 * Math.PI) + single(theta + 3 * Math.PI)
}

/** mean moment, the excess energy over the mean at each angle, and its peak-to-peak range */
export function turningStats(k: TurningKind, Tp: number, n = 720) {
  const P = turningPeriod(k)
  const h = P / n
  let sum = 0
  for (let i = 0; i < n; i++) sum += turningMoment(k, Tp, (i + 0.5) * h) * h
  const mean = sum / P
  const sign = k === 'press' ? -1 : 1
  const angle: number[] = []
  const T: number[] = []
  const E: number[] = []
  let e = 0
  let lo = 0
  let hi = 0
  for (let i = 0; i <= n; i++) {
    const a = i * h
    angle.push(a)
    T.push(turningMoment(k, Tp, a))
    E.push(e)
    lo = Math.min(lo, e)
    hi = Math.max(hi, e)
    e += sign * (turningMoment(k, Tp, a + h / 2) - mean) * h
  }
  return { mean, angle, T, E, dE: hi - lo, period: P, loE: lo, hiE: hi }
}

/* ------------------------------------------------------------------ multi-cylinder engines */
/** the primary and secondary out-of-balance, per m r ω², for crank angles (rad): zero means balanced */
export function cylinderBalance(cranks: number[]) {
  const mag = (k: number) => Math.hypot(cranks.reduce((s, a) => s + Math.cos(k * a), 0), cranks.reduce((s, a) => s + Math.sin(k * a), 0))
  return { primary: mag(1), secondary: mag(2) }
}

/**
 * A slider-crank at one instant: crank centre at the origin, the slider on the x axis at C. The same
 * relative equations, except that C's motion is known to lie along the line of stroke.
 */
export function sliderCrankDiagrams(r: number, l: number, theta: number, w2: number): LinkState & { C: [number, number]; B: [number, number] } {
  const B: [number, number] = [r * Math.cos(theta), r * Math.sin(theta)]
  const C: [number, number] = [B[0] + Math.sqrt(l * l - B[1] * B[1]), 0]
  const rCB = sub(C, B)
  const vB = perp(B, w2)
  // v_C = v_B + w3 × rCB, with v_C having no y part
  const u3 = perp(rCB, 1)
  const w3 = -vB[1] / u3[1]
  const vCB = perp(rCB, w3)
  const vC: [number, number] = [vB[0] + vCB[0], 0]
  const aB = scale(B, -w2 * w2)
  const aCBn = scale(rCB, -w3 * w3)
  // a_C = a_B + a_n + a3 × rCB, again with no y part
  const known = add(aB, aCBn)
  const a3 = -known[1] / u3[1]
  const aCBt = perp(rCB, a3)
  const aC: [number, number] = [known[0] + aCBt[0], 0]
  return { B, C, vB, vC, vCB, w3, w4: 0, aB, aC, aCn: [0, 0], aCt: aC, aCBn, aCBt, a3, a4: 0 }
}
