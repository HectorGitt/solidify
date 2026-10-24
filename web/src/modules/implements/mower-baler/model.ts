import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import {
  NOTES_BALE,
  advancePerStroke,
  baleMass,
  balerFeed,
  balesPerHour,
  cutterBarLead,
  hayDrying,
  knifeSpeedRatio,
  knifeStroke,
  meanKnifeSpeed,
  mowerCapacity,
  pickupRatio,
  registrationError,
  sliceThickness,
  strokesPerBale,
  type Pitman,
} from '@/physics/hay'
import { PTO_STUB_X, PTO_Y } from '@/tractor/geometry'
import { phiForHitchHeight, solveLinkage } from '@/tractor/linkage'

export const C = {
  am: (w: string) => SRC.am502(w),
  pto: (w: string) => SRC.pto502(w),
  mgmt: (w: string) => SRC.mgmt501(w),
  exam5: (w: string) => cite('AEE501', 'part 5 exam.docx', w),
}

/* ------------------------------ mower layout (world frame) ------------------------------ */

export const HITCH_H = 0.45
export const LK = solveLinkage(phiForHitchHeight(HITCH_H))
export const HX = LK.L.x
export const HY = LK.L.y
export const PTO_WORLD: [number, number, number] = [PTO_STUB_X - 0.06, PTO_Y, 0]

/**
 * Rear-mounted, side-cutting cutter-bar mower. The notes (§16.2.1–16.2.2) give the parts, the
 * PTO → crank → pitman drive and the 6 mm/m lead; sizes are standard 5 ft mower values (beyond
 * notes): 76.2 mm section and guard pitch, 76.2 mm stroke.
 */
export const MOWER = {
  /** bar line x (behind the rear axle), knife height, inner end z, bar length */
  x: -1.15,
  y: 0.045,
  zIn: -0.98,
  L: 1.524,
  pitch: 0.0762,
  /** crank (pitman wheel) centre: inboard of the bar, above the knife line */
  crankZ: -0.28,
  crankY: 0.16,
  /** jackshaft (PTO input) height, gear teeth input:output */
  jackY: 0.42,
  gearIn: 34,
  gearOut: 20,
}
/** Crank and pitman: r = stroke/2, pitman 0.72 m, crank 0.115 m above the knife line. */
export const PITMAN: Pitman = { r: 0.0381, l: 0.72, e: -(MOWER.crankY - MOWER.y) }

/* ------------------------------ baler layout (drawbar frame) ------------------------------ */

/**
 * PTO pick-up baler, trailed (drawbar frame: origin at the pin, +X forward). Parts follow
 * §16.2.3 (pick-up tines, auger, packer arms, chamber, ram with knife, knotter; bale about
 * 35 × 45 × 90 cm). Positions are typical (beyond notes).
 */
export const BALER = {
  /** chamber centre z, floor y, front (plunger) and rear x */
  cz: 0.15,
  floorY: 0.38,
  frontX: -2.2,
  rearX: -4.95,
  /** pick-up: x, z range, tine-tip radius */
  pickX: -2.6,
  pickZ: [-1.55, -0.45] as [number, number],
  pickR: 0.2,
  pickY: 0.22,
  /** cross auger */
  augerX: -2.95,
  augerY: 0.5,
  /** plunger: crank radius (stroke = 2r), connecting rod */
  crankR: 0.36,
  rodL: 1.05,
  /** knotter x */
  knotX: -3.65,
  wheelX: -3.2,
  wheelR: 0.36,
}
/** Forward dead centre of the plunger face. */
export const RAM_FDC = BALER.frontX - 0.15

/* ------------------------------ parameters ------------------------------ */

export type Mode = 'mower' | 'baler'

export interface HayParams {
  mode: Mode
  /** forward speed, km/h */
  speed: number
  /** PTO speed, rpm */
  pto: number
  /** knife-section offset from registration, mm */
  regOffset: number
  /** lead per metre of bar, mm/m; and show it exaggerated */
  leadPerM: number
  exaggerate: boolean
  /* baler */
  /** windrow mass per metre, kg/m */
  windrow: number
  /** ram strokes per minute */
  ramSpm: number
  /** bale density, kg/m³ */
  density: number
  /** bale length setting, m */
  baleL: number
  /* drying working */
  fresh: number
}

export const DEFAULTS: HayParams = {
  mode: 'mower',
  speed: 7,
  pto: 540,
  regOffset: 0,
  leadPerM: 6,
  exaggerate: true,
  windrow: 3,
  ramSpm: 80,
  density: 160,
  baleL: NOTES_BALE.L,
  fresh: 1000,
}

interface Store extends HayParams {
  set: (p: Partial<HayParams>) => void
  reset: () => void
}

export const useHay = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

/* ------------------------------ derived ------------------------------ */

export const crankRpmFor = (pto: number) => (pto * MOWER.gearIn) / MOWER.gearOut

export function mower(p: HayParams) {
  const v = p.speed / 3.6
  const N = crankRpmFor(p.pto)
  const S = knifeStroke(PITMAN)
  const reg = registrationError({ ...PITMAN }, MOWER.pitch, p.regOffset / 1000)
  return {
    v,
    N,
    S,
    vk: meanKnifeSpeed(S, N),
    adv: advancePerStroke(v, N),
    ratio: knifeSpeedRatio(S, N, v),
    lead: cutterBarLead(MOWER.L, p.leadPerM),
    cap: mowerCapacity(MOWER.L, p.speed),
    reg,
  }
}

export function baler(p: HayParams) {
  const v = p.speed / 3.6
  const bale = { ...NOTES_BALE, L: p.baleL }
  const feed = balerFeed(p.windrow, v)
  const slice = sliceThickness(feed, p.ramSpm, p.density, bale)
  const mass = baleMass(p.density, bale)
  const pick = pickupRatio(120, BALER.pickR, v)
  return { v, bale, feed, slice, strokes: strokesPerBale(bale, slice), mass, perHour: balesPerHour(feed, mass), pick }
}

export const drying = (p: HayParams) => hayDrying(p.fresh)

/* ------------------------------ live ------------------------------ */

export const live = {
  /** current bale length in the chamber, m */
  forming: 0,
  /** bales completed since entering */
  bales: 0,
  /** knotter cycle 0…1 (0 = idle) */
  knot: 0,
}

export function resetLive() {
  live.forming = 0
  live.bales = 0
  live.knot = 0
}
