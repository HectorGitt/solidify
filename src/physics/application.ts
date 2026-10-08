/**
 * Chemical and fertilizer application: boom-sprayer calibration, nozzle flow, boom spray
 * distribution, spinning-disc broadcaster (granule flight, spread pattern, calibration) and the
 * apron-and-beater manure spreader. SI units unless a name says otherwise.
 *
 * Notes: AEE502 AGRICULTURAL MACHINERIES §14 (fertilizer equipment, §14.7 calibration) and §15
 * (sprayers, §15.6 nozzles, §15.8 performance, §15.12 calibration); 2018/19 marking guide Q4.
 * Functions marked "beyond notes" are standard textbook relations the notes only describe in words.
 */
import { applicationRate, boomCalibLength, dropletsPerCm2, nozzleFlow } from './implements'

const { PI, sqrt, cos, sin, atan2, hypot, log } = Math
export const G = 9.81

export { applicationRate, boomCalibLength, dropletsPerCm2, nozzleFlow }

/* ------------------------------ calibration (both machines) ------------------------------ */

/** Effective boom width W = number of nozzles × nozzle spacing (§15.12 step 3). */
export const boomWidth = (nozzles: number, spacing: number) => nozzles * spacing

/** Run length to cover a test area A (ha) with working width W (m): L = 10 000·A/W, m. */
export const testRunLength = (W: number, areaHa: number) => (10000 * areaHa) / W

/** Rate per hectare from the quantity used on a test area: (quantity)/A, i.e. ×10 for 0.1 ha, ×25 for 0.04 ha. */
export const ratePerHa = (quantity: number, areaHa: number) => quantity / areaHa

/** Spinner test run for 0.04 ha (400 m²): L = 400/W (§14.7). */
export const spinnerCalibLength = (W: number) => 400 / W

/** Spinner: refill mass for the 0.04 ha run × 25 = kg/ha (§14.7). */
export const spinnerRateFromRefill = (refillKg: number) => refillKg * 25

/** Boom sprayer: litres used on the 0.1 ha run × 10 = L/ha (§15.12). */
export const sprayerRateFromRefill = (refillL: number) => refillL * 10

/* ------------------------------ nozzles and the spray circuit ------------------------------ */

/**
 * Flow through an orifice, m³/s: Q = Cd·A·√(2Δp/ρ). This is why nozzle flow ∝ √pressure
 * (§15.6.1). Beyond notes as a formula.
 */
export function orificeFlow(diameter: number, dp: number, Cd = 0.62, rho = 1000) {
  return Cd * (PI / 4) * diameter * diameter * sqrt((2 * Math.max(0, dp)) / rho)
}

/** Orifice diameter (m) giving flow Q (m³/s) at Δp — the inverse of orificeFlow. */
export function orificeForFlow(Q: number, dp: number, Cd = 0.62, rho = 1000) {
  return sqrt(Q / (Cd * (PI / 4) * sqrt((2 * dp) / rho)))
}

/** Jet speed at the orifice, m/s: v = Cv·√(2Δp/ρ) (beyond notes). */
export const jetSpeed = (dp: number, rho = 1000, Cv = 0.95) => Cv * sqrt((2 * Math.max(0, dp)) / rho)

/**
 * Per-nozzle flow (L/min) needed for a rate (L/ha) at speed S (km/h) and nozzle spacing w (m):
 * q = rate·S·w/600 (beyond notes; the inverse of applicationRate for one nozzle).
 */
export const nozzleFlowForRate = (rateLha: number, Skmh: number, spacing: number) => (rateLha * Skmh * spacing) / 600

/** Speed (km/h) that gives a target rate with total flow Q (L/min) over width W (m). */
export const speedForRate = (rateLha: number, Qlmin: number, W: number) => (600 * Qlmin) / (W * rateLha)

/**
 * Relief-valve (pressure regulator) bypass: a positive-displacement pump delivers Qp whatever the
 * nozzles take; the excess returns to the tank (and agitates it). §15.6.2.
 */
export const reliefBypass = (pumpLmin: number, nozzlesLmin: number) => Math.max(0, pumpLmin - nozzlesLmin)

/**
 * Regulator setting: with nozzle coefficient K (L/min per √bar, q = K√p) and n open nozzles the
 * line pressure that the nozzles alone would pass the whole pump flow at is (Qp/(nK))²; the relief
 * valve caps it at its set pressure. Returns the operating pressure (bar).
 */
export function linePressure(pumpLmin: number, K: number, nOpen: number, setBar: number) {
  if (nOpen <= 0 || K <= 0) return setBar
  const pFree = (pumpLmin / (nOpen * K)) ** 2
  return Math.min(setBar, pFree)
}

