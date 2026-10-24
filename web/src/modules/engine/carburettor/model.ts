import { create } from 'zustand'
import { TYPICAL_CARB, TYPICAL_FLOAT, carburettor, needleOpening, type CarbResult } from '@/physics/engineSystems'

/**
 * SI (petrol / TVO) fuel system, laid out on the z = 0 plane: tank with vented cap → sediment bowl →
 * diaphragm lift pump on the engine block (worked by a camshaft eccentric and rocker arm) →
 * downdraught carburettor → inlet manifold. Metres, Y up.
 */
export const L = {
  tank: { x0: -0.6, x1: -0.34, y0: 0.36, y1: 0.52, z: 0.09 },
  bowl: { x: -0.24, y: 0.24 },
  /** diaphragm pump axis */
  pumpX: -0.045,
  diaphragmY: 0.1,
  /** rocker pivot, eccentric (camshaft) centre */
  pivot: { x: -0.025, y: 0.045 },
  cam: { x: 0.012, y: -0.03 },
  eccR: 0.018,
  ecc: 0.0025,
  /** carburettor barrel axis and float-chamber axis */
  barrelX: 0.3,
  chamberX: 0.236,
  floorY: 0.115,
  throatY: 0.142,
  throttleY: 0.085,
  chokeY: 0.205,
  /** float lever pivot */
  floatPivot: { x: 0.258, y: 0.162 },
}

/** Float centre and needle tab in the lever frame (pivot at origin, lever level at the set fuel level). */
export const FLOAT_ARM = { cx: -0.034, cy: -0.027, tabX: -0.022, tabY: -0.0075 }

export const FUEL_C = '#e8c94a'
export const AIR_C = '#7fc4f0'

export interface CarbParams {
  rpm: number
  throttle: number
  choke: number
  idle: boolean
  /** float level error, m (+ high / − low) */
  levelError: number
  flows: boolean
}

export const DEFAULTS: CarbParams = { rpm: 1800, throttle: 0.45, choke: 0, idle: true, levelError: 0, flows: true }

interface CarbStore extends CarbParams {
  set: (p: Partial<CarbParams>) => void
  reset: () => void
  /** empty the float chamber (it refills through the needle valve) */
  emptyBowl: () => void
}

export const useCarb = create<CarbStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => {
    live.level = TYPICAL_FLOAT.levelSet
    set(DEFAULTS)
  },
  emptyBowl: () => {
    live.level = 0.003
  },
}))

export const SPEC = TYPICAL_CARB
export const FLOAT = TYPICAL_FLOAT

export function operatingPoint(p: Pick<CarbParams, 'rpm' | 'throttle' | 'choke' | 'idle' | 'levelError'>, levelDeficit = 0): CarbResult {
  return carburettor(SPEC, { rpm: p.rpm, throttle: p.throttle, choke: p.choke, idleCircuit: p.idle, levelError: p.levelError - levelDeficit })
}

/** Air flow at wide-open throttle and 2500 rpm, for scaling the particle flow. */
export const AIR_MAX = carburettor(SPEC, { rpm: 2500, throttle: 1, choke: 0 }).air

export interface LiveCarb {
  /** float-chamber fuel level above the floor, m */
  level: number
  needle: number
  /** fuel drawn by the jets, kg/s */
  fuel: number
  main: number
  idle: number
  air: number
  af: number
  /** pump camshaft angle, rad */
  cam: number
  /** diaphragm displacement (down), m */
  diaphragm: number
  /** lift-pump stroke fraction actually used (lost motion when the bowl is full) */
  stroke: number
}

export const live: LiveCarb = { level: TYPICAL_FLOAT.levelSet, needle: 0, fuel: 0, main: 0, idle: 0, air: 0, af: 15, cam: 0, diaphragm: 0, stroke: 0 }

export { needleOpening }
