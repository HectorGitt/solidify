import { create } from 'zustand'
import {
  beltMassPerMetre,
  beltSpeed,
  beltsRequired,
  centrifugalTension,
  correctedPowerPerBelt,
  fennerBeltLength,
  flatBeltWidth,
  slackTension,
  tensionFactor,
} from '@/physics/elements'
import { beltLoop, type BeltLoop, type Pulley } from '../_shared/loop'

const { PI, log } = Math
export const rad = (d: number) => (d * PI) / 180
export const deg = (r: number) => (r * 180) / PI

export type Layout = 'open' | 'crossed' | 'idler'
export type Kind = 'flat' | 'v'
export type Section = 'Z' | 'A' | 'B'

/** V-belt sections (Fenner): top width, depth, groove pitch e (m). */
export const SECTIONS: Record<Section, { top: number; h: number; e: number; pitchW: number }> = {
  Z: { top: 0.01, h: 0.006, e: 0.012, pitchW: 0.0085 },
  A: { top: 0.013, h: 0.008, e: 0.015, pitchW: 0.011 },
  B: { top: 0.017, h: 0.011, e: 0.019, pitchW: 0.014 },
}

/** Fenner Table 5 (page F13): arc-of-contact correction factor against (D − d)/C. */
export const ARC_TABLE: [number, number][] = [
  [0, 1], [0.05, 0.99], [0.1, 0.99], [0.15, 0.98], [0.2, 0.97], [0.25, 0.97], [0.3, 0.96], [0.35, 0.95], [0.4, 0.94], [0.45, 0.93],
  [0.5, 0.93], [0.55, 0.92], [0.6, 0.91], [0.65, 0.9], [0.7, 0.89], [0.75, 0.88], [0.8, 0.87], [0.85, 0.86], [0.9, 0.85], [0.95, 0.83],
  [1, 0.82], [1.05, 0.81], [1.1, 0.8], [1.15, 0.78], [1.2, 0.77], [1.25, 0.75], [1.3, 0.73], [1.35, 0.72], [1.4, 0.7], [1.45, 0.68],
]

export function arcFactor(ratio: number) {
  if (ratio <= 0) return 1
  for (let i = 1; i < ARC_TABLE.length; i++) {
    const [x1, y1] = ARC_TABLE[i]
    if (ratio <= x1) {
      const [x0, y0] = ARC_TABLE[i - 1]
      return y0 + ((y1 - y0) * (ratio - x0)) / (x1 - x0)
    }
  }
  return ARC_TABLE[ARC_TABLE.length - 1][1]
}

export interface BeltParams {
  layout: Layout
  kind: Kind
  /** small (driver, motor) and large (driven) pulley diameters, centre distance — m */
  d: number
  D: number
  C: number
  rpm: number
  /** friction on the small and large pulley */
  f1: number
  f2: number
  /** V-groove angle (rad) */
  groove: number
  section: Section
  nBelts: number
  /** mass of 1 m of one V-belt (kg/m) */
  mV: number
  /** flat belt: width, thickness, density, allowable stress */
  b: number
  t: number
  rho: number
  s1: number
  /** tight-side limit from stress (s1·b·t) or a given force */
  limit: 'stress' | 'force'
  T1max: number
  /** find the power a belt can carry, or the width needed for a power */
  task: 'power' | 'width'
  /** power to transmit (W) */
  P: number
  /** wraps given by the question (idler drives), [small, large] in rad */
  wraps: [number, number] | null
  /** idler position: fraction along the slack span, depth it pushes in (m) */
  idlerAt: number
  idlerPush: number
  /** exaggerated creep for display (fraction) */
  creep: number
  /* Fenner catalogue workflow (Module 2) */
  catRated: number
  catSF: number
  catBasic: number
  catInc: number
  catFL: number
  /** arc factor typed in from the guide; NaN = read Table 5 */
  catFarc: number
  outRpm: number
}