/** Nozzle coefficient K = q/√p from a catalogue point (q at p). */
export const nozzleK = (qLmin: number, pBar: number) => qLmin / sqrt(pBar)

/** Area (ha) and travel (m) one tankful covers at a rate (L/ha) and width W. */
export function tankCoverage(tankL: number, rateLha: number, W: number) {
  const ha = tankL / rateLha
  return { ha, distance: (ha * 10000) / W }
}

/** Litres per hectare needed to give N droplets/cm² of diameter d (m) — inverse of dropletsPerCm2. */
export const rateForDropletDensity = (N: number, d: number) => (N * 1e8 * (PI / 6) * d ** 3) / 1e-3

/** Work rate of a walked ULV / CDA sprayer, ha/h, for walking speed (km/h) and swath (m). */
export const ulvRateKmh = (Skmh: number, swath: number) => (Skmh * swath) / 10

/* ------------------------------ spray distribution under the boom ------------------------------ */

export type NozzleKind = 'flat-fan' | 'hollow-cone'

/**
 * Ground deposit across one nozzle, relative units per metre, at lateral offset x from the nozzle
 * (m), boom height h (m) and spray angle θ (rad). Flat fan: tapered (near-triangular) edge so
 * neighbours overlap; hollow cone (seen as a line across the swath): an annulus — little at the
 * centre, peaks near the edge (§15.6.1, Fig 15.7). Shapes are idealised (beyond notes); each
 * integrates to 1.
 */
export function nozzlePattern(kind: NozzleKind, x: number, h: number, angle: number) {
  const half = h * Math.tan(angle / 2)
  const u = Math.abs(x) / half
  if (u >= 1) return 0
  if (kind === 'flat-fan') {
    // tapered-edge fan: raised-cosine profile, integral = half
    return (1 + cos(PI * u)) / (2 * half)
  }
  // hollow cone sampled along a line through its centre: chord density of a ring (inner radius 0.55)
  const ri = 0.55
  const chord = (r: number) => (u < r ? sqrt(r * r - u * u) : 0)
  const area = (PI * (1 - ri * ri)) / 2 // ∫ (chord(1) − chord(ri)) du over −1…1 = π(1 − ri²)/2
  return (chord(1) - chord(ri)) / (area * half)
}

/** Summed deposit across a boom of n nozzles at spacing s; returns x samples and deposit (L/m² per L/min/m units: relative). */
export function boomDistribution(kind: NozzleKind, n: number, s: number, h: number, angle: number, samples = 241) {
  const W = n * s
  const xs: number[] = []
  const ys: number[] = []
  const x0 = -W / 2 - h * Math.tan(angle / 2)
  const x1 = -x0
  for (let i = 0; i < samples; i++) {
    const x = x0 + ((x1 - x0) * i) / (samples - 1)
    let d = 0
    for (let k = 0; k < n; k++) d += nozzlePattern(kind, x - (-W / 2 + s / 2 + k * s), h, angle)
    xs.push(x)
    ys.push(d * s) // normalised so a perfect overlap = 1
  }
  return { xs, ys }
}

/** Coefficient of variation of a deposit profile over |x| ≤ limit (fraction; beyond notes). */
export function coefficientOfVariation(xs: number[], ys: number[], limit = Infinity) {
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let i = 0; i < xs.length; i++) {
    if (Math.abs(xs[i]) > limit) continue
    sum += ys[i]
    sum2 += ys[i] * ys[i]
    n++
  }
  if (n < 2) return 0
  const mean = sum / n
  const v = Math.max(0, sum2 / n - mean * mean)
  return mean > 0 ? sqrt(v) / mean : 0
}

/** CV across the central (fully overlapped) part of the boom: one nozzle spacing in from each end. */
export function boomCV(kind: NozzleKind, n: number, s: number, h: number, angle: number) {
  const { xs, ys } = boomDistribution(kind, n, s, h, angle)
  return coefficientOfVariation(xs, ys, (n * s) / 2 - s)
}

/* ------------------------------ spinning-disc broadcaster ------------------------------ */

/**
 * Granule leaving a frictionless radial vane on a disc spinning at ω (rad/s), fed at radius r0,
 * vane tip radius R (beyond notes): radial speed ω√(R² − r0²), tangential ωR.
 */
export function discExit(omega: number, R: number, r0: number) {
  const vr = omega * sqrt(Math.max(0, R * R - r0 * r0))
  const vt = omega * R
  return { vr, vt, v: hypot(vr, vt), /** angle of the exit velocity ahead of the radius line */ beta: atan2(vt, vr) }
}

