import { create } from 'zustand'
import {
  TYPICAL_DIESEL_TIMING,
  clearanceForRatio,
  pinHeight,
  pistonFromTDC,
  sweptVolume,
  valveLifts,
  volumeFraction,
  type SliderCrank,
} from '@/physics/engine'
import {
  AIR,
  airStandardCycle,
  alphaFromHeat,
  deltaFromHeat,
  dualFromHeatSplit,
  stateAtCrank,
  type CycleKind,
  type CycleResult,
  type Stroke,
} from '@/physics/thermo'

/**
 * Single-cylinder, naturally aspirated, direct-injection tractor diesel.
 * Bore × stroke 100 × 124 mm — the engine used in the AEE509 textbook example (p9).
 * Frame: Y up, crank axis = Z, origin at the crank centre, metres.
 */
export const DIM = {
  bore: 0.1,
  stroke: 0.124,
  crankR: 0.062,
  rodL: 0.215,
  /** gudgeon pin centre to piston crown */
  pistonComp: 0.062,
  /** gudgeon pin centre to bottom of skirt */
  pistonSkirt: 0.043,
  linerOuter: 0.056,
  jacketOuter: 0.064,
  /** valves sit in line along the crank axis */
  valveX: -0.008,
  inletZ: 0.024,
  exhaustZ: -0.024,
  inletHeadR: 0.02,
  exhaustHeadR: 0.0175,
  valveStemR: 0.0045,
  headHeight: 0.095,
  /** valve tip height above the head deck (valve closed) */
  valveTip: 0.138,
  /** rocker shaft position above the head deck */
  rockerY: 0.146,
  rockerX: -0.05,
  rockerArmValve: 0.042,
  rockerArmPush: 0.028,
  camBase: 0.016,
  timingModule: 0.0035,
  crankTeeth: 22,
  camTeeth: 44,
  tappetR: 0.011,
  tappetH: 0.032,
  frontGearZ: 0.098,
  flywheelZ: -0.112,
}

export const ROCKER_RATIO = DIM.rockerArmValve / DIM.rockerArmPush // 1.5
export const PUSHROD_X = DIM.rockerX - DIM.rockerArmPush // −0.078
export const CAM_X = PUSHROD_X
const C = (DIM.timingModule * (DIM.crankTeeth + DIM.camTeeth)) / 2
export const CAM_Y = Math.sqrt(C * C - CAM_X * CAM_X)

export const SC: SliderCrank = { r: DIM.crankR, l: DIM.rodL }
export const CROWN_TDC = DIM.crankR + DIM.rodL + DIM.pistonComp
export const AREA = (Math.PI / 4) * DIM.bore * DIM.bore
export const VS = sweptVolume(DIM.bore, DIM.stroke)

/** Re-entrant combustion bowl in the piston crown, (r, depth-below-crown). */
export const BOWL: [number, number][] = [
  [0, 0],
  [0.025, 0],
  [0.0278, 0.009],
  [0.022, 0.016],
  [0.01, 0.016],
  [0, 0.01],
]

/** Volume of a closed (r, y) profile revolved about the axis (signed frustum sum). */
export function revolvedVolume(profile: [number, number][]) {
  let v = 0
  for (let i = 0; i < profile.length; i++) {
    const [r1, y1] = profile[i]
    const [r2, y2] = profile[(i + 1) % profile.length]
    v += (Math.PI / 3) * (r1 * r1 + r1 * r2 + r2 * r2) * (y2 - y1)
  }
  return Math.abs(v)
}

export const BOWL_VOLUME = revolvedVolume(BOWL)

/** Deck clearance (piston crown at TDC to head face) needed for compression ratio r. */
export function deckGap(r: number) {
  const vc = clearanceForRatio(VS, r)
  return Math.max(0.0008, (vc - BOWL_VOLUME) / AREA)
}

export const VALVE_TIMING = TYPICAL_DIESEL_TIMING

