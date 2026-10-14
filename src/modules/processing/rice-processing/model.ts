import { create } from 'zustand'

export type RiceRoute = 'raw' | 'parboiled'
export type GrainVariety = 'long' | 'medium' | 'short'

export interface VarietySpec {
  name: string
  aspectRatio: string
  lengthWidthRatio: number
  amylosePct: string
  grainLengthMm: number
  cookingCharacteristic: string
  baseHuskPct: number
  breakageSensitivity: number
}

/**
 * Grain classifications from RICE 101.pdf (p12):
 * - Long grain: L/W > 3:1, amylose 19–23%, cook separate and fluffy.
 * - Medium grain: L/W 2.0–2.9:1, amylose 12–19%, moist, tender and cling.
 * - Short grain: L/W < 2.0:1, amylose 12–19%, plump, almost round.
 */
export const GRAIN_VARIETIES: Record<GrainVariety, VarietySpec> = {
  long: {
    name: 'Long Grain',
    aspectRatio: '> 3.0 : 1',
    lengthWidthRatio: 3.2,
    amylosePct: '19–23 %',
    grainLengthMm: 6.8,
    cookingCharacteristic: 'Separate, fluffy, dry grains',
    baseHuskPct: 20.5,
    breakageSensitivity: 1.0,
  },
  medium: {
    name: 'Medium Grain',
    aspectRatio: '2.0–2.9 : 1',
    lengthWidthRatio: 2.4,
    amylosePct: '12–19 %',
    grainLengthMm: 5.6,
    cookingCharacteristic: 'Moist, tender, semi-sticky',
    baseHuskPct: 19.8,
    breakageSensitivity: 0.82,
  },
  short: {
    name: 'Short Grain',
    aspectRatio: '< 2.0 : 1',
    lengthWidthRatio: 1.8,
    amylosePct: '12–19 %',
    grainLengthMm: 4.8,
    cookingCharacteristic: 'Plump, sticky, compact',
    baseHuskPct: 19.0,
    breakageSensitivity: 0.70,
  },
}

export interface RiceParams {
  route: RiceRoute
  variety: GrainVariety
  /** Paddy feed rate into mill, kg/h */
  paddyFeedRate: number
  /** Impurities/dockage removed during pre-cleaning, % */
  dockagePct: number

  // Parboiling parameters
  /** Soaking water temperature, °C (typically 60–75 °C) */
  parboilSoakTemp: number
  /** Steam pressure in autoclave retort, bar (typically 1.0–2.5 bar) */
  parboilSteamPressure: number
  /** Drying target moisture content, % (typically 12–13 %) */
  dryingTargetMcPct: number

  // Rubber-roll huller parameters
  /** Fast roll speed, rpm */
  hullerFastRpm: number
  /** Differential speed ratio k = vFast / vSlow (typically 1.20–1.28) */
  hullerRatio: number
  /** Nip clearance gap between rubber rolls, mm (typically 0.7–1.0 mm) */
  hullerGapMm: number
  /** Outer diameter of rubber rolls, m (standard 8.8" = 0.222 m) */
  rollDiameterM: number

  // Polishing / Whitening
  /** Degree of milling (DOM): bran removed from brown rice, % (typical 8.0–9.5 %) */
  degreeOfMillingPct: number

  // Separation & Aspiration
  /** Winnowing air velocity in aspirator trunk, m/s (between husk and grain Vt) */
  aspiratorAirV: number

  // Display filter
  focusedStage: 'all' | 'cleaning' | 'parboiling' | 'hulling' | 'polishing' | 'grading'
}

export const DEFAULTS: RiceParams = {
  route: 'raw',
  variety: 'long',
  paddyFeedRate: 1000,
  dockagePct: 2.0,
  parboilSoakTemp: 65,
  parboilSteamPressure: 1.5,
  dryingTargetMcPct: 12.5,
  hullerFastRpm: 1300,
  hullerRatio: 1.24,
  hullerGapMm: 0.8,
  rollDiameterM: 0.222,
  degreeOfMillingPct: 8.5,
  aspiratorAirV: 4.5,
  focusedStage: 'all',
}

interface RiceStore extends RiceParams {
  set: (p: Partial<RiceParams>) => void
  reset: () => void
}

export const useRice = create<RiceStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

export interface MillingAnalysis {
  // Equipment kinematics
  vFast: number
  vSlow: number
  vDiff: number
  hullerSlowRpm: number

  // Parboiling indicators
  isGelatinized: boolean
  gelatinizationIndex: number
  thiamineRetentionPct: number
  hardnessIndex: number

  // Mass balances (kg/h)
  paddyIn: number
  impuritiesOut: number
  cleanPaddy: number
  huskOut: number
  brownRice: number
  branOut: number
  totalMilledRice: number

