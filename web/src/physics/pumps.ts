/**
 * Positive-displacement pump geometry → displacement (standard texts; the notes name the gear
 * and vane pumps and give D, Q_T = D·N/1000 etc. but no displacement-from-geometry formulas).
 * Inputs in metres, displacement out in cm³/rev.
 */

const { PI, cos, sqrt, abs } = Math

export interface GearPumpGeometry {
  /** module, m */
  module: number
  /** teeth per gear (two identical gears) */
  teeth: number
  /** face width, m */
  width: number
  pressureAngleDeg?: number
}

/** Pitch, tip and base radii and base pitch of the pump gears (standard full-depth teeth). */
export function gearRadii(g: GearPumpGeometry) {
  const r = (g.module * g.teeth) / 2
  const ra = r + g.module
  const rf = r - 1.25 * g.module
  const alpha = ((g.pressureAngleDeg ?? 20) * PI) / 180
  const rb = r * cos(alpha)
  const pb = PI * g.module * cos(alpha)
  return { r, ra, rf, rb, pb, centre: 2 * r }
}

/**
 * External gear pump, two identical gears at standard centre distance, no backlash:
 * V = 2π·b·(r_a² − r² − p_b²/12). The tooth spaces carry oil round the outside of both gears;
 * the meshing teeth push out all but the volume still trapped in the mesh. The p_b²/12 term is
 * the mean of u², u being the distance of the contact point from the pitch point.
 */
export function gearPumpDisplacementExact(g: GearPumpGeometry) {
  const { r, ra, pb } = gearRadii(g)
  return 2 * PI * g.width * (ra * ra - r * r - (pb * pb) / 12) * 1e6
}

/**
 * Instantaneous delivery of the gear pump as a fraction of its mean, at drive-gear angle φ.
 * The contact point moves along the line of action at r_b·ω, so u = r_b·φ′ with
 * φ′ ∈ [−π/z, π/z) in each tooth period: q = ω·b·(r_a² − r² − u²).
 */
export function gearPumpRipple(g: GearPumpGeometry, phi: number) {
  const { r, ra, rb, pb } = gearRadii(g)
  const period = (2 * PI) / g.teeth
  const p = ((phi % period) + period) % period - period / 2
  const u = rb * p
  const mean = ra * ra - r * r - (pb * pb) / 12
  return (ra * ra - r * r - u * u) / mean
}

export interface VanePumpGeometry {
  /** cam-ring bore radius R, m */
  ringR: number
  /** rotor radius r, m */
  rotorR: number
  /** eccentricity e (ring centre offset from the rotor centre), m; ≤ R − r */
  ecc: number
  /** axial width L, m */
  width: number
  vanes: number
  /** vane thickness t, m (0 = thin vanes) */
  vaneT?: number
}

/** Vane-tip radius from the rotor centre in direction φ (φ = 0 towards the ring offset). */
export function vaneTipRadius(R: number, e: number, phi: number) {
  const s = Math.sin(phi)
  return e * cos(phi) + sqrt(R * R - e * e * s * s)
}

/**
 * Unbalanced vane pump displacement, closed form for thin vanes: each chamber fills once and
 * empties once per revolution, so V = π·L·(ρ_max² − ρ_min²) = 4π·R·e·L (= 2π·D·e·L). Vanes of
 * thickness t displace 2e·t·L each per revolution: V = 2e·L·(2πR − n·t).
 */
export function vanePumpDisplacementExact(v: VanePumpGeometry) {
  return 2 * v.ecc * v.width * (2 * PI * v.ringR - v.vanes * (v.vaneT ?? 0)) * 1e6
}

/** Volume of the chamber whose centre line is at angle c (thin vanes), m³ — Simpson's rule. */
export function vaneChamberVolume(v: VanePumpGeometry, c: number, steps = 64) {
  const h = (2 * PI) / v.vanes
  const a = c - h / 2
  let s = 0
  for (let i = 0; i <= steps; i++) {
    const phi = a + (h * i) / steps
    const rho = vaneTipRadius(v.ringR, v.ecc, phi)
    const f = 0.5 * (rho * rho - v.rotorR * v.rotorR)
    s += f * (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2)
  }
  return ((s * h) / (3 * steps)) * v.width
}

/** Numerical displacement n·(V_max − V_min) for a finite number of thin vanes, cm³/rev. */
export function vanePumpDisplacementNumeric(v: VanePumpGeometry) {
  const vmax = vaneChamberVolume(v, 0)
  const vmin = vaneChamberVolume(v, PI)
  return v.vanes * abs(vmax - vmin) * 1e6
}
