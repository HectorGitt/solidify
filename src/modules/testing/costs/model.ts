import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import {
  implementSalvagePct,
  machineCosts,
  plotEfficiency,
  realRate,
  tractorSalvagePct,
  type ImplementClass,
  type RepairKey,
  type TractorClass,
} from '@/physics/costs'

export const C = {
  mgmt: (w: string) => SRC.mgmt501(w),
  exam1920: (w: string) => cite('AEE501', 'AEE 501 201920 questions.docx', w),
  exam2324: (w: string) => cite('AEE501', 'part 5 exam.docx', w),
}

/* ------------------------------ parameters ------------------------------ */

export interface CostParams {
  /* field */
  W: number
  S: number
  overlap: number
  passes: number
  L: number
  /** fixed time per headland turn (lift, lower, slow down), s */
  turnFixed: number
  /** turning speed as a fraction of S */
  turnSpeed: number
  /** adjustments, filling/emptying, as a fraction of working time */
  otherFrac: number
  /** use the field-model FE (true) or a fixed FE */
  feModel: boolean
  FE: number
  fastForward: number
  /* tractor */
  tList: number
  tPurchase: number
  tYears: number
  tHours: number
  tClass: TractorClass
  ptoHp: number
  fuelPrice: number
  wage: number
  labourFactor: number
  nominal: number
  inflation: number
  /* implement */
  iOn: boolean
  iList: number
  iPurchase: number
  iYears: number
  iHours: number
  iClass: ImplementClass
  iRepair: RepairKey
  iHoursAtPurchase: number
  /** age of the implement when sold, years (Table 1b row) */
  iEndAge: number
  currency: string
  units: 'si' | 'imperial'
}

export const ISU_TRACTOR = { tList: 110000, tPurchase: 93500, tYears: 15, tHours: 400, tClass: '150+' as TractorClass, ptoHp: 180, fuelPrice: 1, wage: 10, labourFactor: 1.1, nominal: 0.08, inflation: 0.03 }
export const ISU_DISK = { iOn: true, iList: 30000, iPurchase: 11000, iYears: 8, iHours: 100, iClass: 'otherTillage' as ImplementClass, iRepair: 'tandemDisk' as RepairKey, iHoursAtPurchase: 600, iEndAge: 13 }

export const DEFAULTS: CostParams = {
  W: 4,
  S: 8,
  overlap: 0.08,
  passes: 8,
  L: 60,
  turnFixed: 8,
  turnSpeed: 0.5,
  otherFrac: 0.08,
  feModel: true,
  FE: 0.79,
  fastForward: 4,
  ...ISU_TRACTOR,
  ...ISU_DISK,
  currency: '$',
  units: 'si',
}

interface Store extends CostParams {
  set: (p: Partial<CostParams>) => void
  reset: () => void
}

export const useCosts = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/* ------------------------------ lands pattern path ------------------------------ */

export type Seg =
  | { kind: 'pass'; index: number; z: number; dir: 1 | -1; x0: number; x1: number; t0: number; t1: number; s0: number; s1: number }
  | { kind: 'turn'; cx: number; cz: number; r: number; sigma: number; dir: 1 | -1; t0: number; t1: number; s0: number; s1: number; stop: number }

/**
 * Passes worked in a land (gathering from the centre line outward, as when ploughing in lands):
 * pass k lies at ±(⌊k/2⌋ + ½)·w_e, alternating sides and directions, joined by semicircular
 * headland turns of growing radius. The path is that of the implement centre; `t0` of a turn
 * comes after the stop for adjustments/filling taken at the end of each pass.
 */
export function buildPlan(p: Pick<CostParams, 'W' | 'S' | 'overlap' | 'passes' | 'L' | 'turnFixed' | 'turnSpeed' | 'otherFrac'>) {
  const v = p.S / 3.6
  const we = p.W * (1 - p.overlap)
  const n = Math.max(2, Math.round(p.passes / 2) * 2)
  const zs = Array.from({ length: n }, (_, k) => (k % 2 === 0 ? 1 : -1) * (Math.floor(k / 2) + 0.5) * we)
  const passTime = p.L / v
  const stop = p.otherFrac * passTime
  const segs: Seg[] = []
  const turnTimes: number[] = []
  let t = 0
  let s = 0
  for (let k = 0; k < n; k++) {
    const dir: 1 | -1 = k % 2 === 0 ? 1 : -1
    const x0 = (-dir * p.L) / 2
    const x1 = (dir * p.L) / 2
    segs.push({ kind: 'pass', index: k, z: zs[k], dir, x0, x1, t0: t, t1: t + passTime, s0: s, s1: s + p.L })
    t += passTime
    s += p.L
    if (k < n - 1) {
      const za = zs[k]
      const zb = zs[k + 1]
      const r = Math.abs(za - zb) / 2
      const arc = Math.PI * r
      const tt = arc / (v * p.turnSpeed) + p.turnFixed
      turnTimes.push(tt)
      segs.push({ kind: 'turn', cx: x1, cz: (za + zb) / 2, r, sigma: Math.sign(za - zb), dir, t0: t + stop, t1: t + stop + tt, s0: s, s1: s + arc, stop })
      t += stop + tt
      s += arc
    } else t += stop
  }
  const eff = plotEfficiency({ W: p.W, S: p.S, overlap: p.overlap, L: p.L, passes: n, turnTimes, otherFrac: p.otherFrac })
  const rMax = Math.max(...segs.map((g) => (g.kind === 'turn' ? g.r : 0)))
  return { segs, zs, n, we, total: t, length: s, eff, rMax, passTime, B: n * we, turnTimes }
}

