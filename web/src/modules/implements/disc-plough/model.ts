import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { discCutWidth, discSpin, fieldCapacity, gangCutWidth, ploughPerformance, toRad } from '@/physics/tillage'

export const C = {
  am: (w: string) => SRC.am502(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
  bush: (w: string) => SRC.bush501(w),
  mgmt: (w: string) => SRC.mgmt501(w),
}

export type Implement = 'plough' | 'harrow'
export type Mode = 'field' | 'disc'

export interface DiscParams {
  implement: Implement
  mode: Mode
  /** disc angle (face to travel) and tilt angle (face to vertical), deg */
  discAngle: number
  tilt: number
  /** disc diameter, m */
  D: number
  discs: number
  depth: number
  speed: number
  unitDraft: number
  FE: number
  /** tandem harrow gang angle, deg */
  gangAngle: number
  harrowDepth: number
}

export const DEFAULTS: DiscParams = {
  implement: 'plough',
  mode: 'field',
  discAngle: 43,
  tilt: 20,
  D: 0.66,
  discs: 3,
  depth: 0.18,
  speed: 5,
  unitDraft: 2,
  FE: 0.8,
  gangAngle: 18,
  harrowDepth: 0.08,
}

export const useDisc = create<DiscParams & { set: (p: Partial<DiscParams>) => void; reset: () => void }>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set({ ...DEFAULTS }),
}))

export const live = { lowered: 0, area: 0, X: 0 }

/** floor sits HS below the hitch balls (plough) / HH (harrow) */
export const HS = 0.6
export const HH = 0.5
export const RAISED = 0.85
export const BEAM_Y = 0.2
/** harrow disc radius, spacing, discs per half-gang */
export const HARROW = { R: 0.23, spacing: 0.2, n: 6 }

export function discOf(p: DiscParams) {
  const R = p.D / 2
  const a = toRad(p.discAngle)
  const b = toRad(p.tilt)
  const w = discCutWidth(R, p.depth, a, b)
  const perf = ploughPerformance(p.unitDraft, w, p.depth, p.discs, p.speed)
  const W = w * p.discs
  const spin = (discSpin(p.speed / 3.6, R, a) * 60) / (2 * Math.PI)
  const hW = 2 * gangCutWidth(HARROW.n, HARROW.spacing, toRad(p.gangAngle))
  return { R, a, b, w, W, ...perf, spin, C: fieldCapacity(W, p.speed, p.FE), harrowW: hW, harrowC: fieldCapacity(hW, p.speed, p.FE) }
}
