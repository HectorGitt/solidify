import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { fieldCapacity, ploughDraft } from '@/physics/implements'
import { drawbarPoint, type Surface } from '@/physics/testing'
import { FARMLAND_GEARS } from '@/physics/tractor'

export const C = {
  mech: (w: string) => SRC.mech502(w),
  l27: (w: string) => SRC.l27(w),
  am: (w: string) => SRC.am502(w),
  mgmt: (w: string) => SRC.mgmt501(w),
  mac: (w: string) => SRC.mac502(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
  beyond: (w: string) => SRC.beyond(w),
}

/* ------------------------------ field and passes ------------------------------ */

/** Soil block: 32 m × 13 m. Lanes run along X between ±LANE_X; headland turns beyond. */
export const FIELD = { length: 32, width: 13, cell: 0.1 }
export const LANE_X = 11.5
export const STRIP = { z0: -5.6, z1: 5.6 }

export type ImplementId = 'none' | 'plough' | 'disc' | 'cultivator' | 'ridger'

export interface ImplementSpec {
  label: string
  /** working width, m */
  W: number
  /** default and range of working depth, m */
  depth: [number, number, number]
  /** hitch height when working (implement frames are drawn for it) */
  hw: number
  /** draft, N, for depth d and the soil's unit draft (N/cm²) */
  draft: (d: number, unit: number) => number
  note: string
  beyond: boolean
}

const BOTTOMS = 3
const BOTTOM_W = 0.35

/**
 * The plough draft is the notes' method (unit draft × furrow cross-section, AEE502 §12). The
 * other implements' drafts are typical per-metre values scaled by the same soil factor (beyond
 * the notes, which give no figures for them).
 */
export const IMPLEMENTS: Record<ImplementId, ImplementSpec> = {
  none: { label: 'Transport (no implement)', W: 2.0, depth: [0, 0, 0], hw: 0.6, draft: () => 0, note: 'Driving empty: only rolling resistance.', beyond: false },
  plough: { label: '3-bottom mouldboard plough', W: BOTTOMS * BOTTOM_W, depth: [0.12, 0.2, 0.3], hw: 0.42, draft: (d, u) => ploughDraft(u, BOTTOM_W, d, BOTTOMS), note: 'Draft = unit draft × furrow area of all bottoms.', beyond: false },
  disc: { label: 'Disc harrow (tandem)', W: 2.4, depth: [0.06, 0.1, 0.15], hw: 0.45, draft: (d, u) => 2.4 * 1800 * (d / 0.1) * (u / 2), note: 'About 1.8 kN per metre at 10 cm in clay (typical value).', beyond: true },
  cultivator: { label: 'Tine cultivator', W: 2.5, depth: [0.06, 0.12, 0.2], hw: 0.45, draft: (d, u) => 9 * 350 * (d / 0.12) * (u / 2), note: '9 tines at about 0.35 kN each at 12 cm (typical value).', beyond: true },
  ridger: { label: '3-row ridger', W: 2.25, depth: [0.1, 0.15, 0.2], hw: 0.45, draft: (d, u) => 3 * 1600 * (d / 0.15) * (u / 2), note: 'About 1.6 kN per ridging body (typical value).', beyond: true },
}

export type Gear = 3 | 5 | 7

export interface FieldParams {
  implement: ImplementId
  gear: Gear
  throttle: number
  depth: number
  /** unit draft of the soil, N/cm² (notes: sand ≈ 1, clay ≈ 2) */
  unitDraft: number
  /** cone index, kPa */
  CI: number
  internals: boolean
}

export const DEFAULTS: FieldParams = { implement: 'plough', gear: 5, throttle: 1, depth: 0.2, unitDraft: 2, CI: 860, internals: true }

interface Store extends FieldParams {
  set: (p: Partial<FieldParams>) => void
  reset: () => void
}

export const useField = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set({ ...DEFAULTS }) }))

export const surfaceOf = (p: Pick<FieldParams, 'CI'>): Surface => ({ kind: 'soil', CI: p.CI * 1000 })

