import { create } from 'zustand'
import { pinHeight, pistonFromTDC, sweptVolume, type SliderCrank } from '@/physics/engine'
import { portOpenFractions, portTiming, trappedCompressionRatio, type PortLayout, type TwoStrokeGas, type TwoStrokePhase, type CrankcasePhase } from '@/physics/engineExtra'

/**
 * Single-cylinder, air-cooled, piston-ported (three-port) two-stroke petrol engine with a
 * deflector piston — TB Fig 2.4. 50 mm bore × 51 mm stroke = 100 cm³, the swept volume of the
 * lawn-mower engine in Misc Ex 5. Frame: Y up, crank axis Z, crank centre at the origin, m.
 * Exhaust port +X, transfer port −X (deflector side), inlet port at the back (−Z).
 */
export const DIM = {
  bore: 0.05,
  stroke: 0.051,
  crankR: 0.0255,
  rodL: 0.1,
  /** gudgeon pin centre to crown */
  pistonComp: 0.022,
  /** gudgeon pin centre to bottom of skirt */
  pistonSkirt: 0.036,
  /** geometric compression ratio (petrol ≈ 8 : 1, Misc p2) */
  r: 8,
  deflectorH: 0.0065,
  /** barrel base (on the crankcase) */
  barrelY0: 0.06,
  coreR: 0.047,
  finR: 0.066,
}

export const SC: SliderCrank = { r: DIM.crankR, l: DIM.rodL }
export const AREA = (Math.PI / 4) * DIM.bore ** 2
export const VS = sweptVolume(DIM.bore, DIM.stroke)
export const VC = VS / (DIM.r - 1)
export const CROWN_TDC = DIM.crankR + DIM.rodL + DIM.pistonComp
export const SKIRT_TDC = CROWN_TDC - DIM.pistonComp - DIM.pistonSkirt
/** volume of the deflector ridge (it sits in the clearance space at TDC) */
export const DEFLECTOR_VOL = 0.5 * (0.0065 * (0.004 + 0.024)) * 0.04
/** head face height: flat head, clearance gap sized so that Vc gives r = 8 */
export const HEAD_Y = CROWN_TDC + (VC + DEFLECTOR_VOL) / AREA

/**
 * Port heights (mm below the crown-at-TDC line, or below the skirt-at-TDC line for the inlet).
 * The notes give no port dimensions or timing; these are typical for a deflector-piston engine
 * and the timing diagram is COMPUTED from them through the slider-crank.
 */
export const PORTS: PortLayout = {
  exhaustTop: 0.033,
  exhaustHeight: 0.0185,
  transferTop: 0.04,
  transferHeight: 0.0115,
  inletTravel: 0.015,
  inletHeight: 0.012,
}

/** World heights of the port windows. */
export const PORT_Y = {
  exhaust: [CROWN_TDC - PORTS.exhaustTop - PORTS.exhaustHeight, CROWN_TDC - PORTS.exhaustTop] as const,
  transfer: [CROWN_TDC - PORTS.transferTop - PORTS.transferHeight, CROWN_TDC - PORTS.transferTop] as const,
  inlet: [SKIRT_TDC - PORTS.inletTravel, SKIRT_TDC - PORTS.inletTravel + PORTS.inletHeight] as const,
}

export const TIMING = portTiming(SC, PORTS)
export const TRAPPED_CR = trappedCompressionRatio(VS, VC, PORTS.exhaustTop, DIM.stroke)

/** Crankcase compression ratio (typical 1.3–1.5; beyond notes). */
export const CRANKCASE_CR = 1.4

export const GAS: TwoStrokeGas = { r: DIM.r, crankcaseRatio: CRANKCASE_CR, P0: 100, T0: 330, q: 1250, k: 1.4, cv: 0.718 }

/** Spark ≈ 25° before TDC when running (TB §5.5 — given for spark-ignition engines generally). */
export const SPARK_BTDC = 25

/* ------------------------------ parameters ------------------------------ */

export type PetroilMix = '16' | '24' | '2pc' | '3pc'

export interface TwoStrokeParams {
  rpm: number
  flows: boolean
  mist: boolean
  mix: PetroilMix
  /** petrol in the tank, litres */
  petrol: number
}

export const DEFAULTS: TwoStrokeParams = { rpm: 1500, flows: true, mist: true, mix: '24', petrol: 5 }

interface Store extends TwoStrokeParams {
  set: (p: Partial<TwoStrokeParams>) => void
  reset: () => void
}

export const useTwoStroke = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ kinematics ------------------------------ */

export function kinematics(thetaDeg: number) {
  const a = (thetaDeg * Math.PI) / 180
  const x = pistonFromTDC(SC, a)
  return { a, x, pin: pinHeight(SC, a), open: portOpenFractions(x, PORTS) }
}

/* ------------------------------ live values ------------------------------ */

export interface LiveTwoStroke {
  theta: number
  x: number
  pCyl: number
  pCase: number
  T: number
  phase: TwoStrokePhase
  casePhase: CrankcasePhase
  exhaust: number
  transfer: number
  inlet: number
  spark: boolean
}

export const live: LiveTwoStroke = { theta: 0, x: 0, pCyl: 100, pCase: 100, T: 300, phase: 'compression', casePhase: 'induction', exhaust: 0, transfer: 0, inlet: 0, spark: false }

export const PHASE_LABEL: Record<TwoStrokePhase, string> = {
  compression: 'Compression',
  expansion: 'Power (expansion)',
  blowdown: 'Exhaust blow-down',
  scavenging: 'Transfer & scavenging',
}

export const CASE_LABEL: Record<CrankcasePhase, string> = {
  induction: 'Induction (inlet open)',
  'pre-compression': 'Pre-compression',
  transfer: 'Transfer to cylinder',
  suction: 'Suction (sealed)',
}
