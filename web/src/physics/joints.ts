/**
 * Hooke's (Cardan) joint and double-joint kinematics.
 *
 * Notation follows the AEE502 marking guides (2016/17 Q4d, 2017/18 Q4d):
 *   δ = angle between the driving and driven shafts,
 *   θ = rotation of the driving shaft, measured from the position where the driving
 *       yoke lies in the plane containing both shafts (output is then at its fastest).
 * The textbook extract ("Hooke's joint analysis-2", §26.2.2) swaps the letters: it uses
 * θ for the shaft angle and α for the driver rotation. Dunn's tutorial uses φ for the
 * shaft angle.
 *
 * All angles in radians, speeds in any consistent unit (rad/s or rpm), SI otherwise.
 */

const { PI, cos, sin, atan2, sqrt, round, abs } = Math

/** ω_B/ω_A = cos δ / (1 − sin²δ·cos²θ)  (AEE502 guides; analysis-2 §26.2.2; Dunn eq. 1). */
export function hookeVelocityRatio(delta: number, theta: number) {
  const s = sin(delta)
  const c = cos(theta)
  return cos(delta) / (1 - s * s * c * c)
}

/** Driven-shaft speed for a driver speed ω_A (same units as ω_A). */
export function hookeDrivenSpeed(omegaA: number, delta: number, theta: number) {
  return omegaA * hookeVelocityRatio(delta, theta)
}

/**
 * Driven-shaft angle, continuous (unwrapped): tan θ_B = tan θ / cos δ.
 * θ_B equals θ at every quarter turn; in between the output leads, then lags.
 */
export function hookeOutputAngle(delta: number, theta: number) {
  const turns = round(theta / (2 * PI))
  const base = theta - turns * 2 * PI
  return atan2(sin(base), cos(base) * cos(delta)) + turns * 2 * PI
}

/**
 * Angular acceleration of the driven shaft for a constant driver speed ω_A (rad/s):
 * α_B = −ω_A²·cos δ·sin²δ·sin 2θ / (1 − cos²θ·sin²δ)²   (analysis-2 §26.2.2, Example 26.3).
 */
export function hookeAcceleration(delta: number, theta: number, omegaA: number) {
  const s2 = sin(delta) ** 2
  const c2 = cos(theta) ** 2
  return (-(omegaA * omegaA) * cos(delta) * s2 * sin(2 * theta)) / (1 - c2 * s2) ** 2
}

/** Maximum and minimum driven speed: ω_A/cos δ (θ = 0°, 180°) and ω_A·cos δ (θ = 90°, 270°). */
export function hookeSpeedRange(omegaA: number, delta: number) {
  const max = omegaA / cos(delta)
  const min = omegaA * cos(delta)
  return {
    max,
    min,
    /** speed range = ω_A (1/cos δ − cos δ) */
    range: max - min,
    /** fluctuation as a fraction of the mean input speed */
    fluctuation: (max - min) / omegaA,
  }
}

/**
 * Largest angular-position difference θ_B − θ over a revolution (rad).
 * Maximum where tan θ = √cos δ. The full swing (lead to lag) is twice this.
 */
export function hookeMaxPositionError(delta: number) {
  const th = Math.atan(sqrt(cos(delta)))
  return hookeOutputAngle(delta, th) - th
}

/** Driver angles (rad) at which the driven shaft has its peak acceleration and deceleration. */
export function hookePeakAcceleration(delta: number, omegaA: number, samples = 3600) {
  let best = 0
  let at = 0
  for (let i = 0; i < samples; i++) {
    const th = (i / samples) * PI
    const a = abs(hookeAcceleration(delta, th, omegaA))
    if (a > best) {
      best = a
      at = th
    }
  }
  return { alphaMax: best, theta: at }
}

/** Polar mass moment of inertia from a weight (N) and radius of gyration (m): I = (W/g)·k². */
export function inertiaFromWeight(weightN: number, k: number, g = 9.81) {
  return (weightN / g) * k * k
}

/**
 * Inertia torque on the driven shaft and the torque it demands at the driving shaft
 * (power balance T_A·ω_A = T_B·ω_B, losses neglected) — analysis-2 Example 26.3.
 */
export function hookeInertiaTorque(delta: number, theta: number, omegaA: number, I: number) {
  const alphaB = hookeAcceleration(delta, theta, omegaA)
  const ratio = hookeVelocityRatio(delta, theta)
  const TB = I * alphaB
  return { alphaB, ratio, TB, TA: TB * ratio }
}