/** Drag constant k (1/m) of a sphere: a_drag = k·v², k = 3·Cd·ρair/(4·ρp·d) (beyond notes). */
export const dragK = (d: number, rhoP: number, Cd = 0.44, rhoAir = 1.2) => (3 * Cd * rhoAir) / (4 * rhoP * d)

export interface Flight {
  /** horizontal distance travelled before reaching the ground, m */
  range: number
  time: number
  /** horizontal speed at landing, m/s */
  vLand: number
}

/**
 * Flight of a granule launched horizontally at v0 from height h with quadratic drag k
 * (numerical, RK2). With k = 0 this is the drag-free range v0·√(2h/g).
 */
export function granuleFlight(v0: number, h: number, k: number, dt = 1e-4): Flight {
  let x = 0
  let y = h
  let vx = v0
  let vy = 0
  let t = 0
  const acc = (ux: number, uy: number) => {
    const s = hypot(ux, uy)
    return [-k * s * ux, -G - k * s * uy] as const
  }
  while (y > 0 && t < 20) {
    const [ax1, ay1] = acc(vx, vy)
    const mx = vx + ax1 * dt * 0.5
    const my = vy + ay1 * dt * 0.5
    const [ax2, ay2] = acc(mx, my)
    const nx = x + mx * dt
    const ny = y + my * dt
    if (ny <= 0) {
      const f = y / (y - ny)
      x += mx * dt * f
      t += dt * f
      y = 0
      break
    }
    x = nx
    y = ny
    vx += ax2 * dt
    vy += ay2 * dt
    t += dt
  }
  return { range: x, time: t, vLand: vx }
}

/** Horizontal-only drag range (closed form, ignores vertical drag): x = ln(1 + k·v0·t)/k with t = √(2h/g). */
export function granuleRangeApprox(v0: number, h: number, k: number) {
  const t = sqrt((2 * h) / G)
  return k > 0 ? log(1 + k * v0 * t) / k : v0 * t
}

export interface SpinnerSpec {
  /** disc speed, rpm */
  rpm: number
  /** vane tip radius, m */
  R: number
  /** feed radius where granules land on the disc, m */
  r0: number
  /** disc height above ground, m */
  h: number
  /** granule diameter m, particle density kg/m³ */
  d: number
  rhoP: number
  /**
   * delivery arc: disc angles (rad, measured from straight back, positive towards +z, the
   * tractor's left) over which granules leave the vanes. The feed-gate position sets it.
   */
  arc: [number, number]
}

/** Landing point (x back from the disc centre is negative x; z lateral) of a granule leaving at disc angle ψ. */
export function landingPoint(s: SpinnerSpec, psi: number, spinSign = 1) {
  const omega = (2 * PI * s.rpm) / 60
  const ex = discExit(omega, s.R, s.r0)
  const k = dragK(s.d, s.rhoP)
  const f = granuleFlight(ex.v, s.h, k, 2e-4)
  // exit point on the rim: ψ = 0 straight back (−x)
  const px = -s.R * cos(psi)
  const pz = s.R * sin(psi)
  // radial unit and tangential unit (direction of disc rotation)
  const rx = -cos(psi)
  const rz = sin(psi)
  const tx = spinSign * -rz
  const tz = spinSign * rx
  const vx = ex.vr * rx + ex.vt * tx
  const vz = ex.vr * rz + ex.vt * tz
  const vh = hypot(vx, vz)
  return { x: px + (f.range * vx) / vh, z: pz + (f.range * vz) / vh, flight: f, exit: ex, dir: [vx / vh, vz / vh] as [number, number] }
}

/**
 * Lateral spread pattern of a single disc (kg per metre of width, per kg delivered), sampled on
 * bins across z, granules leaving uniformly over the delivery arc. Beyond notes (the notes give the
 * 6–9 m width and the factors that set the rate).
 */
export function spreadPattern(s: SpinnerSpec, bins = 81, halfWidth = 8, rays = 720, spinSign = 1) {
  const dz = (2 * halfWidth) / (bins - 1)
  const zs = Array.from({ length: bins }, (_, i) => -halfWidth + i * dz)
  const ys = new Array(bins).fill(0)
  const omega = (2 * PI * s.rpm) / 60
  const ex = discExit(omega, s.R, s.r0)
  const f = granuleFlight(ex.v, s.h, dragK(s.d, s.rhoP), 2e-4)
  // ranges vary slightly across real granules: spread each ray over ±12 % of the range
  const spreadN = 9
  for (let i = 0; i < rays; i++) {
    const psi = s.arc[0] + ((s.arc[1] - s.arc[0]) * (i + 0.5)) / rays
    const rx = -cos(psi)
    const rz = sin(psi)
    const tz = spinSign * rx
    const vz = ex.vr * rz + ex.vt * tz
    const vx = ex.vr * rx + ex.vt * (spinSign * -rz)
    const vh = hypot(vx, vz)
    for (let j = 0; j < spreadN; j++) {
      const rr = f.range * (0.88 + (0.24 * (j + 0.5)) / spreadN)
      const z = s.R * rz + (rr * vz) / vh
      const b = Math.round((z + halfWidth) / dz)
      if (b >= 0 && b < bins) ys[b] += 1 / (rays * spreadN * dz)
    }
  }
  return { zs, ys }
}

