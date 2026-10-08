import { bevelPair } from '@/geometry/parts'

/**
 * Two-lever tractor gearbox, 3 forward + reverse × high/low range = 6F/2R (TTS p4: "six or eight
 * forward and two reverse speeds, selected by two gear levers"). Tooth numbers are typical
 * (beyond notes). Shafts along Z: the top line carries the input (front) and the output shaft
 * (rear, spigoted into it); the bottom shaft runs under it. Spur gears: module 4.5 mm, every
 * top–bottom pair has 60 teeth so the centre distance is 135 mm.
 */
export const M = 0.0045
export const SIGMA = 60
export const C = (M * SIGMA) / 2
export const BOTTOM_Y = -C
export const GW = 0.028

export type Gear = '1' | '2' | '3' | 'R' | 'N'
export type Range = 'H' | 'L' | 'N'
export type Variant = 'sliding' | 'constant' | 'synchro'

export const Z = {
  t1: 15,
  b1: 45,
  t2: 22,
  b2: 38,
  t3: 29,
  b3: 31,
  tr: 14,
  idler: 20,
  br: 39,
  rhb: 30,
  rho: 30,
  rlb: 18,
  rlo: 42,
  pinion: 11,
  crown: 47,
}

/** Overall speed ratio ω_out/ω_in of each gear (top → bottom → output; reverse via the idler). */
export const GEAR_RATIO: Record<Exclude<Gear, 'N'>, number> = {
  '1': (Z.t1 / Z.b1) * -1,
  '2': (Z.t2 / Z.b2) * -1,
  '3': (Z.t3 / Z.b3) * -1,
  R: Z.tr / Z.br,
}
export const RANGE_RATIO: Record<Exclude<Range, 'N'>, number> = { H: -(Z.rhb / Z.rho), L: -(Z.rlb / Z.rlo) }
/** crown wheel and pinion × final reduction (epicyclic 4.8 : 1) */
export const CROWN = Z.crown / Z.pinion
export const FINAL = 4.8
export const ROLLING_R = 0.635

/** Sliding-mesh stations (bottom-gear centres) and the sliding pattern: d = half cluster spacing, s = shift. */
export const SLIDE = { d: 0.025, s: 0.035 }
export const SL = { b1: 0.05, b2: 0.17, b3: 0.22, br: 0.34 }
/** Constant-mesh / synchromesh stations: gear, dog ring, baulk ring, gap, hub. */
export const DOG_W = 0.006
export const BAULK_W = 0.008
export const HUB_W = 0.024
export const CM_SPACING = GW + 2 * (DOG_W + BAULK_W + 0.003) + HUB_W
export const CM = { t1: 0.05, t2: 0.05 + CM_SPACING, t3: 0.05 + CM_SPACING + 0.034, tr: 0.05 + 2 * CM_SPACING + 0.034 }
/** collar travel from neutral to fully engaged */
export const CM_TRAVEL = DOG_W + BAULK_W + 0.003
export const RANGE = { h: 0.4, l: 0.52 }
export const INPUT_END = 0.37
export const OUTPUT_END = 0.6

/** Reverse idler centre (circle–circle intersection; on the +X side). */
export const IDLER = (() => {
  const d1 = (M * (Z.tr + Z.idler)) / 2
  const d2 = (M * (Z.idler + Z.br)) / 2
  const y = (d1 * d1 - d2 * d2 + C * C) / (2 * -C) // from top (0,0) towards bottom (0,−C)
  const yy = -((d1 * d1 - d2 * d2 + C * C) / (2 * C))
  void y
  const x = Math.sqrt(d1 * d1 - yy * yy)
  return { x, y: yy }
})()

/** Bevel pinion (on the output shaft, axis +Z) and crown wheel (axis +X). */
export const BEVEL = (() => {
  const m = 0.006
  const p = bevelPair(Z.pinion, Z.crown)
  const rp = (m * Z.pinion) / 2
  const rc = (m * Z.crown) / 2
  const g1 = (p.pinion * Math.PI) / 180
  const g2 = (p.gear * Math.PI) / 180
  const pinionLarge = OUTPUT_END + 0.005
  const apexZ = pinionLarge + rp / Math.tan(g1)
  return { m, angles: p, rp, rc, g1, g2, apexZ, pinionLarge, crownPlaneX: -rc / Math.tan(g2) }
})()
