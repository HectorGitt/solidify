import { create } from 'zustand'
import { SRC } from '@/content/citations'
import {
  beaterRpm,
  broadcastRate,
  discExit,
  discTipSpeed,
  landingPoint,
  manureRate,
  ratchetApronSpeed,
  spreadPattern,
  wheelRpm,
  type SpinnerSpec,
} from '@/physics/application'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'

export const C = {
  am: (w: string) => SRC.am502(w),
}

/* ------------------------------ layout ------------------------------ */

/** Lower-hitch height for the mounted broadcaster and the solved linkage at that height. */
export const HITCH_H = 0.55
export const LK = solveLinkage(phiForHitchHeight(HITCH_H))
export const HX = LK.L.x
export const HY = LK.L.y
/** PTO stub end in the hitch frame. */
export const PTO_LOCAL: [number, number, number] = [PTO_STUB_X - 0.06 - HX, PTO_Y - HY, 0]

/**
 * Spinning-disc broadcaster (hitch frame: origin at the lower hitch balls, −X rearward). The
 * notes give the parts (cone hopper, agitator, shutter/feed gate, PTO-driven disc) and the
 * 6–9 m spread width (§14.4.1); the sizes are typical (beyond notes).
 */
export const BC = {
  /** hopper axis x, base (outlet) y, top y, top and outlet radii */
  hx: -0.5,
  y0: 0.42,
  y1: 1.12,
  rTop: 0.55,
  rOut: 0.09,
  /** disc centre height above the hitch balls; vane tip radius and feed radius */
  discY: 0.24,
  R: 0.22,
  r0: 0.06,
  vanes: 4,
  /** gearbox input height under the hopper */
  gbY: 0.33,
}
/** Disc height above ground. */
export const DISC_H = HY + BC.discY
/** Typical granular fertilizer: 3 mm prills, 1400 kg/m³ (beyond notes). */
export const GRANULE = { d: 3e-3, rhoP: 1400 }
/** Gate flow at full opening, kg/s (typical, beyond notes; flow taken as ∝ opening). */
export const GATE_FULL = 0.8

/**
 * Apron-and-beater manure spreader, trailed (drawbar frame: origin at the pin). Box, apron,
 * beaters and auger follow §14.3.1 / Fig 14.2; sizes are typical (beyond notes).
 */
export const MS = {
  boxX0: -1.25,
  boxX1: -4.35,
  floorY: 0.28,
  b: 1.2,
  wallH: 0.85,
  axleX: -3.3,
  wheelR: 0.45,
  /** lower and upper beaters, spiral auger (x, y local) */
  lower: { x: -4.55, y: 0.48, r: 0.2 },
  upper: { x: -4.5, y: 0.98, r: 0.2 },
  auger: { x: -4.88, y: 0.36, r: 0.13 },
  /** ratchet wheel teeth and apron sprocket pitch diameter */
  ratchetTeeth: 40,
  sprocketD: 0.2,
  rho: 700,
  /** spread width behind the beaters, m */
  W: 4,
  /** full load, kg (box 3.1 × 1.2 × 0.8 m at 700 kg/m³) */
  load: 3.1 * 1.2 * 0.8 * 700,
  /** pawl strokes per minute from the PTO drive (540 rpm through a 15 : 1 reduction) */
  ptoStrokes: 36,
}
export const MS_LOAD_H = 0.8

/* ------------------------------ parameters ------------------------------ */

export type Machine = 'broadcaster' | 'manure'
export type ApronDrive = 'ground' | 'pto'

export interface SpreaderParams {
  machine: Machine
  /** forward speed, km/h */
  speed: number
  /** feed-gate opening, 0…1 */
  gate: number
  /** disc speed, rpm */
  discRpm: number
  /** bout (driving) width, m */
  bout: number
  agitator: boolean
  /** ratchet teeth advanced per pawl stroke (the rate lever) */
  teeth: number
  drive: ApronDrive
  /* calibration (§14.7) */
  calW: number
  calRefill: number
}

export const DEFAULTS: SpreaderParams = {
  machine: 'broadcaster',
  speed: 8,
  gate: 0.4,
  discRpm: 420,
  bout: 8,
  agitator: true,
  teeth: 2,
  drive: 'ground',
  calW: 8,
  calRefill: 6,
}

interface Store extends SpreaderParams {
  set: (p: Partial<SpreaderParams>) => void
  reset: () => void
}

export const useSpreader = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

/* ------------------------------ derived ------------------------------ */

export function spinner(p: Pick<SpreaderParams, 'discRpm'>): SpinnerSpec {
  return { rpm: p.discRpm, R: BC.R, r0: BC.r0, h: DISC_H, d: GRANULE.d, rhoP: GRANULE.rhoP, arc: [-1.4, 1.4] }
}

/** Width over which a single pass deposits granules (first and last bins above 5 % of the peak). */
export function swathWidth(zs: number[], ys: number[]) {
  const peak = Math.max(...ys)
  let a = 0
  let b = ys.length - 1
  while (a < ys.length && ys[a] < 0.05 * peak) a++
  while (b > 0 && ys[b] < 0.05 * peak) b--
  return b > a ? zs[b] - zs[a] : 0
}

/** Gate flow, kg/s: ∝ opening; without the agitator the fertilizer bridges and flow drops (beyond notes). */
export const gateFlow = (p: Pick<SpreaderParams, 'gate' | 'agitator'>) => GATE_FULL * p.gate * (p.agitator ? 1 : 0.7)

export function broadcaster(p: SpreaderParams) {
  const v = p.speed / 3.6
  const mdot = gateFlow(p)
  const rate = broadcastRate(mdot, p.bout, v)
  const spec = spinner(p)
  const omega = (2 * Math.PI * p.discRpm) / 60
  const exit = discExit(omega, BC.R, BC.r0)
  const tip = discTipSpeed(p.discRpm, BC.R)
  const reach = Math.max(...[-1.4, -0.7, 0, 0.7, 1.4].map((a) => Math.abs(landingPoint(spec, a).z)))
  const pat = spreadPattern(spec, 81, 8, 360)
  const width = swathWidth(pat.zs, pat.ys)
  return { v, mdot, rate, exit, tip, reach, width, pat }
}

export function manure(p: SpreaderParams) {
  const v = p.speed / 3.6
  const nW = wheelRpm(v, MS.wheelR)
  const strokes = p.drive === 'ground' ? nW : MS.ptoStrokes
  const u = ratchetApronSpeed(strokes, p.teeth, MS.ratchetTeeth, MS.sprocketD)
  const r = manureRate(MS.rho, MS.b, MS_LOAD_H, u, MS.W, v)
  const beater = beaterRpm(nW)
  return { v, nW, strokes, u, beater, ...r, emptyTime: MS.load / r.mdot, emptyDist: (MS.load / r.mdot) * v }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = {
  /** hopper contents 0…1 and manure load 0…1 */
  hopper: 1,
  load: 1,
  /** distance driven since the last refill */
  dist: 0,
}

export function resetLive() {
  live.hopper = 1
  live.load = 1
  live.dist = 0
}