/* ------------------------------ Double joint ------------------------------ */

export interface DoubleJointSpec {
  /** angle at the first joint (input → intermediate shaft) */
  delta1: number
  /** angle at the second joint (intermediate → output shaft) */
  delta2: number
  /**
   * Twist of the intermediate shaft's second yoke relative to its first (rad).
   * 0 = yokes in line / in the same plane ("in phase"), π/2 = out of phase.
   */
  phase: number
  /**
   * Rotation of the second joint's plane about the intermediate shaft (rad). 0 = all three
   * shafts in one plane. Kinematically a twist γ acts exactly like a yoke phase error of −γ.
   */
  twist?: number
}

/**
 * Two Hooke's joints in series with all three shafts in one plane (Z or W arrangement —
 * kinematically the same). The second joint is driven by the intermediate shaft; with the
 * intermediate yokes in line its driving yoke is a quarter turn from the first joint's
 * driving yoke, so it reproduces the first joint's fluctuation in reverse.
 */
export function doubleHooke(spec: DoubleJointSpec, theta: number) {
  const { delta1, delta2, phase } = spec
  const thetaC = hookeOutputAngle(delta1, theta)
  const ratioC = hookeVelocityRatio(delta1, theta)
  const q = PI / 2 + phase - (spec.twist ?? 0)
  const thetaOut = hookeOutputAngle(delta2, thetaC + q) - q
  const ratio2 = hookeVelocityRatio(delta2, thetaC + q)
  return {
    /** intermediate shaft angle */
    thetaC,
    /** ω_C/ω_A */
    ratioC,
    thetaOut,
    /** ω_out/ω_A */
    ratio: ratioC * ratio2,
  }
}

/** Max/min output-to-input speed ratio of a double joint over one revolution. */
export function doubleHookeRange(spec: DoubleJointSpec, samples = 720) {
  let max = -Infinity
  let min = Infinity
  for (let i = 0; i < samples; i++) {
    const r = doubleHooke(spec, (i / samples) * 2 * PI).ratio
    if (r > max) max = r
    if (r < min) min = r
  }
  return { max, min, fluctuation: max - min }
}

/** The ideal joint: does a pair give uniform output? (equal angles, yokes in line, one plane). */
export function isConstantVelocityPair(spec: DoubleJointSpec, tol = 1e-9) {
  const r = doubleHookeRange(spec, 360)
  return r.fluctuation < tol
}

/**
 * Second-joint driver angle offset for DriveGraph.hookeJoint: the second joint's driving yoke
 * sits a quarter turn (+ yoke phase − plane twist) from the first joint's reference, so
 * θ_out = hookeAngle(θ_C − φ, δ₂) + φ with φ = twist − phase − π/2.
 */
export function secondJointPhase(spec: Pick<DoubleJointSpec, 'phase' | 'twist'>) {
  return (spec.twist ?? 0) - spec.phase - PI / 2
}

/**
 * PTO driveline joint angles in a turn (plan view, all shafts in one plane). Tractor PTO joint
 * at the origin; hitch pin a behind it; implement input joint b behind the hitch along the
 * implement, which is turned ψ relative to the tractor. Hitch midway (a = b) → δ₁ = δ₂ = ψ/2
 * (Culpin, AEE510 TOP p5, BS 1495).
 */
export function hitchJointAngles(a: number, b: number, psi: number) {
  const jx = a + b * cos(psi)
  const jz = -b * sin(psi)
  const shaft = atan2(-jz, jx) // intermediate shaft yaw from the tractor axis
  const delta1 = abs(shaft)
  const delta2 = abs(psi - shaft)
  return { delta1, delta2, length: sqrt(jx * jx + jz * jz), shaftYaw: shaft }
}

/* ------------------------------ steering boxes ------------------------------ */

/**
 * Recirculating-ball box (Tractor Steering Fig 46): the nut travels lead·θ/2π along the column
 * thread and its peg swings the rocker arm (peg sliding in the arm slot), tan φ = x/r.
 * Returns nut travel x (m), rocker/drop-arm angle φ (rad) and the instantaneous ratio dθ/dφ.
 */
