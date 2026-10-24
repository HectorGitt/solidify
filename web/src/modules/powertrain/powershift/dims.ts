/**
 * Hydraulic-assist (powershift) countershaft unit — high-low-reverse with three clutches (PT p4–6).
 * Input and output shafts are coaxial (y = 0); the underdrive countershaft runs below (y = −C) and
 * the reverse countershaft (idler) beside it. Gears are in constant mesh; clutch packs choose the
 * path. Tooth numbers, module and clutch sizes are typical values (beyond notes).
 * Frame: metres, shafts along Z, input at the front (−Z).
 */
export const M = 0.0045
export const C = (M * 60) / 2
export const CS_Y = -C

export const Z = { a: 24, b: 36, c: 28, d: 32, e: 18, idler: 20, f: 36 }

export type Sel = 'H' | 'L' | 'R' | 'N'

/** Speed ratio ω_out/ω_in of each path. */
export const RATIO = {
  H: 1,
  L: (Z.a / Z.b) * (Z.c / Z.d),
  R: -(Z.a / Z.b) * (Z.e / Z.f),
}
/** speed reduction ω_in/ω_out (used by the shift model) */
export const REDUCTION = { H: 1, L: 1 / RATIO.L, R: 1 / RATIO.R }

export const ST = { a: 0.04, packH: 0.115, d: 0.2, packL: 0.26, packR: 0.345, f: 0.41, inEnd: 0.15, outZ0: 0.09, outZ1: 0.56 }

/** Clutch pack (all three alike): discs splined to the drum, plates to the hub (PT p4). */
export const PACK = {
  discs: 4,
  plates: 4,
  Ro: 0.078,
  Ri: 0.052,
  mu: 0.12,
  pistonIn: 0.03,
  pistonOut: 0.079,
  /** regulated control pressure, Pa (≈ 14 bar) and return-spring preload, N */
  pressure: 14e5,
  spring: 1200,
}
export const PISTON_AREA = Math.PI * (PACK.pistonOut ** 2 - PACK.pistonIn ** 2)

export const IDLER = (() => {
  const d1 = (M * (Z.e + Z.idler)) / 2 // countershaft → idler
  const d2 = (M * (Z.idler + Z.f)) / 2 // idler → output
  // output at (0,0), countershaft at (0, −C): intersection on the +X side
  const y = (d1 * d1 - d2 * d2 - C * C) / (2 * C)
  return { x: Math.sqrt(d2 * d2 - y * y), y }
})()
