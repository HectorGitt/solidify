/**
 * Forage harvesting: the crank-and-pitman reciprocating cutter-bar mower and the pick-up baler.
 * SI units unless a name says otherwise.
 *
 * Notes: AEE502 AGRICULTURAL MACHINERIES §16.2.1–16.2.3 (cutter bar, crank and pitman, shoes,
 * registration and alignment with a lead of 6 mm per metre, hay 80 % → 20 % moisture, baler
 * pick-up / auger / packer arms / ram / knotter, bales about 35 × 45 × 90 cm). The kinematic and
 * throughput relations are standard textbook results (beyond notes) that make those words numeric.
 */
const { PI, sin, cos, sqrt, asin } = Math

/* ------------------------------ crank and pitman ------------------------------ */

export interface Pitman {
  /** crank radius, m */
  r: number
  /** pitman (connecting rod) length, m */
  l: number
  /** offset of the crank centre from the knife line, m (0 = in line) */
  e?: number
}

/**
 * Knife-head position along the bar (m, measured from the crank centre) for crank angle θ:
 * x = r cosθ + √(l² − (r sinθ − e)²). The pitman turns the crank's rotation into the knife's
 * to-and-fro motion, as a connecting rod does in an engine (§16.2.1).
 */
export function knifePosition(p: Pitman, theta: number) {
  const e = p.e ?? 0
  const s = p.r * sin(theta) - e
  return p.r * cos(theta) + sqrt(p.l * p.l - s * s)
}

/** Knife displacement from its inner dead centre, m (0 … stroke). */
export function knifeDisplacement(p: Pitman, theta: number) {
  return knifePosition(p, theta) - knifeInnerDeadCentre(p)
}

/** Inner dead-centre position (knife nearest the crank). */
export function knifeInnerDeadCentre(p: Pitman) {
  const e = p.e ?? 0
  return sqrt((p.l - p.r) ** 2 - e * e)
}

/** Outer dead-centre position. */
export function knifeOuterDeadCentre(p: Pitman) {
  const e = p.e ?? 0
  return sqrt((p.l + p.r) ** 2 - e * e)
}

/** Knife stroke, m: 2r for an in-line crank and pitman, slightly more with an offset. */
export const knifeStroke = (p: Pitman) => knifeOuterDeadCentre(p) - knifeInnerDeadCentre(p)

/** Knife velocity, m/s, at crank angle θ and crank speed ω (rad/s) (numerical derivative). */
export function knifeVelocity(p: Pitman, theta: number, omega: number) {
  const d = 1e-5
  return ((knifePosition(p, theta + d) - knifePosition(p, theta - d)) / (2 * d)) * omega
}

/** Pitman angle to the knife line, rad. */
export function pitmanAngle(p: Pitman, theta: number) {
  return asin((p.r * sin(theta) - (p.e ?? 0)) / p.l)
}

/** Mean knife speed, m/s: two strokes per crank revolution, v̄ = 2·S·N/60. */
export const meanKnifeSpeed = (stroke: number, crankRpm: number) => (2 * stroke * crankRpm) / 60

/** Peak knife speed ≈ ω·r for a long pitman, m/s. */
export const peakKnifeSpeed = (r: number, crankRpm: number) => ((2 * PI * crankRpm) / 60) * r

/** Forward travel during one knife stroke (half a crank revolution), m: a = v·60/(2N). */
export const advancePerStroke = (v: number, crankRpm: number) => (v * 60) / (2 * crankRpm)

/** Ratio of mean knife speed to forward speed (dimensionless). */
export const knifeSpeedRatio = (stroke: number, crankRpm: number, v: number) => meanKnifeSpeed(stroke, crankRpm) / v

/**
 * Registration (§16.2.2): at each end of the stroke the centre of the knife section should sit
 * on the centre of a guard (ledger plate). Returns the error (m) at the inner and outer ends for a
 * section whose centre is `sectionOffset` from the first guard centre at inner dead centre.
 */
export function registrationError(p: Pitman, guardSpacing: number, sectionOffset = 0) {
  const S = knifeStroke(p)
  const near = (x: number) => {
    const k = Math.round(x / guardSpacing)
    return x - k * guardSpacing
  }
  return { inner: near(sectionOffset), outer: near(sectionOffset + S), stroke: S }
}

