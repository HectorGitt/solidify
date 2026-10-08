import { create } from 'zustand'
import { SRC } from '@/content/citations'
import {
  CACL2_BELL,
  CACL2_TT,
  CAST_WEIGHTS,
  LB_KG,
  PSI_PER_BAR,
  RECOMMENDED_PRESSURE_BAR,
  contactPatch,
  inflationState,
  liquidHeadPsiPerFt,
  decodeTyreSize,
  frontWeightFraction,
  levelForFill,
  liquidBallast,
  rearWeightRange,
  slipVerdict,
  weightPerHp,
  type Implement,
  type SoilSurface,
} from '@/physics/tyres'

export const TT = (where: string) => SRC.tt510(where)
export const TTS = (where: string) => SRC.tts510(where)
export const BAL = (where: string) => SRC.bal510(where)
export const L27 = (where: string) => SRC.l27(where)

export const SIZES = ['18.4-38', '24.5-32', '20.8-38', '16.9-34', '14.9-28', '13.6/12-36'] as const
export type Mix = 'tt' | 'bell' | 'water'
export const MIXES: Record<Mix, { label: string; cacl2: number; text: string }> = {
  tt: { label: 'CaCl₂ 3½ lb/gal', cacl2: CACL2_TT, text: 'Water with 3½ lb of calcium chloride per gallon: slush-free to −12 °F.' },
  bell: { label: 'CaCl₂ 1 kg/5 L', cacl2: CACL2_BELL, text: '1 kg of chemical to every 5 litres of water. Add the chemical to the water and let it cool before filling.' },
  water: { label: 'Plain water', cacl2: 0, text: 'No antifreeze: if it freezes it expands and can burst the tyre.' },
}

/** NTR = 0.664(1 − e^(−0.098·slip%)) — the Zoz & Grisso worked regression (L27 Fig 17, p18). */
export const DA = 0.664
export const C0 = 0.098

/** Slip that develops a net traction ratio (inverse of the L27 Fig 17 regression), capped at 60 %. */
export function slipForNTR(ntr: number) {
  if (ntr <= 0) return 0
  if (ntr >= DA * 0.9975) return 0.6
  return Math.min(0.6, -Math.log(1 - ntr / DA) / C0 / 100)
}

export function ntrForSlip(slip: number) {
  return DA * (1 - Math.exp(-C0 * slip * 100))
}

export interface BallastParams {
  size: (typeof SIZES)[number]
  /** liquid fill fraction of the tyre cavity */
  fill: number
  mix: Mix
  /** cast-iron discs per rear wheel (≈ 40 kg each) */
  weights: number
  /** unballasted rear axle weight, kg */
  baseRear: number
  /** unballasted front axle weight, kg */
  baseFront: number
  ptoHp: number
  mph: number
  implement: Implement
  soil: SoilSurface
  /** drawbar pull, kN */
  pull: number
  /** cold inflation pressure of the rear tyres, psi */
  psi: number
}

export const DEFAULTS: BallastParams = {
  size: '18.4-38',
  fill: 0.75,
  mix: 'tt',
  weights: 2,
  baseRear: 3600,
  baseFront: 1700,
  ptoHp: 120,
  mph: 5.3,
  implement: 'semi-integral',
  soil: 'firm',
  pull: 23,
  psi: 12,
}

/** Rear-tyre field pressure, general guide (Bell TTS p14): 0.8 bar ≈ 12 psi. */
export const REAR_FIELD_PSI = RECOMMENDED_PRESSURE_BAR.rear.field * PSI_PER_BAR
/** Hot tyres read 4–6 psi above the cold pressure — never bleed them (TT p7). */
export const HOT_RISE_PSI = [4, 6] as const
const PSI = 6894.757

interface Store extends BallastParams {
  set: (p: Partial<BallastParams>) => void
  reset: () => void
}

export const useBallast = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Everything derived from the parameters. */
export function derive(p: BallastParams) {
  const size = decodeTyreSize(p.size)!
  const liquid = liquidBallast(size, p.fill, MIXES[p.mix].cacl2)
  const level = levelForFill(size, Math.min(0.999, Math.max(0.001, p.fill)))
  const castKg = 2 * p.weights * CAST_WEIGHTS.rearDiscKg
  const rearKg = p.baseRear + 2 * liquid.massKg + castKg
  const ntr = (p.pull * 1000) / (rearKg * 9.81)
  const slip = slipForNTR(ntr)
  const guide = weightPerHp(p.implement, p.soil, p.mph)
  const rangeLb = rearWeightRange(p.ptoHp, guide)
  const rearLb = rearKg / LB_KG
  const frontNeedKg = frontWeightFraction(p.implement) * rearKg
  const inflation = inflationState(p.psi, REAR_FIELD_PSI)
  const patch = contactPatch((rearKg * 9.81) / 2, p.psi * PSI, size, inflation)
  // liquid height above the valve when the valve is at the bottom of the rim (gauge correction, TT p7)
  const rimR = size.rimMm / 2000
  const headFt = Math.max(0, (level + rimR) / 0.3048)
  const headPsi = headFt * liquidHeadPsiPerFt(1 + MIXES[p.mix].cacl2)
  return {
    inflation,
    patch,
    headFt,
    headPsi,
    size,
    liquid,
    level,
    castKg,
    rearKg,
    rearLb,
    ntr,
    slip,
    verdict: slipVerdict(slip),
    guide,
    rangeLb,
    frontNeedKg,
    frontAddKg: Math.max(0, frontNeedKg - p.baseFront),
  }
}

/* ------------------------------ Live (3D → panel) ------------------------------ */

export const live = {
  /** loaded revolutions since the test started */
  revs: 0,
  /** ground distance travelled since the test started, m */
  dist: 0,
  /** distance per revolution with no slip, m */
  circ: 1,
  slip: 0,
  /** set by the panel: start a new test at the next chalk-mark contact */
  reset: true,
}

export function resetTest() {
  live.revs = 0
  live.dist = 0
  live.reset = true
}