export function recircBall(thetaWheel: number, lead: number, arm: number) {
  const x = (lead * thetaWheel) / (2 * PI)
  const phi = Math.atan(x / arm)
  const ratio = ((2 * PI * arm) / lead) * (1 + (x / arm) ** 2)
  return { x, phi, ratio }
}

/**
 * Worm-and-peg box: the peg on the rocker arm (radius r) follows the worm thread, so its axial
 * position r·sin φ equals lead·θ/2π. Ratio dθ/dφ = 2πr·cos φ / lead.
 */
export function wormPeg(thetaWheel: number, lead: number, arm: number) {
  const x = (lead * thetaWheel) / (2 * PI)
  const phi = Math.asin(Math.max(-1, Math.min(1, x / arm)))
  const ratio = (2 * PI * arm * cos(phi)) / lead
  return { x, phi, ratio }
}

/** Lead that gives a drop-arm swing ±φmax (rad) at ±turns of the wheel (lock to centre). */
export function leadForSwing(kind: 'ball' | 'peg', arm: number, phiMax: number, turns: number) {
  const x = kind === 'ball' ? arm * Math.tan(phiMax) : arm * sin(phiMax)
  return x / turns
}

/* ------------------------------ helpers ------------------------------ */

export const deg = (r: number) => (r * 180) / PI
export const rad = (d: number) => (d * PI) / 180
export const rpmToRad = (n: number) => (2 * PI * n) / 60
export const radToRpm = (w: number) => (w * 60) / (2 * PI)


/* ------------------------------ constant-velocity joints ------------------------------ */

/**
 * Ball-type CV joint (Rzeppa / Birfield, Weiss): the balls lie in the plane bisecting the shaft
 * angle (homokinetic plane, analysis-2 §26.2.5–26.2.6), so the joint is mirror-symmetric and
 * the output turns through exactly the input angle. Centre of the ball that sits in the input
 * groove at meridian angle ψ (from +Y about the input axis +X), for a ball-circle radius R and
 * an output axis yawed δ about Y. Returns [x, y, z].
 */
export function cvBallCentre(psi: number, delta: number, R: number): [number, number, number] {
  const x = sin(psi) * Math.tan(delta / 2)
  const y = cos(psi)
  const z = sin(psi)
  const k = R / sqrt(x * x + y * y + z * z)
  return [x * k, y * k, z * k]
}

export interface TripodeState {
  /** drive-shaft (spider) rotation, rad */
  phi: number
  /** spider-centre offset from the pot axis, m */
  cy: number
  cz: number
}

/**
 * Plunging tripode (tripot) joint, Fig 26.24: pot on the input (axis +X, three parallel roller
 * grooves), spider on the drive shaft (axis yawed δ about Y), rollers free to slide along the
 * legs. Each roller centre must stay on its groove's mid-plane; solving the three conditions
 * gives the drive-shaft angle and the small orbit of the spider centre (beyond the notes, which
 * simply call the joint constant-velocity).
 */
export function tripodeSolve(theta: number, delta: number, legR: number, guess?: TripodeState): TripodeState {
  const s = guess ? { ...guess } : { phi: theta, cy: 0, cz: 0 }
  const sd = sin(delta)
  const cd = cos(delta)
  const f = (v: TripodeState) =>
    [0, 1, 2].map((k) => {
      const a = v.phi + (2 * PI * k) / 3
      const b = theta + (2 * PI * k) / 3
      void sd
      return -(v.cy + legR * cos(a)) * sin(b) + (v.cz + legR * sin(a) * cd) * cos(b)
    })
  for (let it = 0; it < 30; it++) {
    const f0 = f(s)
    if (Math.max(...f0.map(abs)) < 1e-15) break
    const h = 1e-7
    const cols = (['phi', 'cy', 'cz'] as const).map((key) => {
      const t = { ...s, [key]: s[key] + h }
      return f(t).map((v, i) => (v - f0[i]) / h)
    })
    // solve J·d = −f (3×3, Cramer)
    const Jm = [0, 1, 2].map((r) => [cols[0][r], cols[1][r], cols[2][r]])
    const det = (m: number[][]) =>
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    const D = det(Jm)
    if (abs(D) < 1e-30) break
    const d = [0, 1, 2].map((c) => det(Jm.map((row, r) => row.map((v, j) => (j === c ? -f0[r] : v)))) / D)
    s.phi += d[0]
    s.cy += d[1]
    s.cz += d[2]
  }
  return s
}