  // Graded fractions (kg/h)
  headRice: number
  secondHeads: number
  screenings: number
  brewers: number
  totalBrokens: number

  // Yield percentages relative to initial paddy (%)
  huskYieldPct: number
  brownRiceYieldPct: number
  branYieldPct: number
  totalMilledYieldPct: number
  headRiceYieldPct: number // HRY
  totalBrokensYieldPct: number
  secondHeadsYieldPct: number
  screeningsYieldPct: number
  brewersYieldPct: number

  // Breakage breakdown
  hullingBreakagePct: number
  polishingBreakagePct: number
  totalBreakagePct: number

  // Aerodynamic aspiration
  terminalVelocityHusk: number
  terminalVelocityRice: number
  huskLiftEfficiencyPct: number
}

/**
 * Pure physics & engineering mass-balance calculation for the rice milling line.
 */
export function analyseRiceProcessing(p: RiceParams): MillingAnalysis {
  const spec = GRAIN_VARIETIES[p.variety]
  const PI = Math.PI

  // 1. Rubber-roll huller kinematics
  const rM = p.rollDiameterM / 2
  const vFast = (2 * PI * rM * p.hullerFastRpm) / 60
  const hullerSlowRpm = p.hullerFastRpm / Math.max(1.05, p.hullerRatio)
  const vSlow = (2 * PI * rM * hullerSlowRpm) / 60
  const vDiff = vFast - vSlow

  // 2. Parboiling state
  let gelatinizationIndex = 0
  let isGelatinized = false
  let thiamineRetentionPct = 18 // raw white rice retains only 15-20% of B-vitamins
  let hardnessIndex = 1.0

  if (p.route === 'parboiled') {
    // Requires soak temp >= 60°C and steam pressure >= 1.0 bar (saturation temp >= 120°C)
    const soakScore = Math.min(1, Math.max(0, (p.parboilSoakTemp - 50) / 15))
    const steamScore = Math.min(1, Math.max(0, (p.parboilSteamPressure - 0.5) / 1.0))
    // Drying MC factor: drying too fast (<11% or >15%) causes thermal check fissures
    const dryCheckFactor = Math.max(0.5, 1 - Math.abs(p.dryingTargetMcPct - 12.5) * 0.15)

    gelatinizationIndex = Math.min(1, soakScore * steamScore)
    isGelatinized = gelatinizationIndex >= 0.85
    thiamineRetentionPct = 20 + gelatinizationIndex * 55 // up to ~75% retention
    hardnessIndex = 1.0 + gelatinizationIndex * 0.8 * dryCheckFactor
  }

  // 3. Pre-cleaning mass balance
  const paddyIn = p.paddyFeedRate
  const dockageFrac = Math.max(0, Math.min(0.1, p.dockagePct / 100))
  const impuritiesOut = paddyIn * dockageFrac
  const cleanPaddy = paddyIn - impuritiesOut

  // 4. Shelling / Hulling
  // Optimal roll nip gap is ~0.75-0.85 mm. Excessive tightness crushes; excessive looseness lowers efficiency.
  const gapPenalty = Math.max(0, (0.75 - p.hullerGapMm) * 8)

  const rawHullerBreakage = (2.8 + gapPenalty) * spec.breakageSensitivity
  // Gelatinization seals internal fissures and hardens kernel: reduces hulling breakage drastically!
  const hullingBreakagePct = p.route === 'parboiled'
    ? Math.max(0.4, (rawHullerBreakage / (1 + gelatinizationIndex * 3.5)))
    : rawHullerBreakage

  const huskFrac = (spec.baseHuskPct / 100)
  const huskOut = cleanPaddy * huskFrac
  const brownRice = cleanPaddy - huskOut

  // 5. Husk Separation Aerodynamics (Stokes / drag terminal velocities per SEP Note 1)
  // Husk: low density, flat high drag area -> Vt ~2.5 m/s
  // Brown rice: dense rounded granule -> Vt ~7.2 m/s
  const terminalVelocityHusk = 2.5
  const terminalVelocityRice = 7.2
  // Aspirator air speed efficiency: air speed must be between 3.5 and 5.5 m/s
  const huskLiftEfficiencyPct = Math.min(99.8, Math.max(70, (p.aspiratorAirV / terminalVelocityHusk) * 60))

  // 6. Polishing / Whitening
  const domFrac = Math.max(0, Math.min(0.15, p.degreeOfMillingPct / 100))
  const branOut = brownRice * domFrac
  const totalMilledRice = brownRice - branOut

  // Milling breakage: abrasive and friction friction stresses crack grains
  // Increases with higher degree of milling (DOM) and slender grain aspect ratio
  const rawMillingBreakage = (5.0 + (p.degreeOfMillingPct - 5) * 1.5) * spec.breakageSensitivity
  const polishingBreakagePct = p.route === 'parboiled'
    ? Math.max(1.2, rawMillingBreakage / (1 + gelatinizationIndex * 3.0))
    : Math.max(3.0, rawMillingBreakage)

  const totalBreakagePct = Math.min(45, hullingBreakagePct + polishingBreakagePct)
  const brokenFrac = totalBreakagePct / 100
  const totalBrokens = totalMilledRice * brokenFrac
  const headRice = totalMilledRice - totalBrokens

  // 7. Graded fractions (RICE 101 p12)
  // Second heads: 1/2–3/4 length (~55% of brokens)
  // Screenings: 1/4–1/2 length (~30% of brokens)
  // Brewers: < 1/4 length (~15% of brokens)
  const secondHeads = totalBrokens * 0.55
  const screenings = totalBrokens * 0.30
  const brewers = totalBrokens * 0.15

  // Yield percentages of original rough paddy
  const huskYieldPct = (huskOut / paddyIn) * 100
  const brownRiceYieldPct = (brownRice / paddyIn) * 100
  const branYieldPct = (branOut / paddyIn) * 100
  const totalMilledYieldPct = (totalMilledRice / paddyIn) * 100
  const headRiceYieldPct = (headRice / paddyIn) * 100 // Head Rice Yield (HRY)
  const totalBrokensYieldPct = (totalBrokens / paddyIn) * 100
  const secondHeadsYieldPct = (secondHeads / paddyIn) * 100
  const screeningsYieldPct = (screenings / paddyIn) * 100
  const brewersYieldPct = (brewers / paddyIn) * 100

  return {
    vFast,
    vSlow,
    vDiff,
    hullerSlowRpm,
    isGelatinized,
    gelatinizationIndex,
    thiamineRetentionPct,
    hardnessIndex,
    paddyIn,
    impuritiesOut,
    cleanPaddy,
    huskOut,
    brownRice,
    branOut,
    totalMilledRice,
    headRice,
    secondHeads,
    screenings,
    brewers,
    totalBrokens,
    huskYieldPct,
    brownRiceYieldPct,
    branYieldPct,
    totalMilledYieldPct,
    headRiceYieldPct,
    totalBrokensYieldPct,
    secondHeadsYieldPct,
    screeningsYieldPct,
    brewersYieldPct,
    hullingBreakagePct,
    polishingBreakagePct,
    totalBreakagePct,
    terminalVelocityHusk,
    terminalVelocityRice,
    huskLiftEfficiencyPct,
  }
}

