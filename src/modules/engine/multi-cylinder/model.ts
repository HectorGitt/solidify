import { create } from 'zustand'
import { cylinderCycleAngle, firingAngles, firingInterval, pinHeight, pistonVelocity, strokeAt, throwAngle, volumeFraction, type FourStroke, type SliderCrank } from '@/physics/engine'
import { AIR, airStandardCycle, deltaFromHeat, stateAtCrank } from '@/physics/thermo'

/**
 * Inline multi-cylinder four-stroke engine: 2, 3, 4, 6 or 8 cylinders on one crankshaft.
 * Frame: crank axis = Z (cylinder 1 at the front, +Z, pulley end), cylinders vertical (+Y),
 * crank centre at the origin. Dimensions are typical tractor-diesel proportions.
 */
export const DIM = {
  bore: 0.08,
  stroke: 0.09,
  crankR: 0.045,
  rodL: 0.16,
  pistonComp: 0.042,
  pistonSkirt: 0.04,
  pitch: 0.1,
  linerOuter: 0.05,
}

export const SC: SliderCrank = { r: DIM.crankR, l: DIM.rodL }
export const CROWN_TDC = DIM.crankR + DIM.rodL + DIM.pistonComp
export const AREA = (Math.PI / 4) * DIM.bore ** 2

export type CylCount = 2 | 3 | 4 | 6 | 8

export interface Layout {
  id: string
  label: string
  /** firing order, 1-based */
  order: number[]
  /** firing angle (deg, 0…720) of each cylinder, indexed by cylinder number − 1 */
  firing: number[]
  /** where the layout comes from */
  source: string
  beyond?: boolean
  note?: string
}

/** Even firing at 720/n° in the given order (TB §2.6.4). */
function even(order: number[], source: string, label?: string, beyond = false, note?: string): Layout {
  const m = firingAngles(order)
  return {
    id: order.join('-'),
    label: label ?? order.join('-'),
    order,
    firing: order.map((_, i) => m.get(i + 1)!),
    source,
    beyond,
    note,
  }
}

export const LAYOUTS: Record<CylCount, Layout[]> = {
  2: [
    {
      id: '180',
      label: '180° crank',
      order: [1, 2],
      firing: [0, 180],
      source: 'Twin throws 180° apart',
      note: 'Throws 180° apart balance the pistons, but a four-stroke twin then fires unevenly: 180°, then 540°.',
    },
    even([1, 2], 'Even firing 720°/2', '360° crank', true, 'Both pistons rise together; firing is even (every 360°) but the reciprocating masses are unbalanced.'),
  ],
  3: [even([1, 2, 3], 'Firing interval 720°/3 = 240°', '1-2-3', true), even([1, 3, 2], 'Firing interval 720°/3 = 240°', '1-3-2', true)],
  4: [even([1, 3, 4, 2], 'Standard order'), even([1, 2, 4, 3], 'Standard order')],
  6: [
    even([1, 5, 3, 6, 2, 4], 'Standard order'),
    even([1, 4, 2, 6, 3, 5], 'Standard order'),
    even([1, 6, 3, 5, 2, 4], 'Alternative order', undefined, false, 'Its crank pairs throws 1&5, 2&4 and 3&6 — not the mirror-symmetric crank of 1-5-3-6-2-4.'),
    even([1, 4, 3, 2, 6, 5], 'Letter notation (1-4-3-2-6-5)', 'A-D-C-B-F-E', false, 'Order written with letters: A-D-C-B-F-E = 1-4-3-2-6-5.'),
  ],
  8: [
    even([1, 7, 5, 3, 8, 6, 2, 4], '100 kVA genset engine'),
    even([1, 6, 2, 5, 8, 3, 7, 4], 'Common straight-eight order', undefined, true),
  ],
}

export const COUNTS: CylCount[] = [2, 3, 4, 6, 8]

/* ------------------------------ parameters ------------------------------ */

export interface MultiParams {
  n: CylCount
  layout: string
  rpm: number
  gas: boolean
}

export const DEFAULTS: MultiParams = { n: 4, layout: '1-3-4-2', rpm: 900, gas: true }

interface Store extends MultiParams {
  set: (p: Partial<MultiParams>) => void
  reset: () => void
}

export const useMulti = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) =>
    set((s) => {
      const next = { ...s, ...p }
      // keep the layout valid for the cylinder count
      if (!LAYOUTS[next.n].some((l) => l.id === next.layout)) next.layout = LAYOUTS[next.n][0].id
      return next
    }),
  reset: () => set(DEFAULTS),
}))

export function currentLayout(n: CylCount, id: string) {
  return LAYOUTS[n].find((l) => l.id === id) ?? LAYOUTS[n][0]
}

/** z of cylinder i (1-based): cylinder 1 at the front (+Z). */
export function cylZ(i: number, n: number) {
  return ((n + 1) / 2 - i) * DIM.pitch
}

export interface CylState {
  stroke: FourStroke
  /** cycle angle 0…720 (0 = TDC, start of intake) */
  psi: number
  pin: number
}

export function cylinderState(crankDeg: number, firingDeg: number): CylState {
  const psi = cylinderCycleAngle(crankDeg, firingDeg)
  return { psi, stroke: strokeAt(psi), pin: pinHeight(SC, ((psi % 360) * Math.PI) / 180) }
}

export { firingInterval, throwAngle }

/* ------------------------------ gas torque (beyond notes) ------------------------------ */

/**
 * Air-standard Diesel cycle (r = 16, 1 bar, 310 K, 1500 kJ/kg) used only to show the SHAPE of
 * each cylinder's gas torque and how the crank adds them up. Inertia forces are ignored.
 */
const R_CR = 16
export const TORQUE_CYCLE = airStandardCycle({ kind: 'diesel', r: R_CR, P1: 100, T1: 310, alpha: 1, delta: deltaFromHeat(1500, R_CR, 310, AIR) })

/** Gas torque of one cylinder (N·m) at cycle angle ψ (deg): T = (p − p₁)·A·dx/dθ. */
export function cylinderTorque(psiDeg: number) {
  const th = ((psiDeg % 360) * Math.PI) / 180
  const st = stateAtCrank(TORQUE_CYCLE, psiDeg, volumeFraction(SC, th, R_CR))
  return (st.P - TORQUE_CYCLE.s1.P) * 1000 * AREA * pistonVelocity(SC, th, 1)
}

/** Combined crankshaft gas torque over one cycle, sampled every `step` degrees. */
export function torqueCurve(layout: Layout, step = 2) {
  const xs: number[] = []
  const total: number[] = []
  const first: number[] = []
  for (let th = 0; th <= 720; th += step) {
    xs.push(th)
    let sum = 0
    layout.firing.forEach((f, i) => {
      const t = cylinderTorque(cylinderCycleAngle(th, f))
      sum += t
      if (i === 0) first.push(t)
    })
    total.push(sum)
  }
  const mean = total.reduce((a, b) => a + b, 0) / total.length
  const max = Math.max(...total)
  const min = Math.min(...total)
  return { xs, total, first, mean, max, min }
}

/* ------------------------------ live values ------------------------------ */

export const live = {
  /** engine crank angle 0…720 */
  theta: 0,
  /** cylinder that most recently began its power stroke */
  lastFired: 1,
  /** degrees since it fired */
  sinceFire: 0,
}

export const STROKE_COLOR: Record<FourStroke, string> = {
  intake: '#4f8fd0',
  compression: '#6fbf73',
  power: '#e8794f',
  exhaust: '#8d8478',
}
