import { create } from 'zustand'
import { cite, SRC } from '@/content/citations'
import {
  dampingRatio,
  forcedAmplitude,
  forcedPhase,
  isolationEfficiency,
  magnification,
  naturalFrequency,
  transmissibility,
  transmissibilityPhase,
  unbalanceForce,
} from '@/physics/vibration'

/**
 * Machine on four isolators over a concrete foundation. Frame: metres, Y up, origin on the floor
 * under the centre of the foundation. The machine moves vertically only (one DOF, as in the notes).
 */
export const DIM = {
  foundationTop: 0.3,
  /** isolator free height at equilibrium */
  mountH: 0.17,
  mountX: 0.6,
  mountZ: 0.34,
  frameT: 0.05,
  /** displayed motion = real motion × GAIN (clamped) */
  gain: 8,
  maxShow: 0.05,
}
export const FRAME_Y = DIM.foundationTop + DIM.mountH

export const C = {
  ln: (w: string) => SRC.ln518(w),
  m12: (w: string) => SRC.m503(12, w),
  q16: (w?: string) => cite('AEE518', 'AEE  518 Q-2016-2017.doc', w),
  mg16: (w?: string) => cite('AEE518', 'AEE 518 MARKING GUIDE -2016-2017 SESSION.docx', w),
  mg18: (w?: string) => cite('AEE518', 'AEE 518  2018-2019-Marking Guide.doc', w),
  he: (w: string) => SRC.he510(w),
}

export type Machine = 'compressor' | 'hopper'
export type ForceKind = 'unbalance' | 'constant'

export interface IsoParams {
  machine: Machine
  /** vibrating mass, kg */
  M: number
  /** total isolator stiffness, N/m */
  k: number
  /** total isolator damping, N·s/m */
  c: number
  force: ForceKind
  /** unbalance (reciprocating) mass, kg, and its eccentricity (crank radius), m */
  mu: number
  e: number
  /** force amplitude when constant, N */
  F0: number
  /** frequency ratio r = ω/ω_n */
  r: number
  /** design target for the isolator selection */
  targetTR: number
}

const compressorK = 450 * (183.26 / 2.7207) ** 2

export const COMPRESSOR: IsoParams = {
  machine: 'compressor',
  M: 450,
  k: Math.round(compressorK),
  c: Number((0.15 * 2 * Math.sqrt(compressorK * 450)).toPrecision(5)),
  force: 'unbalance',
  mu: 10,
  e: 0.1,
  F0: 75,
  r: 2.7207,
  targetTR: 0.2,
}

export const HOPPER: IsoParams = {
  machine: 'hopper',
  M: 400,
  k: 39.5e6,
  c: 100,
  force: 'constant',
  mu: 0.5,
  e: 0.02,
  F0: 75,
  r: (2 * Math.PI * 50) / Math.sqrt(39.5e6 / 400),
  targetTR: 0.2,
}

export const DEFAULTS = COMPRESSOR

interface Store extends IsoParams {
  set: (p: Partial<IsoParams>) => void
  reset: () => void
}

export const useIso = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export interface IsoResult {
  wn: number
  zeta: number
  w: number
  rpm: number
  F0: number
  MF: number
  TR: number
  X: number
  phase: number
  phaseT: number
  FT: number
  eff: number
}

export function analyse(p: IsoParams): IsoResult {
  const wn = naturalFrequency(p.k, p.M)
  const zeta = dampingRatio(p.c, p.k, p.M)
  const w = p.r * wn
  const F0 = p.force === 'unbalance' ? unbalanceForce(p.mu, p.e, w) : p.F0
  const TR = transmissibility(p.r, zeta)
  return {
    wn,
    zeta,
    w,
    rpm: (w * 60) / (2 * Math.PI),
    F0,
    MF: magnification(p.r, zeta),
    TR,
    X: forcedAmplitude(F0, p.M, p.c, p.k, w),
    phase: forcedPhase(p.M, p.c, p.k, w),
    phaseT: transmissibilityPhase(p.r, zeta),
    FT: TR * F0,
    eff: isolationEfficiency(TR),
  }
}

export const live = { theta: 0, x: 0, F: 0, FT: 0 }