/** Alignment lead (§16.2.2): the outer end is set ahead by about 6 mm per metre of bar. Returns m. */
export const cutterBarLead = (barLength: number, mmPerM = 6) => (barLength * mmPerM) / 1000

/** Lead angle, rad, for a lead over the bar length. */
export const leadAngle = (barLength: number, lead: number) => Math.atan2(lead, barLength)

/** Effective field capacity, ha/h: C = W·S·FE/10 (AEE501 MGMT p8). */
export const mowerCapacity = (W: number, Skmh: number, FE = 1) => (W * Skmh * FE) / 10

/**
 * Path of a point on the knife relative to the ground over time, for drawing the cutting pattern:
 * ground x = v·t (travel), lateral y = knife displacement.
 */
export function sectionTrack(p: Pitman, crankRpm: number, v: number, t: number) {
  const theta = ((2 * PI * crankRpm) / 60) * t
  return { x: v * t, y: knifeDisplacement(p, theta) }
}

/**
 * Crank torque from a knife force F (N, opposing the knife motion) at crank angle θ (virtual
 * work: T·ω = F·v), N·m. Beyond notes.
 */
export function crankTorque(p: Pitman, theta: number, F: number) {
  const v1 = knifeVelocity(p, theta, 1)
  return Math.abs(F * v1)
}

/** Knife inertia force at crank angle θ, N (mass m, ω rad/s): F = m·ẍ (numerical). */
export function knifeInertiaForce(p: Pitman, m: number, theta: number, omega: number) {
  const d = 1e-4
  const a = ((knifePosition(p, theta + d) - 2 * knifePosition(p, theta) + knifePosition(p, theta - d)) / (d * d)) * omega * omega
  return m * a
}

/* ------------------------------ hay drying ------------------------------ */

/**
 * Hay drying on a wet basis: cut at m1 (about 80 %) and stored at m2 (about 20 %) (§16.2.2).
 * Dry matter is unchanged: M·(1 − m1) = M2·(1 − m2).
 */
export function hayDrying(freshMass: number, m1 = 0.8, m2 = 0.2) {
  const dm = freshMass * (1 - m1)
  const hay = dm / (1 - m2)
  return { dryMatter: dm, hay, water: freshMass - hay }
}

/* ------------------------------ baler ------------------------------ */

export interface BaleSize {
  /** chamber width × height (cross-section) and bale length, m */
  w: number
  h: number
  L: number
}

/** The notes' rectangular bale: about 35 × 45 × 90 cm (§16.2.3). */
export const NOTES_BALE: BaleSize = { w: 0.35, h: 0.45, L: 0.9 }

export const baleVolume = (b: BaleSize) => b.w * b.h * b.L
export const baleDensity = (mass: number, b: BaleSize) => mass / baleVolume(b)
export const baleMass = (density: number, b: BaleSize) => density * baleVolume(b)

/** Crop fed into the baler, kg/s: windrow linear density (kg/m) × forward speed (m/s). */
export const balerFeed = (windrowKgPerM: number, v: number) => windrowKgPerM * v

/**
 * Thickness of each compressed slice ("wad") added by one ram stroke, m:
 * t = ṁ / (strokes/s · ρ_bale · A_chamber).
 */
export const sliceThickness = (feedKgS: number, ramSpm: number, density: number, b: BaleSize) => feedKgS / ((ramSpm / 60) * density * b.w * b.h)

/** Ram strokes per bale (the knotter trips after this many). */
export const strokesPerBale = (b: BaleSize, slice: number) => b.L / slice

/** Bales per hour at a feed rate (kg/s) and bale mass (kg). */
export const balesPerHour = (feedKgS: number, mass: number) => (feedKgS * 3600) / mass

/** Pick-up tine tip speed, m/s, and its ratio to forward speed (should exceed 1 to lift the windrow cleanly; beyond notes). */
export function pickupRatio(reelRpm: number, tipRadius: number, v: number) {
  const tip = ((2 * PI * reelRpm) / 60) * tipRadius
  return { tip, ratio: tip / v }
}

/** Ram (plunger) position for a slider-crank of radius r and rod l at crank angle θ, from its forward dead centre, m. */
export function ramStroke(r: number, l: number, theta: number) {
  const x = r * cos(theta) + sqrt(l * l - (r * sin(theta)) ** 2)
  return r + l - x
}