/** Overlap a single-pass pattern at bout (driving) width B, back-and-forth: deposit across one bout. */
export function overlapPattern(zs: number[], ys: number[], B: number) {
  const dz = zs[1] - zs[0]
  const n = Math.max(2, Math.round(B / dz))
  const out = { zs: [] as number[], ys: [] as number[] }
  const at = (z: number) => {
    const i = (z - zs[0]) / dz
    const i0 = Math.floor(i)
    if (i0 < 0 || i0 >= zs.length - 1) return 0
    const u = i - i0
    return ys[i0] * (1 - u) + ys[i0 + 1] * u
  }
  for (let i = 0; i <= n; i++) {
    const z = -B / 2 + (B * i) / n
    let d = 0
    for (let k = -6; k <= 6; k++) {
      // alternate passes are driven in the opposite direction: mirror the pattern
      const zz = z - k * B
      d += k % 2 === 0 ? at(zz) : at(-zz)
    }
    out.zs.push(z)
    out.ys.push(d * B)
  }
  return out
}

/** Broadcaster rate, kg/ha, for gate flow ṁ (kg/s), bout width B (m) and speed v (m/s): 10 000·ṁ/(B·v). */
export const broadcastRate = (mdot: number, B: number, v: number) => (10000 * mdot) / (B * v)

/** Gate flow (kg/s) needed for a target rate (kg/ha). */
export const gateFlowForRate = (rateKgHa: number, B: number, v: number) => (rateKgHa * B * v) / 10000

/* ------------------------------ apron-and-beater manure spreader ------------------------------ */

/**
 * Apron feed: ṁ = ρ·b·H·u (kg/s) for load density ρ, box width b, load height H and apron
 * speed u; rate = 10 000·ṁ/(W·v) kg/ha over spread width W at forward speed v. The notes:
 * "the speed of the conveyor apron determines the volume of manure distributed" (§14.3.1).
 */
export function manureRate(rho: number, b: number, H: number, u: number, W: number, v: number) {
  const mdot = rho * b * H * u
  return { mdot, kgHa: (10000 * mdot) / (W * v), tHa: mdot / (W * v) * 10 }
}

/** Apron speed for a target rate (kg/ha). */
export const apronSpeedForRate = (kgHa: number, rho: number, b: number, H: number, W: number, v: number) => (kgHa * W * v) / (10000 * rho * b * H)

/**
 * Ratchet-and-pawl apron drive (§14.3.1, Fig 14.2): each pawl stroke advances the ratchet by
 * `teethPerStroke` of its `ratchetTeeth`; the apron sprocket (pitch diameter D) turns with it.
 * Apron speed u = (strokes/s)·(teethPerStroke/ratchetTeeth)·π·D.
 */
export const ratchetApronSpeed = (strokesPerMin: number, teethPerStroke: number, ratchetTeeth: number, D: number) =>
  (strokesPerMin / 60) * (teethPerStroke / ratchetTeeth) * PI * D

/** Lower beater speed: 6–7 times the wheel speed, opposite sense (§14.3.1). */
export const beaterRpm = (wheelRpm: number, ratio = 6.5) => wheelRpm * ratio

/** Spreader wheel speed, rpm, at forward speed v (m/s) on wheels of rolling radius r. */
export const wheelRpm = (v: number, r: number) => (v / (2 * PI * r)) * 60

/** Time (s) and distance (m) to empty a load of mass M at feed ṁ and speed v. */
export const emptyingRun = (M: number, mdot: number, v: number) => ({ time: M / mdot, distance: (M / mdot) * v })

/** Granule-type broadcaster quick checks used in tests: drag-free range for comparison. */
export const dragFreeRange = (v0: number, h: number) => v0 * sqrt((2 * h) / G)

/** Convenience: tangential disc speed ωR (m/s). */
export const discTipSpeed = (rpm: number, R: number) => ((2 * PI * rpm) / 60) * R