/** Steady operating point with the implement in work (or raised: P = 0). */
export function operating(p: FieldParams, working = true) {
  const spec = IMPLEMENTS[p.implement]
  const P = working ? spec.draft(p.depth, p.unitDraft) : 0
  const pt = drawbarPoint({ P, q: FARMLAND_GEARS[p.gear], surface: surfaceOf(p), throttle: p.throttle })
  const Skmh = pt.V * 3.6
  return { spec, P, pt, Skmh, Cth: fieldCapacity(spec.W, Skmh) }
}

/* ------------------------------ lanes and the drive path ------------------------------ */

export interface Seg {
  kind: 'line' | 'arc'
  /** line: start x, lane z and heading h (0 = +X, π = −X); travel direction is (cos h, −sin h) in x–z */
  x: number
  z: number
  h: number
  len: number
  /** arc: half the lane spacing (signed, + towards +z) and the end it turns at (+1 = +X end) */
  r: number
  e: number
  work: boolean
}

/**
 * Lane order for a racetrack ("land") pattern: out on lane k, back on lane k + n/2, so every
 * headland turn is a half-circle of a few metres.
 */
export function lanePlan(W: number) {
  const n = Math.max(2, Math.floor((STRIP.z1 - STRIP.z0) / W))
  const half = Math.ceil(n / 2)
  const zs = Array.from({ length: n }, (_, i) => STRIP.z0 + W / 2 + i * W)
  const order: number[] = []
  for (let k = 0; k < half; k++) {
    order.push(k)
    if (k + half < n) order.push(k + half)
  }
  const segs: Seg[] = []
  for (let i = 0; i < order.length; i++) {
    const z = zs[order[i]]
    const fwd = i % 2 === 0
    segs.push({ kind: 'line', x: fwd ? -LANE_X : LANE_X, z, h: fwd ? 0 : Math.PI, len: 2 * LANE_X, r: 0, e: 0, work: true })
    if (i < order.length - 1) {
      const r = (zs[order[i + 1]] - z) / 2
      segs.push({ kind: 'arc', x: fwd ? LANE_X : -LANE_X, z, h: fwd ? 0 : Math.PI, len: Math.PI * Math.abs(r), r, e: fwd ? 1 : -1, work: false })
    }
  }
  const total = segs.reduce((t, g) => t + g.len, 0)
  return { n, zs, order, segs, total }
}

export interface PathPoint {
  x: number
  z: number
  /** heading, rad (the tractor's rotation about Y) */
  h: number
  /** turn radius (∞ on a lane) and +1 for a left turn, −1 right */
  R: number
  turn: number
  work: boolean
  /** fraction along the current segment */
  u: number
  /** index of the segment */
  i: number
}

/** Rear-axle position, heading and turn at distance s along the (looping) path. */
export function pointAt(plan: ReturnType<typeof lanePlan>, s: number): PathPoint {
  let rem = ((s % plan.total) + plan.total) % plan.total
  for (let i = 0; i < plan.segs.length; i++) {
    const g = plan.segs[i]
    if (rem > g.len && i < plan.segs.length - 1) {
      rem -= g.len
      continue
    }
    if (g.kind === 'line') return { x: g.x + Math.cos(g.h) * rem, z: g.z, h: g.h, R: Infinity, turn: 0, work: true, u: rem / g.len, i }
    // half-circle beyond the lane end, centre between the two lanes
    const R = Math.abs(g.r)
    const sgn = Math.sign(g.r)
    const phi = rem / R
    const zc = g.z + sgn * R
    return {
      x: g.e * LANE_X + g.e * R * Math.sin(phi),
      z: zc - sgn * R * Math.cos(phi),
      h: Math.atan2(-sgn * Math.sin(phi), g.e * Math.cos(phi)),
      R,
      turn: g.e * sgn,
      work: false,
      u: rem / g.len,
      i,
    }
  }
  const g = plan.segs[0]
  return { x: g.x, z: g.z, h: g.h, R: Infinity, turn: 0, work: true, u: 0, i: 0 }
}

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = {
  rpm: 0,
  V: 0,
  V0: 0,
  slip: 0,
  P: 0,
  Pd: 0,
  Pe: 0,
  fuel: 0,
  etaT: 0,
  working: false,
  /** time working and total, s; area worked, m² */
  tWork: 0,
  tTotal: 0,
  area: 0,
  stalled: false,
  spinning: false,
}

export function resetLive() {
  live.tWork = 0
  live.tTotal = 0
  live.area = 0
}
