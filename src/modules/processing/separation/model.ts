import { create } from 'zustand'
import {
  averageSizeMm,
  
  cumulativeOversize,
  cycloneCriticalDiameter,
  cycloneForces,
  finenessModulus,
  IS_SIEVES,
  percentRetained,
  reynolds,
  screenEffectiveness,
  screenSplit,
  stokesVelocity,
  terminalVelocity,
  uniformityIndex,
} from '@/physics/processing'

export type Kind = 'all' | 'cleaner' | 'aspirator' | 'cyclone' | 'shaker'

export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export interface SeparationParams {
  kind: Kind

  /* Oscillating screen cleaner (SEP eqs 1–9) */
  feedRateKgS: number
  XF: number
  XA: number
  XB: number
  screenSlopeDeg: number
  screenRpm: number
  screenStrokeMm: number
  cutMeshMm: number

  /* Aspirator / Winnower (SEP eqs 1–12) */
  airVelocity: number
  grainDiameterMm: number
  grainDensity: number
  chaffDiameterMm: number
  chaffDensity: number
  airDensity: number
  airViscosity: number

  /* Cyclone separator (SEP eqs 13–17) */
  cycloneVelocity: number
  cycloneRadius: number
  cycloneInletWidth: number
  cycloneTurns: number
  cycloneParticleDensity: number
  cycloneParticleWeight: number

  /* Sieve shaker (RED / IS sieves) */
  shakerRpm: number
  sampleMassG: number
  retainedMasses: number[] // 8 values: IS 100, 70, 50, 40, 30, 20, 15, Pan
}

/** Default 250 g sample from RED worked example */
export const DEFAULT_RETAINED_RED = [2.5, 6.25, 17.5, 60.0, 88.75, 56.25, 18.75, 0] // % = 1, 2.5, 7, 24, 35.5, 22.5, 7.5, 0

export const DEFAULTS: SeparationParams = {
  kind: 'cleaner',

  /* Screen cleaner: typical 2-deck grain cleaner */
  feedRateKgS: 1.5, // ~5.4 t/h
  XF: 0.4,
  XA: 0.94,
  XB: 0.05,
  screenSlopeDeg: 6,
  screenRpm: 320,
  screenStrokeMm: 12,
  cutMeshMm: 3.2,

  /* Aspirator: grain 4 mm @ 1300 kg/m³, chaff 1.8 mm @ 240 kg/m³ */
  airVelocity: 4.5, // between chaff Vt (~2.4 m/s) and grain Vt (~8.5 m/s)
  grainDiameterMm: 4.0,
  grainDensity: 1300,
  chaffDiameterMm: 1.8,
  chaffDensity: 240,
  airDensity: 1.2,
  airViscosity: 1.81e-5,

  /* Cyclone: R = 0.25 m, V = 18 m/s, b = 0.08 m */
  cycloneVelocity: 18.0,
  cycloneRadius: 0.25,
  cycloneInletWidth: 0.08,
  cycloneTurns: 5,
  cycloneParticleDensity: 1250,
  cycloneParticleWeight: 1.0,

  /* Sieve shaker: RED worked example (FM = 3.12, UI = 1:6:3) */
  shakerRpm: 280,
  sampleMassG: 250,
  retainedMasses: [...DEFAULT_RETAINED_RED],
}

interface Store extends SeparationParams {
  set: (p: Partial<SeparationParams>) => void
  reset: () => void
}

export const useSeparation = create<Store>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/** Live animated state for R3F frame loop */
export const live = {
  cleanerAngle: 0,
  cleanerDispX: 0,
  cleanerDispY: 0,
  shakerOrbX: 0,
  shakerOrbZ: 0,
  fanAngle: 0,
  cycloneSpinAngle: 0,
}

export function analyse(p: SeparationParams) {
  // 1. Screen cleaner analysis (SEP eqs 1–9)
  const safeXF = Math.max(p.XB + 1e-4, Math.min(p.XA - 1e-4, p.XF))
  const split = screenSplit(safeXF, p.XA, p.XB)
  const eff = screenEffectiveness(safeXF, p.XA, p.XB)
  const overflowRate = p.feedRateKgS * split.AF
  const underflowRate = p.feedRateKgS * split.BF

  // 2. Aspirator aerodynamics (SEP eqs 1–12)
  const dGrainM = p.grainDiameterMm * 1e-3
  const dChaffM = p.chaffDiameterMm * 1e-3

  const vtGrainStokes = stokesVelocity(dGrainM, p.grainDensity, p.airDensity, p.airViscosity)
  const vtChaffStokes = stokesVelocity(dChaffM, p.chaffDensity, p.airDensity, p.airViscosity)

  const vtGrain = terminalVelocity(dGrainM, p.grainDensity, p.airDensity, p.airViscosity)
  const vtChaff = terminalVelocity(dChaffM, p.chaffDensity, p.airDensity, p.airViscosity)

  const reGrain = reynolds(dGrainM, vtGrain, p.airDensity, p.airViscosity)
  const reChaff = reynolds(dChaffM, vtChaff, p.airDensity, p.airViscosity)

  // Net relative velocity in vertical duct:
  // Grain falls if Vt > Vair (net downward speed = Vt - Vair)
  // Chaff is lifted if Vair > Vt (net upward speed = Vair - Vt)
  const grainNetDown = vtGrain - p.airVelocity
  const chaffNetUp = p.airVelocity - vtChaff

  const aspiratorStatus: 'under' | 'ideal' | 'over' =
    p.airVelocity < vtChaff ? 'under' : p.airVelocity > vtGrain ? 'over' : 'ideal'

  // 3. Cyclone separator (SEP eqs 13–17)
  const cForces = cycloneForces(p.cycloneVelocity, p.cycloneRadius, p.cycloneParticleWeight)
  const deltaRho = Math.max(1, p.cycloneParticleDensity - p.airDensity)
  const dCritM = cycloneCriticalDiameter(
    p.airViscosity,
    p.cycloneInletWidth,
    p.cycloneTurns,
    p.cycloneVelocity,
    deltaRho,
  )
  const dCritUm = dCritM * 1e6

  // 4. Sieve shaker analysis (RED)
  const pctRetained = percentRetained(p.retainedMasses)
  const fm = finenessModulus(pctRetained)
  const avgSizeMm = averageSizeMm(fm)
  const ui = uniformityIndex(pctRetained)

  // Cumulative oversize array for charting (sieves 0…7)
  const cumOversize = IS_SIEVES.map((_, i) => cumulativeOversize(pctRetained, i))

  return {
    split,
    eff,
    overflowRate,
    underflowRate,
    dGrainM,
    dChaffM,
    vtGrainStokes,
    vtChaffStokes,
    vtGrain,
    vtChaff,
    reGrain,
    reChaff,
    grainNetDown,
    chaffNetUp,
    aspiratorStatus,
    cForces,
    dCritM,
    dCritUm,
    pctRetained,
    fm,
    avgSizeMm,
    ui,
    cumOversize,
  }
}
