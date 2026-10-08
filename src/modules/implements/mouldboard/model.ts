import { create } from 'zustand'
import { SRC, cite } from '@/content/citations'
import { centreOfDraftZ, fieldCapacity, ploughPerformance, ploughWork } from '@/physics/tillage'

export const C = {
  am: (w: string) => SRC.am502(w),
  guide1819: (w: string) => cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', w),
  bush: (w: string) => SRC.bush501(w),
  mgmt: (w: string) => SRC.mgmt501(w),
  mac: (w: string) => SRC.mac502(w),
}

/** field: three-point-mounted plough behind the tractor; bottom: one bottom close up, soil moving past it */
export type Mode = 'field' | 'bottom'
export type Pattern = 'lands' | 'round' | 'oneway'
export type Board = 'general' | 'stubble' | 'slatted'

export interface MbParams {
  mode: Mode
  bottoms: number
  /** width of cut per bottom, m */
  width: number
  /** depth of ploughing, m */
  depth: number
  /** unit draft, N/cm² */
  unitDraft: number
  /** forward speed, km/h */
  speed: number
  /** field efficiency for the capacity readout */
  FE: number
  /** suction clearances, cm */
  vSuction: number
  hSuction: number
  /** draw the suction gaps 6× larger */
  exaggerate: boolean
  board: Board
  pattern: Pattern
  /** show centre of draft, line of draft and the virtual hitch point */
  showDraft: boolean
  /** angle of the soil force below the horizontal, deg (beyond notes: typical) */
  soilAngle: number
}

export const DEFAULTS: MbParams = {
  mode: 'field',
  bottoms: 3,
  width: 0.3,
  depth: 0.18,
  unitDraft: 2,
  speed: 5,
  FE: 0.8,
  vSuction: 0.8,
  hSuction: 0.8,
  exaggerate: true,
  board: 'general',
  pattern: 'lands',
  showDraft: true,
  soilAngle: 15,
}

export const useMb = create<MbParams & { set: (p: Partial<MbParams>) => void; reset: () => void }>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set({ ...DEFAULTS }),
}))

/** Live values written by the 3D scene. */
export const live = {
  X: 0,
  lowered: 0,
  passes: 0,
  /** ploughed area this pass, m² */
  area: 0,
  /** virtual hitch point in the tractor frame */
  V: null as { x: number; y: number } | null,
  /** height of the line of draft above V, m (Macmillan Fig 6.5) */
  aboveV: 0,
  stage: 'raised' as 'raised' | 'penetrating' | 'free-link' | 'restrained' | 'lifting',
  hitchY: 0.8,
}

/* ------------------------------ layout ------------------------------ */

/** hitch-ball height above the furrow floor (the floor sits HS below the lower hitch balls) */
export const HS = 0.6
/** front share point x in the hitch frame, and fore-and-aft spacing of the bottoms */
export const X_FRONT = -0.55
export const DX = 0.7
/** right edge of the front bottom's cut (inside face of the right rear tyre, which runs in the open furrow) */
export const Z_RIGHT = -0.52
/** frame (beam) height in the hitch frame */
export const BEAM_Y = 0.15
export const RAISED = 0.85

/** Landside z of bottom i (the bottom cuts from z − w to z). Front bottom (i = 0) is the rightmost. */
export const landsideZ = (i: number, w: number) => Z_RIGHT + (i + 1) * w
export const bottomX = (i: number) => X_FRONT - i * DX

/** Centre of draft of one bottom: about 5 cm in from the landside at the top of the share (AEE502 §12.3). */
export const CD_IN = 0.05

export function draftOf(p: Pick<MbParams, 'bottoms' | 'width' | 'depth' | 'unitDraft' | 'speed' | 'FE'>) {
  const r = ploughPerformance(p.unitDraft, p.width, p.depth, p.bottoms, p.speed)
  const W = p.bottoms * p.width
  const zCD = centreOfDraftZ(Array.from({ length: p.bottoms }, (_, i) => landsideZ(i, p.width)), CD_IN)
  return { ...r, W, C: fieldCapacity(W, p.speed, p.FE), Ct: fieldCapacity(W, p.speed, 1), zCD, work: ploughWork(r.D, W, 1) }
}

/** Shown suction (m) — exaggerated 6× when asked so the gap is visible. */
export const shownSuction = (cm: number, exaggerate: boolean) => (cm / 100) * (exaggerate ? 6 : 1)
