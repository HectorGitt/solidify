import { create } from 'zustand'
import {
  
  averageSizeMm,
  bondEnergy,
  finenessModulus,
  kickEnergy,
  percentRetained,
  reductionRatio,
  rittingerEnergy,
  
  uniformityIndex,
  type Law,
} from '@/physics/processing'

export type MachineKind = 'hammer' | 'burr' | 'roller' | 'shaker'

export interface SizeReductionParams {
  machine: MachineKind
  law: Law
  /** Feed material name */
  feedName: string
  /** Initial feed particle size L1 in mm */
  L1: number
  /** Product target size L2 in mm */
  L2: number
  /** Feed rate in kg/h */
  feedRateKgH: number
  /** Motor rated power in kW */
  motorPowerKw: number
  /** Bond work index Wi in J/kg */
  Wi: number
  /** Kick constant Ck in J/kg */
  Ck: number
  /** Rittinger constant Cr in J·mm/kg */
  Cr: number

  /* Hammer mill specific */
  hammerRpm: number
  screenHoleMm: number
  hammerCount: number
  aspiratorOn: boolean

  /* Burr (plate) mill specific */
  burrRpm: number
  burrGapMm: number
  springPreloadN: number

  /* Roller mill specific */
  rollRpm: number
  rollGapMm: number
  rollRatio: number
  fluted: boolean

  /* Sieve analysis specific */
  sieveRetainedG: number[]
  shakerActive: boolean
}

/** Default sieve masses corresponding to PQ p1 Q3c Setting 1 (250g total) */
export const DEFAULT_SIEVE_G = [0, 6.8, 16.5, 40.1, 86.2, 91.0, 7.3, 2.1]

export const DEFAULTS: SizeReductionParams = {
  machine: 'hammer',
  law: 'rittinger',
  feedName: 'Sorghum grain',
  L1: 4.3,
  L2: 0.337,
  feedRateKgH: 450,
  motorPowerKw: 6.5,
  Wi: 55000,
  Ck: 45000,
  Cr: 12000,

  hammerRpm: 2800,
  screenHoleMm: 1.5,
  hammerCount: 16,
  aspiratorOn: true,

  burrRpm: 500,
  burrGapMm: 0.8,
  springPreloadN: 1200,

  rollRpm: 450,
  rollGapMm: 0.4,
  rollRatio: 1.5,
  fluted: true,

  sieveRetainedG: DEFAULT_SIEVE_G,
  shakerActive: true,
}

interface SizeReductionStore extends SizeReductionParams {
  set: (p: Partial<SizeReductionParams>) => void
  reset: () => void
  setSieveG: (index: number, g: number) => void
}

export const useSizeReduction = create<SizeReductionStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
  setSieveG: (index, g) =>
    set((state) => {
      const next = [...state.sieveRetainedG]
      next[index] = Math.max(0, g)
      return { sieveRetainedG: next }
    }),
}))

/* ------------------------------ Pure analysis helpers ------------------------------ */

export interface SieveResult {
  pct: number[]
  totalMassG: number
  FM: number
  averageD: number
  UI: {
    coarse: number
    medium: number
    fine: number
    ratio: [number, number, number]
  }
}

export function analyseSieves(massesG: number[]): SieveResult {
  const pct = percentRetained(massesG)
  const totalMassG = massesG.reduce((a, b) => a + b, 0)
  const FM = finenessModulus(pct)
  const averageD = averageSizeMm(FM)
  const UI = uniformityIndex(pct)
  return { pct, totalMassG, FM, averageD, UI }
}

export interface EnergyAnalysis {
  RR: number
  E_kick: number
  E_rittinger: number
  E_bond: number
  powerRequiredKw: number
  motorLoadPercent: number
  adequate: boolean
}

export function analyseEnergy(p: SizeReductionParams): EnergyAnalysis {
  const RR = reductionRatio(p.L1, p.L2)
  const E_kick = kickEnergy(p.Ck, p.L1, p.L2)
  const E_rittinger = rittingerEnergy(p.Cr, p.L1, p.L2)
  // Bond uses d in micrometres (mm * 1000)
  const d1_um = p.L1 * 1000
  const d2_um = p.L2 * 1000
  const E_bond = bondEnergy(p.Wi, d1_um, d2_um)

  const specificE = p.law === 'kick' ? E_kick : p.law === 'rittinger' ? E_rittinger : E_bond
  const kgPerSec = p.feedRateKgH / 3600
  const powerW = specificE * kgPerSec
  const powerRequiredKw = powerW / 1000
  const motorLoadPercent = (powerRequiredKw / Math.max(0.01, p.motorPowerKw)) * 100
  const adequate = powerRequiredKw <= p.motorPowerKw

  return {
    RR,
    E_kick,
    E_rittinger,
    E_bond,
    powerRequiredKw,
    motorLoadPercent,
    adequate,
  }
}

/* ------------------------------ Live Animation State (3D -> Panels) ------------------------------ */

export interface LiveState {
  hammerAngle: number
  burrAngle: number
  roller1Angle: number
  roller2Angle: number
  shakerPhase: number
  feedFlowRate: number
  productParticleCount: number
  hammerTipSpeedMs: number
  burrRimSpeedMs: number
  rollerNipSpeedMs: number
}

export const live: LiveState = {
  hammerAngle: 0,
  burrAngle: 0,
  roller1Angle: 0,
  roller2Angle: 0,
  shakerPhase: 0,
  feedFlowRate: 1,
  productParticleCount: 0,
  hammerTipSpeedMs: 0,
  burrRimSpeedMs: 0,
  rollerNipSpeedMs: 0,
}
