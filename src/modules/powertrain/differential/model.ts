import { create } from 'zustand'
import { bevelPair } from '@/geometry/parts'
import { type DiffCase } from '@/physics/drives'
import { GEAR_PAIR_EFFICIENCY, crownWheelRatio, diffTorqueSplit } from '@/physics/transmission'

/**
 * Rear-axle crown wheel, pinion and bevel differential.
 * Frame: metres, Y up, half shafts along X (left wheel at +X when facing forward, +Z),
 * bevel pinion along Z coming from the gearbox at +Z. Origin = differential centre, which is
 * also the common apex of every bevel gear.
 */
export const DIM = {
  /** crown wheel & pinion (TTS p7: small pinion, large crown wheel, big reduction) */
  zPinion: 11,
  zCrown: 47,
  crownModule: 0.0065,
  crownFace: 0.04,
  /** side (sun / half-shaft) gears and planet (spider) pinions */
  zSide: 16,
  zSpider: 10,
  diffModule: 0.006,
  diffFace: 0.022,
  /** differential cage */
  caseOuter: 0.072,
  caseInner: 0.064,
  caseHalfLength: 0.07,
  /** half shafts */
  shaftR: 0.016,
  shaftEnd: 0.6,
  /** display wheels (small, to keep the gears in view) */
  wheelX: 0.7,
  tyreR: 0.3,
  /** real tractor track used for the cornering kinematics, m (TTS p16: 1.42–2.13 m) */
  track: 1.5,
  /** diff-lock dog collar on the left half shaft */
  lockX: 0.125,
  lockTravel: 0.022,
}

export const CROWN_ANGLES = bevelPair(DIM.zPinion, DIM.zCrown)
export const DIFF_ANGLES = bevelPair(DIM.zSpider, DIM.zSide)
export const R_PINION = (DIM.zPinion * DIM.crownModule) / 2
export const R_CROWN = (DIM.zCrown * DIM.crownModule) / 2
export const R_SIDE = (DIM.zSide * DIM.diffModule) / 2
export const R_SPIDER = (DIM.zSpider * DIM.diffModule) / 2
const rad = (d: number) => (d * Math.PI) / 180
/** distance from the apex to each gear's large end */
export const APEX = {
  pinion: R_PINION / Math.tan(rad(CROWN_ANGLES.pinion)),
  crown: R_CROWN / Math.tan(rad(CROWN_ANGLES.gear)),
  side: R_SIDE / Math.tan(rad(DIFF_ANGLES.gear)),
  spider: R_SPIDER / Math.tan(rad(DIFF_ANGLES.pinion)),
}
export const CROWN_RATIO = crownWheelRatio(DIM.zPinion, DIM.zCrown)

/* ------------------------------ Parameters ------------------------------ */

export interface DiffParams {
  mode: DiffCase
  locked: boolean
  /** bevel pinion speed from the gearbox, rpm */
  pinionRpm: number
  /** pinion torque, N·m */
  pinionTorque: number
  /** turning radius to the tractor centre line, m */
  turnRadius: number
  /** 2 or 4 planet pinions */
  spiders: 2 | 4
  /** torque the mud can take at the right wheel (grip limit), N·m at the half shaft */
  mudGrip: number
}

export const DEFAULTS: DiffParams = { mode: 'straight', locked: false, pinionRpm: 600, pinionTorque: 600, turnRadius: 5, spiders: 4, mudGrip: 250 }

interface DiffStore extends DiffParams {
  set: (p: Partial<DiffParams>) => void
  reset: () => void
}

export const useDiff = create<DiffStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------------------ Live values ------------------------------ */

export interface LiveDiff {
  pinion: number
  cage: number
  left: number
  right: number
  /** planet pinion spin relative to the cage, rpm */
  spider: number
  /** 0…1 lock collar engagement */
  lock: number
}

export const live: LiveDiff = { pinion: 0, cage: 0, left: 0, right: 0, spider: 0, lock: 0 }

/**
 * Torque at each half shaft. The open diff always splits torque equally, so both sides are
 * capped by the wheel with less grip (mud); with the lock the firm wheel takes the rest.
 */
export function halfShaftTorques(p: Pick<DiffParams, 'mode' | 'locked' | 'pinionTorque' | 'mudGrip'>) {
  const Tc = p.pinionTorque * CROWN_RATIO * GEAR_PAIR_EFFICIENCY
  const s = diffTorqueSplit(Tc, p.locked, Infinity, p.mode === 'mud' ? p.mudGrip : Infinity)
  return { Tc, left: s.left, right: s.right, delivered: s.delivered }
}

export const rpm = (omega: number) => (omega * 60) / (2 * Math.PI)
export const radps = (n: number) => (n * 2 * Math.PI) / 60
