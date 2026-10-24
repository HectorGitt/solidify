import { bevelPair } from '@/geometry/parts'
import { gearTable, ratioCount, type TableRow } from '@/physics/gearing'

/**
 * Sixteen-speed tractor gearbox after Culpin Fig A2.6 (Massey-Ferguson 2000 range, TOP p3–4):
 * speed-shift epicyclic → shuttle (forward / reverse free gears + sliding coupler) → mainshaft
 * with four synchromesh constant-mesh helical gears → hollow layshaft (the PTO drive shaft runs
 * through it) → sliding range gear on the output shaft → bevel pinion; transfer gear and 4WD
 * clutch to the front-axle drive shaft; parking brake. 2 × 4 × 2 = 16 forward.
 *
 * EVERY TOOTH NUMBER IS BEYOND THE NOTES — chosen to give 1.6–32 km/h at 2000 rpm on 14.9-28
 * rear tyres (rolling radius 0.635 m) through a 47:11 crown wheel and a 4.8:1 final drive.
 * Frame: metres, shafts along Z (front of the tractor at −Z), top line y = 0 (input, speed-shift,
 * shuttle sleeve, layshaft, PTO shaft), bottom line y = −C (mainshaft, output shaft).
 */
export const M = 0.005
export const SIGMA = 60
export const C = (M * SIGMA) / 2
export const BOT = -C
export const GW = 0.026

/** Speed-shift epicyclic (module 3 mm): sun = input, carrier = output, ring held = low; sun–carrier clutch = high. */
export const SS = { zs: 45, zp: 12, zr: 69, m: 0.003, n: 3, w: 0.03, z: 0.07 }

export const Z = {
  fwd: 28,
  cm: 32,
  rev: 23,
  idler: 20,
  /** mainshaft (free) / layshaft (fixed) pairs for gears 1–4 */
  m: [23, 26, 30, 34],
  l: [37, 34, 30, 26],
  lh: 33,
  oh: 27,
  ll: 15,
  ol: 45,
  t1: 31,
  t2: 29,
  pinion: 11,
  crown: 47,
}

/** Axial stations (z of gear centres). Fig A2.6 order on the layshaft: 2nd, 1st, 4th, 3rd, high range, low range. */
export const ST = {
  rev: 0.135,
  coupler: 0.17,
  fwd: 0.205,
  cmZ0: 0.118,
  cmZ1: 0.222,
  g: [0.38, 0.3, 0.53, 0.45] as number[], // gear 1..4
  hub12: 0.34,
  hub34: 0.49,
  rangeH: 0.62,
  slide: { d: 0.025, s: 0.035 },
  transfer: 0.83,
  brake: 0.865,
  pinionLarge: 0.885,
  layZ0: 0.255,
  layZ1: 0.775,
  mainZ0: 0.1,
  mainZ1: 0.575,
  outZ1: 0.885,
}
export const RANGE_L = ST.rangeH + 2 * ST.slide.d + 2 * ST.slide.s
export const FRONT_Y = BOT - (M * (Z.t1 + Z.t2)) / 2

export type SpeedShift = 'L' | 'H'
export type Shuttle = 'F' | 'N' | 'R'
export type GearNo = 1 | 2 | 3 | 4 | 0
export type RangeSel = 'H' | 'L' | 'N'

export const ssRatio = (s: SpeedShift) => (s === 'H' ? 1 : SS.zs / (SS.zs + SS.zr))
export const shuttleRatio = (s: Exclude<Shuttle, 'N'>) => (s === 'F' ? -Z.fwd / Z.cm : Z.rev / Z.cm)
export const gearRatio = (g: Exclude<GearNo, 0>) => -Z.m[g - 1] / Z.l[g - 1]
export const rangeRatio = (r: Exclude<RangeSel, 'N'>) => (r === 'H' ? -Z.lh / Z.oh : -Z.ll / Z.ol)
export const CROWN = Z.crown / Z.pinion
export const FINAL = 4.8
export const FIXED = CROWN * FINAL
export const ROLLING_R = 0.635

/** ω_output/ω_input of the gearbox (0 / NaN in neutral). */
export function boxRatio(ss: SpeedShift, sh: Shuttle, g: GearNo, r: RangeSel) {
  if (sh === 'N' || g === 0 || r === 'N') return NaN
  return ssRatio(ss) * shuttleRatio(sh) * gearRatio(g) * rangeRatio(r)
}

export const FORWARD_SPEEDS = ratioCount(2, 4, 2)

/** The 16 forward combinations, slowest first; label = range·gear·speed-shift, e.g. "L3H". */
export function forwardTable(engineRpm: number): (TableRow & { key: string })[] {
  return gearTable(
    engineRpm,
    [
      (['L', 'H'] as const).map((r) => ({ label: r, ratio: rangeRatio(r) })),
      ([1, 2, 3, 4] as const).map((g) => ({ label: String(g), ratio: gearRatio(g) })),
      (['L', 'H'] as const).map((s) => ({ label: s, ratio: ssRatio(s) })),
      [{ label: 'F', ratio: shuttleRatio('F') }],
    ],
    FIXED,
    ROLLING_R,
  ).map((r) => ({ ...r, key: r.labels.slice(0, 3).join('') }))
}

/** Forward speed number 1…16 of a combination. */
export function speedNumber(ss: SpeedShift, g: Exclude<GearNo, 0>, r: Exclude<RangeSel, 'N'>) {
  return forwardTable(2000).findIndex((row) => row.key === `${r}${g}${ss}`) + 1
}

/** "Shuttle reverse in 12 speeds": reverse only in forward speeds 1–12 (TOP p3). */
export const reverseAllowed = (ss: SpeedShift, g: GearNo, r: RangeSel) => g === 0 || r === 'N' || speedNumber(ss, g, r) <= 12

/** Reverse idler centre (between the reverse gear on the top line and the constant-mesh gear below). */
export const IDLER = (() => {
  const d1 = (M * (Z.rev + Z.idler)) / 2
  const d2 = (M * (Z.idler + Z.cm)) / 2
  const y = (d2 * d2 - d1 * d1 - C * C) / (2 * C)
  return { x: Math.sqrt(d1 * d1 - y * y), y }
})()

export const BEVEL = (() => {
  const m = 0.0055
  const p = bevelPair(Z.pinion, Z.crown)
  const rp = (m * Z.pinion) / 2
  const rc = (m * Z.crown) / 2
  const g1 = (p.pinion * Math.PI) / 180
  const g2 = (p.gear * Math.PI) / 180
  const apexZ = ST.pinionLarge + rp / Math.tan(g1)
  return { m, angles: p, rp, rc, g1, g2, apexZ }
})()