/** Tappet lift (= valve lift / rocker ratio) for a cycle angle in degrees. */
export function tappetLifts(thetaDeg: number) {
  const l = valveLifts(thetaDeg, VALVE_TIMING)
  return { inlet: l.inlet / ROCKER_RATIO, exhaust: l.exhaust / ROCKER_RATIO }
}

/* ------------------------------ Parameters ------------------------------ */

export interface EngineParams {
  cycle: CycleKind
  r: number
  /** kPa */
  P1: number
  /** K */
  T1: number
  /** heat added, kJ/kg */
  q: number
  /** fraction of heat added at constant volume (dual cycle) */
  fV: number
  rpm: number
  flows: boolean
}

export const DEFAULTS: EngineParams = { cycle: 'diesel', r: 17, P1: 100, T1: 310, q: 1800, fV: 0.4, rpm: 1500, flows: true }

interface EngineStore extends EngineParams {
  set: (p: Partial<EngineParams>) => void
  reset: () => void
}

export const useEngine = create<EngineStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export function computeCycle(p: Pick<EngineParams, 'cycle' | 'r' | 'P1' | 'T1' | 'q' | 'fV'>): CycleResult {
  const g = AIR
  let alpha = 1
  let delta = 1
  if (p.cycle === 'otto') alpha = alphaFromHeat(p.q, p.r, p.T1, g)
  else if (p.cycle === 'diesel') delta = deltaFromHeat(p.q, p.r, p.T1, g)
  else ({ alpha, delta } = dualFromHeatSplit(p.q, p.fV, p.r, p.T1, g))
  return airStandardCycle({ kind: p.cycle, r: p.r, P1: p.P1, T1: p.T1, alpha, delta, gas: g })
}

/** Mass of air trapped per cycle (kg) and total cylinder volume V1 (m³). */
export function chargeMass(c: CycleResult, r: number) {
  const V1 = VS + VS / (r - 1)
  return { V1, m: V1 / c.s1.v }
}

/* ------------------------------ Live values (3D → panels) ------------------------------ */

export interface LiveEngine {
  /** cycle angle, degrees 0…720 (0 = TDC, start of intake) */
  theta: number
  stroke: Stroke
  P: number
  T: number
  /** cylinder volume, cm³ */
  Vcm3: number
  s: number
  inletLift: number
  exhaustLift: number
  /** piston travel from TDC, m */
  x: number
  injecting: boolean
}

export const live: LiveEngine = { theta: 0, stroke: 'intake', P: 100, T: 300, Vcm3: 0, s: 0, inletLift: 0, exhaustLift: 0, x: 0, injecting: false }

/** Everything the 3D view needs for one crank angle. */
export function kinematics(thetaRad: number) {
  const deg = (((thetaRad * 180) / Math.PI) % 720 + 720) % 720
  const crankAngle = thetaRad % (2 * Math.PI)
  const pin = pinHeight(SC, crankAngle)
  const x = pistonFromTDC(SC, crankAngle)
  return { deg, crankAngle, pin, x }
}

export function cycleState(c: CycleResult, deg: number, r: number) {
  const vf = volumeFraction(SC, (deg * Math.PI) / 180, r)
  return stateAtCrank(c, deg, vf)
}

/** Diesel/dual: fuel is injected from ~15° before to ~15° after firing TDC. */
export function isInjecting(cycle: CycleKind, deg: number) {
  return cycle !== 'otto' && deg > 345 && deg < 375
}

/** Map gas temperature to a display colour (cool blue → hot orange → white). */
export function gasColor(T: number, out: { r: number; g: number; b: number }) {
  const t = Math.max(0, Math.min(1, (T - 280) / 2300))
  const stops: [number, number, number, number][] = [
    [0, 0.23, 0.44, 0.66],
    [0.3, 0.55, 0.52, 0.5],
    [0.6, 0.91, 0.5, 0.16],
    [1, 1, 0.92, 0.7],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0])
      out.r = a[1] + (b[1] - a[1]) * u
      out.g = a[2] + (b[2] - a[2]) * u
      out.b = a[3] + (b[3] - a[3]) * u
      return out
    }
  }
  out.r = 1
  out.g = 0.92
  out.b = 0.7
  return out
}