export type Plan = ReturnType<typeof buildPlan>

/** Distance travelled along the path at plan time t (stops and lift/lower time add no distance). */
export function distAt(plan: Plan, t: number) {
  for (const g of plan.segs) {
    if (t < g.t0) return g.s0
    if (t <= g.t1) return g.s0 + ((g.s1 - g.s0) * (t - g.t0)) / (g.t1 - g.t0)
  }
  return plan.length
}

export interface PathPoint {
  x: number
  z: number
  dx: number
  dz: number
  /** turning radius (0 on straights) and steer sign (+ = left) */
  r: number
  steer: number
}

/** Position and unit heading at path distance s (straight extension beyond the ends). */
export function pointAt(plan: Plan, s: number, out: PathPoint): PathPoint {
  const segs = plan.segs
  let g = segs.find((q) => s <= q.s1 && q.s1 > q.s0) ?? segs[segs.length - 1]
  if (s < 0) g = segs[0]
  if (g.kind === 'pass') {
    out.x = g.x0 + g.dir * (s - g.s0)
    out.z = g.z
    out.dx = g.dir
    out.dz = 0
    out.r = 0
    out.steer = 0
    return out
  }
  const phi = Math.PI * Math.max(0, Math.min(1, (s - g.s0) / (g.s1 - g.s0)))
  out.x = g.cx + g.dir * g.r * Math.sin(phi)
  out.z = g.cz + g.sigma * g.r * Math.cos(phi)
  out.dx = g.dir * Math.cos(phi)
  out.dz = -g.sigma * Math.sin(phi)
  out.r = g.r
  out.steer = -g.sigma * g.dir
  return out
}

/** Index of the pass being worked at time t (−1 when turning or stopped). */
export function workingPass(plan: Plan, t: number) {
  for (const g of plan.segs) if (g.kind === 'pass' && t >= g.t0 && t <= g.t1) return g.index
  return -1
}

/** Interval [lo, hi] of x already covered by pass k at time t. */
export function covered(plan: Plan, k: number, t: number): [number, number] | null {
  const g = plan.segs.find((q) => q.kind === 'pass' && q.index === k)
  if (!g || g.kind !== 'pass' || t <= g.t0) return null
  const u = Math.min(1, (t - g.t0) / (g.t1 - g.t0))
  const x = g.x0 + (g.x1 - g.x0) * u
  return [Math.min(g.x0, x), Math.max(g.x0, x)]
}


/* ------------------------------ costs ------------------------------ */

export function costsOf(p: CostParams) {
  const i = realRate(p.nominal, p.inflation)
  const tractor = machineCosts({
    list: p.tList,
    purchase: p.tPurchase,
    years: p.tYears,
    hoursPerYear: p.tHours,
    salvagePct: tractorSalvagePct(p.tClass, p.tYears, p.tHours),
    i,
    repair: 'tractor2wd',
    ptoHp: p.ptoHp,
    fuelPrice: p.fuelPrice,
    wage: p.wage,
    labourFactor: p.labourFactor,
  })
  const implement = machineCosts({
    list: p.iList,
    purchase: p.iPurchase,
    years: p.iYears,
    hoursPerYear: p.iHours,
    salvagePct: implementSalvagePct(p.iClass, p.iEndAge),
    i,
    repair: p.iRepair,
    hoursAtPurchase: p.iHoursAtPurchase,
  })
  const combined = tractor.totalHour + (p.iOn ? implement.totalHour : 0)
  return { i, tractor, implement, combined, tSalvagePct: tractorSalvagePct(p.tClass, p.tYears, p.tHours), iSalvagePct: implementSalvagePct(p.iClass, p.iEndAge) }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = { t: 0, total: 1, area: 0, working: false, pass: 0, FEsoFar: 0 }
