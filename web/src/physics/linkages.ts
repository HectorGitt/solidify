/**
 * Mechanisms that turn rotation into something else: the slider-crank, the scotch yoke, the Geneva
 * wheel and the Oldham coupling. Angles in radians; lengths in whatever unit goes in.
 */

/* ------------------------------------------------------------------ scotch yoke */
export const yokeDisplacement = (r: number, theta: number) => r * (1 - Math.cos(theta))
export const yokeVelocity = (r: number, w: number, theta: number) => w * r * Math.sin(theta)
export const yokeAcceleration = (r: number, w: number, theta: number) => w * w * r * Math.cos(theta)

/* ------------------------------------------------------------------ slider-crank */
export interface SliderCrank {
  /** crank radius */
  r: number
  /** connecting rod */
  l: number
  /** the line of stroke's offset from the crank centre */
  e: number
}

/** the slider's distance along the line of stroke from the crank centre, at crank angle θ from the line of stroke */
export const sliderPosition = (m: SliderCrank, theta: number) => m.r * Math.cos(theta) + Math.sqrt(Math.max(0, m.l * m.l - (m.r * Math.sin(theta) - m.e) ** 2))

/** the crank angles of the two dead centres, where crank and rod lie in line */
export function deadCentres(m: SliderCrank) {
  return { tdc: Math.asin(m.e / (m.l + m.r)), bdc: Math.PI + Math.asin(m.e / (m.l - m.r)) }
}

export const stroke = (m: SliderCrank) => Math.sqrt((m.l + m.r) ** 2 - m.e ** 2) - Math.sqrt((m.l - m.r) ** 2 - m.e ** 2)

/** displacement from the outer dead centre */
export const sliderDisplacement = (m: SliderCrank, theta: number) => Math.sqrt((m.l + m.r) ** 2 - m.e ** 2) - sliderPosition(m, theta)

/** velocity away from the outer dead centre, exact (constant ω) */
export function sliderVelocity(m: SliderCrank, w: number, theta: number) {
  const q = m.r * Math.sin(theta) - m.e
  return w * m.r * (Math.sin(theta) + (q * Math.cos(theta)) / Math.sqrt(m.l * m.l - q * q))
}

/** acceleration, by differentiating the exact velocity */
export function sliderAcceleration(m: SliderCrank, w: number, theta: number) {
  const h = 1e-5
  return (w * (sliderVelocity(m, w, theta + h) - sliderVelocity(m, w, theta - h))) / (2 * h)
}

/** with no offset: x = r(n + 1 − cos θ − √(n² − sin²θ)), n = l/r */
export const sliderExact = (r: number, n: number, theta: number) => r * (n + 1 - Math.cos(theta) - Math.sqrt(n * n - Math.sin(theta) ** 2))
/** the usual approximations, dropping the higher harmonics */
export const sliderVelocityApprox = (r: number, n: number, w: number, theta: number) => w * r * (Math.sin(theta) + Math.sin(2 * theta) / (2 * n))
export const sliderAccelerationApprox = (r: number, n: number, w: number, theta: number) => w * w * r * (Math.cos(theta) + Math.cos(2 * theta) / n)

/** an offset slider returns quicker than it goes out: time out over time back at steady ω */
export function quickReturnRatio(m: SliderCrank) {
  const { tdc, bdc } = deadCentres(m)
  const out = bdc - tdc
  return out / (2 * Math.PI - out)
}

/* ------------------------------------------------------------------ Geneva wheel */
/** the driver's pin radius over the distance between centres, for n slots */
export const genevaLambda = (n: number) => Math.sin(Math.PI / n)
/** the driver is engaged while |α| ≤ this, measured from the line of centres */
export const genevaHalfEngagement = (n: number) => Math.PI / 2 - Math.PI / n
/** output step per engagement */
export const genevaStep = (n: number) => (2 * Math.PI) / n
/** the share of each driver revolution during which the output moves */
export const genevaMovingFraction = (n: number) => (n - 2) / (2 * n)

/** the wheel's angle from the centre of its step, for pin angle α while engaged */
export function genevaOutput(n: number, alpha: number) {
  const k = genevaLambda(n)
  return Math.atan2(k * Math.sin(alpha), 1 - k * Math.cos(alpha))
}

/** ω₂/ω₁ while engaged */
export function genevaVelocityRatio(n: number, alpha: number) {
  const k = genevaLambda(n)
  return (k * (Math.cos(alpha) - k)) / (1 - 2 * k * Math.cos(alpha) + k * k)
}

/** α₂/ω₁² while engaged */
export function genevaAccelerationRatio(n: number, alpha: number) {
  const k = genevaLambda(n)
  const D = 1 - 2 * k * Math.cos(alpha) + k * k
  return (k * Math.sin(alpha) * (k * k - 1)) / (D * D)
}

/**
 * The output's total angle at driver angle θ, for any number of turns. θ = 0 is the pin entering the
 * first slot, so the first step is taken over the following 2 × halfEngagement.
 */
export function genevaAngle(n: number, theta: number) {
  const span = 2 * genevaHalfEngagement(n)
  const turn = 2 * Math.PI
  const k = Math.floor(theta / turn)
  const t = theta - k * turn
  const base = k * genevaStep(n)
  if (t >= span) return base + genevaStep(n)
  return base + genevaStep(n) / 2 + genevaOutput(n, t - span / 2)
}

/* ------------------------------------------------------------------ Oldham coupling */
/**
 * Two parallel shafts offset by d. Each tongue keeps its groove, so the disc turns at shaft speed, and
 * its centre runs round a circle of diameter d (the line of centres is its diameter), twice per turn.
 */
export function oldhamCentre(d: number, theta: number): [number, number] {
  return [(d / 2) * (1 - Math.cos(2 * theta)), (d / 2) * Math.sin(2 * theta)]
}
/** the sliding speed in each groove peaks at ω d */
export const oldhamMaxSliding = (d: number, w: number) => w * d
