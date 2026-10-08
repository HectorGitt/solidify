import { create } from 'zustand'
import { cite } from '@/content/citations'
import { cylinder, ramSizing, strokeTime } from '@/physics/hydraulics'

/** The two AEE502 marking guides that carry the hydraulics questions. */
export const MG1617 = (where?: string) => cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', where)
export const MG1718 = (where?: string) => cite('AEE502', 'AEE 502 -2017-2018-marking scheme.docx', where)

/**
 * Double-acting hydraulic cylinder (AEE502 marking guides: barrel, piston, seals, rod, two oil
 * ports, clevis eyes). Frame: axis along +X, cap end at x = 0, rod leaves to +X, metres.
 *
 * The 3D model is drawn at a reference bore and scaled radially with the bore slider; the rod,
 * gland and annulus oil are rebuilt for the chosen rod diameter. The drawn stroke is fixed.
 */
export const DIM = {
  refBore: 0.08,
  wall: 0.009,
  /** drawn stroke (the stroke slider only changes the ram-sizing working) */
  stroke: 0.3,
  pistonW: 0.046,
  glandIn: 0.034,
  glandOut: 0.022,
  capT: 0.026,
  /** end clearance (cushion) at each end of the stroke */
  margin: 0.006,
  portR: 0.0065,
  portBossR: 0.014,
  portBossH: 0.016,
  rodOverhang: 0.075,
}

export const REF_R = DIM.refBore / 2
export const REF_RO = REF_R + DIM.wall
/** inside length of the barrel, cap face to gland face */
export const BARREL_IN = DIM.margin + DIM.stroke + DIM.pistonW + DIM.margin
export const BARREL_LEN = BARREL_IN + DIM.glandIn
/** port centres along X */
export const PORT_CAP_X = DIM.margin + 0.004
export const PORT_ROD_X = BARREL_IN - 0.012
/** piston cap-side face at full retraction */
export const X0 = DIM.margin
export const ROD_LEN = BARREL_IN - DIM.margin - DIM.pistonW + DIM.glandIn + DIM.glandOut + DIM.rodOverhang

export type Motion = 'cycle' | 'extend' | 'retract' | 'hold'
export type Acting = 'double' | 'single'

export interface CylParams {
  /** m */
  bore: number
  rod: number
  /** relief / system pressure, MPa */
  p: number
  /** pump flow, L/min */
  Q: number
  /** external load resisting extension (+) — kN */
  load: number
  /** stroke used in the ram-sizing working, m */
  stroke: number
  /** time to make that stroke, s */
  time: number
  motion: Motion
  /** double-acting (powered both ways) or single-acting (returns under the load) */
  acting: Acting
  flows: boolean
}

export const DEFAULTS: CylParams = { bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13, load: 20, stroke: 0.2, time: 2, motion: 'cycle', acting: 'double', flows: true }

interface Store extends CylParams {
  set: (p: Partial<CylParams>) => void
  reset: () => void
}

export const useCyl = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) =>
    set((s) => {
      const next = { ...s, ...p }
      // keep the rod inside the bore
      if (next.rod > next.bore * 0.85) next.rod = next.bore * 0.85
      return next
    }),
  reset: () => set(DEFAULTS),
}))

export function compute(p: Pick<CylParams, 'bore' | 'rod' | 'p' | 'Q' | 'load' | 'stroke' | 'time'>) {
  const c = cylinder(p.bore, p.rod, p.p * 1e6, p.Q)
  const loadN = p.load * 1000
  const pExtend = loadN / c.areaCap
  const pRetract = Math.max(0, -loadN / c.areaAnnulus)
  return {
    c,
    loadN,
    /** pressure the load needs on each stroke, Pa */
    pExtend,
    pRetract,
    stallExtend: pExtend > p.p * 1e6,
    stallRetract: pRetract > p.p * 1e6,
    tExtend: strokeTime(c.areaCap, DIM.stroke, p.Q),
    tRetract: strokeTime(c.areaAnnulus, DIM.stroke, p.Q),
    ram: ramSizing(p.stroke, p.bore, loadN, p.time),
    ratio: c.areaCap / c.areaAnnulus,
  }
}

export type Phase = 'extending' | 'retracting' | 'holding' | 'stalled'

export interface LiveCyl {
  /** piston travel from full retraction, m (0…stroke) */
  x: number
  phase: Phase
  /** m/s, + = extending */
  v: number
  /** pressure at cap port / rod port, MPa */
  pCap: number
  pRod: number
  /** flow in at the pressure port / out at the return port, L/min */
  qIn: number
  qOut: number
  /** valve spool position: +1 extend (P→A), 0 centre (all ports blocked), −1 retract (P→B) */
  valve: number
}

export const live: LiveCyl = { x: 0, phase: 'holding', v: 0, pCap: 0, pRod: 0, qIn: 0, qOut: 0, valve: 0 }

/** Direction-control valve (4-port, 3-position, closed centre) placed beside the cylinder. */
export const VALVE = { x: -0.15, h: 0.15, portA: -0.02, portB: 0.04, portP: 0.01, portT: -0.05, shift: 0.015 }