export const DEFAULTS: BeltParams = {
  layout: 'crossed',
  kind: 'flat',
  d: 0.25,
  D: 0.5,
  C: 1.25,
  rpm: 1000,
  f1: 0.3,
  f2: 0.3,
  groove: rad(36),
  section: 'A',
  nBelts: 3,
  mV: 0.523,
  b: 0.092,
  t: 0.006,
  rho: 970,
  s1: 1.7e6,
  limit: 'stress',
  T1max: 900,
  task: 'width',
  P: 7500,
  wraps: null,
  idlerAt: 0.3,
  idlerPush: 0.08,
  creep: 0.03,
  catRated: 7.5,
  catSF: 1.2,
  catBasic: 2.7,
  catInc: 0.18,
  catFL: 1.17,
  catFarc: NaN,
  outRpm: 500,
}

interface Store extends BeltParams {
  set: (p: Partial<BeltParams>) => void
  reset: () => void
}

export const useBelts = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export const IDLER_R = 0.06

/** Pulleys laid out with the driver (small) on the left, belt plane z = 0. */
export function buildLoop(p: Pick<BeltParams, 'layout' | 'kind' | 'd' | 'D' | 'C' | 'idlerAt' | 'idlerPush' | 't'>, radial = 0): BeltLoop {
  const r1 = p.d / 2 + radial
  const r2 = p.D / 2 + radial
  const c1: [number, number] = [-p.C / 2, 0]
  const c2: [number, number] = [p.C / 2, 0]
  if (p.layout === 'crossed' && p.kind === 'flat')
    return beltLoop(
      [
        { c: c1, r: r1, s: 1 },
        { c: c2, r: r2, s: -1 },
      ],
      Math.max(0.03, p.t * 6),
    )
  const pulleys: Pulley[] = [{ c: c1, r: r1, s: 1 }]
  if (p.layout === 'idler') pulleys.push({ c: idlerCentre(p), r: IDLER_R + radial, s: -1 })
  pulleys.push({ c: c2, r: r2, s: 1 })
  return beltLoop(pulleys)
}

/** Back-side idler below the slack (lower) span, pushed in by idlerPush. */
export function idlerCentre(p: Pick<BeltParams, 'd' | 'D' | 'C' | 'idlerAt' | 'idlerPush'>): [number, number] {
  const r1 = p.d / 2
  const r2 = p.D / 2
  // lower span of the plain open belt
  const beta = Math.asin((r2 - r1) / p.C)
  const yA = -r1 * Math.cos(beta)
  const yB = -r2 * Math.cos(beta)
  const xA = -p.C / 2 - r1 * Math.sin(beta)
  const xB = p.C / 2 - r2 * Math.sin(beta)
  const x = xA + (xB - xA) * p.idlerAt
  const y = yA + (yB - yA) * p.idlerAt
  return [x, y - IDLER_R + p.idlerPush]
}

export interface BeltAnalysis {
  loop: BeltLoop
  /** wraps used in the calculation [small, large] (rad) and where they came from */
  alpha: [number, number]
  fromQuestion: boolean
  /** e^(fα/sin(θ/2)) on each pulley and the governing one */
  k: [number, number]
  gov: 0 | 1
  kg: number
  v: number
  m: number
  Tc: number
  T1: number
  T2: number
  /** power per belt (W) */
  Pbelt: number
  /** total power of the drive at the T1 limit (W) */
  Ptotal: number
  width?: ReturnType<typeof flatBeltWidth>
  belts?: ReturnType<typeof beltsRequired>
  /** slip (active) arcs on each pulley, rad */
  active: [number, number]
  mu: [number, number]
  driven: number
}