/** Mutable live telemetry polled by DOM UI via useLive */
export interface LiveRice {
  time: number
  fastAngle: number
  slowAngle: number
  screenVibX: number
  screenVibY: number
  trieurAngle: number
  fanAngle: number
  headRiceKgH: number
  brokensKgH: number
  huskKgH: number
  branKgH: number
  hryPct: number
  flowRate: number
}

export const live: LiveRice = {
  time: 0,
  fastAngle: 0,
  slowAngle: 0,
  screenVibX: 0,
  screenVibY: 0,
  trieurAngle: 0,
  fanAngle: 0,
  headRiceKgH: 550,
  brokensKgH: 150,
  huskKgH: 200,
  branKgH: 80,
  hryPct: 55.0,
  flowRate: 1.0,
}

/* ---------------- helpers that reproduce the RICE 101 definitions ---------------- */

/** Wet-basis drying: mass after drying from Mi to Mf (fractions); dry matter is conserved. */
export function dryTo(m: number, Mi: number, Mf: number) {
  const out = (m * (1 - Mi)) / (1 - Mf)
  return { out, water: m - out }
}

/** Grain type by length/width ratio (RICE p12): long > 3, medium 2.0–2.9, short < 2. */
export function grainType(LW: number): GrainVariety {
  if (LW > 3) return 'long'
  if (LW >= 2) return 'medium'
  return 'short'
}

/**
 * Milled-kernel class by fraction of whole-kernel length (RICE p12): head ≥ ¾, second heads ½–¾,
 * brewers ≈ ¼ and less; screenings ¼–½ (the band for screenings is the standard grading rule).
 */
export function kernelClass(frac: number): 'head' | 'second' | 'screenings' | 'brewers' {
  if (frac >= 0.75) return 'head'
  if (frac >= 0.5) return 'second'
  if (frac >= 0.25) return 'screenings'
  return 'brewers'
}

/** Paddy MC the line starts from (harvest, wet basis %) before drying to the storage target (≈ 12 %). */
export const HARVEST_MC_PCT = 20
