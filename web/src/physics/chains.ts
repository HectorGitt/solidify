/**
 * Roller chain drives — AEE503 Module 3 (selection from the Fenner chain chart).
 * The notes are catalogue-only; the sprocket geometry, chain speed, length and chordal
 * (polygon) action below are standard results added so the motion makes sense.
 * SI units: m, rad, rev/min, W.
 */

const { PI, cos, sin } = Math

/** Standard roller-chain pitches (m). */
export const PITCH = {
  '1/2': 0.0127,
  '5/8': 0.015875,
  '3/4': 0.01905,
  '1': 0.0254,
} as const
export type PitchKey = keyof typeof PITCH

/** Design power = service factor × rated power (M3). */
export function designPower(rated: number, serviceFactor: number) {
  return rated * serviceFactor
}

/** Speed ratio N₁/N₂ (M3). */
export function speedRatio(n1: number, n2: number) {
  return n1 / n2
}

/** Driven speed from tooth numbers: N₂ = N₁·z₁/z₂ (driver z₁). */
export function drivenSpeed(n1: number, z1: number, z2: number) {
  return (n1 * z1) / z2
}

/** Multi-strand factor: duplex = 1.7 × simplex (M3, MG17). Triplex 2.5 is a catalogue value beyond the notes. */
export const STRAND_FACTOR: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.7, 3: 2.5 }

/** Rated power of an n-strand chain from the simplex rating. */
export function strandRating(simplex: number, strands: 1 | 2 | 3) {
  return simplex * STRAND_FACTOR[strands]
}

/**
 * Selection rule used in the notes: if the simplex rating is less than the design power,
 * try duplex (× 1.7). Returns the fewest strands (1 or 2) that carry the design power, or null.
 */
export function strandsNeeded(design: number, simplex: number): 1 | 2 | null {
  if (simplex >= design) return 1
  if (strandRating(simplex, 2) >= design) return 2
  return null
}

/** Sprocket pitch-circle diameter D = p / sin(π/z) (beyond notes). */
export function pitchDiameter(z: number, p: number) {
  return p / sin(PI / z)
}

/** Average chain speed v = z·p·N/60 (m/s) (beyond notes). */
export function chainSpeed(z: number, p: number, rpm: number) {
  return (z * p * rpm) / 60
}

/**
 * Chordal (polygon) action (beyond notes). As a sprocket turns through one tooth angle 2π/z,
 * the engaged link swings from −π/z to +π/z about the line of the chain, so the chain speed is
 * v = ωR cos φ: maximum ωR, minimum ωR cos(π/z).
 */
export function chordalSpeed(omega: number, z: number, p: number, phi: number) {
  return omega * (pitchDiameter(z, p) / 2) * cos(phi)
}

/** Fractional speed variation (v_max − v_min)/v_max = 1 − cos(π/z). */
export function chordalVariation(z: number) {
  return 1 - cos(PI / z)
}

/** Rise and fall of the chain line per tooth: R(1 − cos(π/z)). */
export function chordalRise(z: number, p: number) {
  return (pitchDiameter(z, p) / 2) * (1 - cos(PI / z))
}

/** Chain length in pitches (beyond notes): Lp = 2C/p + (z₁ + z₂)/2 + ((z₂ − z₁)/2π)²·p/C. */
export function chainLengthPitches(C: number, p: number, z1: number, z2: number) {
  return (2 * C) / p + (z1 + z2) / 2 + ((z2 - z1) / (2 * PI)) ** 2 * (p / C)
}

/** Centre distance for a whole (even) number of links — inverse of chainLengthPitches (beyond notes). */
export function centreForLinks(links: number, p: number, z1: number, z2: number) {
  const A = links - (z1 + z2) / 2
  const B = ((z2 - z1) / (2 * PI)) ** 2
  return (p / 4) * (A + Math.sqrt(Math.max(0, A * A - 8 * B)))
}