export function analyse(p: BeltParams): BeltAnalysis {
  const loop = buildLoop(p)
  const geo: [number, number] = [loop.wraps[0], loop.wraps[loop.wraps.length - 1]]
  const alpha = p.wraps ?? geo
  const theta = p.kind === 'v' ? p.groove : PI
  const mu: [number, number] = [p.f1 / Math.sin(theta / 2), p.f2 / Math.sin(theta / 2)]
  const k: [number, number] = [tensionFactor(p.f1, alpha[0], theta), tensionFactor(p.f2, alpha[1], theta)]
  const gov = k[0] <= k[1] ? 0 : 1
  const kg = k[gov]
  const v = beltSpeed(p.d, p.rpm)
  let m = p.kind === 'v' ? p.mV : beltMassPerMetre(p.b, p.t, p.rho)
  let T1 = p.limit === 'stress' && p.kind === 'flat' ? p.s1 * p.b * p.t : p.T1max
  let width: BeltAnalysis['width']
  if (p.kind === 'flat' && p.task === 'width') {
    width = flatBeltWidth(p.P, v, p.s1, p.rho, kg, p.t)
    m = beltMassPerMetre(width.b, p.t, p.rho)
    T1 = p.s1 * width.b * p.t
  }
  const Tc = centrifugalTension(m, v)
  const T2 = slackTension(T1, m, v, kg)
  const Pbelt = (T1 - T2) * v
  const n = p.kind === 'v' ? p.nBelts : 1
  const belts = p.kind === 'v' ? beltsRequired(p.P, Pbelt) : undefined
  const ratio = Math.max(1.0001, (T1 - Tc) / Math.max(1e-6, T2 - Tc))
  const active: [number, number] = [Math.min(alpha[0], log(ratio) / mu[0]), Math.min(alpha[1], log(ratio) / mu[1])]
  return { loop, alpha, fromQuestion: !!p.wraps, k, gov, kg, v, m, Tc, T1, T2, Pbelt, Ptotal: Pbelt * n, width, belts, active, mu, driven: (p.rpm * p.d) / p.D }
}

/** Fenner catalogue selection (Module 2): design power → length → factors → number of belts. */
export function catalogue(p: BeltParams) {
  const design = p.catRated * p.catSF
  const dmm = p.d * 1000
  const Dmm = p.D * 1000
  const Cmm = p.C * 1000
  const L = fennerBeltLength(Dmm, dmm, Cmm)
  const ratio = (Dmm - dmm) / Cmm
  const FarcTable = arcFactor(ratio)
  const Farc = Number.isFinite(p.catFarc) ? p.catFarc : FarcTable
  const per = correctedPowerPerBelt(p.catBasic, p.catInc, p.catFL, Farc)
  const n = beltsRequired(design, per)
  return { design, L, ratio, Farc, FarcTable, per, n, arcSmall: 180 - 57 * ratio }
}

/* ------------------------------ live values ------------------------------ */

export const live = {
  rpm1: 0,
  rpm2: 0,
  v: 0,
  slip: 0,
}

/**
 * Tension along the loop (for arrows and creep). Each pulley grips over an idle arc and slips
 * (creeps) over an active arc at the exit end, where T − Tc changes by e^(μφ).
 */
export function tensionAt(a: BeltAnalysis, s: number) {
  const loop = a.loop
  const g = loop.segs[loop.segAt(s)]
  const last = loop.pulleys.length - 1
  if (g.kind === 'line') return g.to === 0 ? a.T1 : a.T2
  const j = g.pulley!
  if (j !== 0 && j !== last) return a.T2 // idler
  const span = Math.abs(g.sweep!)
  const phi = ((s - g.s0) / (g.s1 - g.s0)) * span
  const act = j === 0 ? a.active[0] : a.active[1]
  const idle = span - act
  if (phi <= idle) return j === 0 ? a.T1 : a.T2
  const mu = j === 0 ? a.mu[0] : a.mu[1]
  const x = phi - idle
  return j === 0 ? a.Tc + (a.T1 - a.Tc) * Math.exp(-mu * x) : a.Tc + (a.T2 - a.Tc) * Math.exp(mu * x)
}
