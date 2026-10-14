import { create } from 'zustand'

export type GarriGrade = 'extra-fine' | 'fine' | 'medium' | 'coarse'

export interface GarriParams {
  /** Fresh cassava root batch mass (kg) */
  batchRoots: number
  /** Fresh root moisture content wet basis (%) */
  rootMoisture: number
  /** Peel loss fraction (%) */
  peelLoss: number
  /** Moisture content of dewatered press cake (%) */
  dewaterMoisture: number
  /** Fermentation period in days */
  fermentDays: number
  /** Roasting pan / garifier temperature (°C) */
  fryingTemp: number
  /** Target final moisture of fried garri (%) */
  targetMoisture: number
  /** Target granularity grade */
  grade: GarriGrade
  /** Sacks packaging size (kg) */
  bagSize: 25 | 50
}

export const DEFAULTS: GarriParams = {
  batchRoots: 1000,
  rootMoisture: 68.0,
  peelLoss: 22.0,
  dewaterMoisture: 47.0,
  fermentDays: 3.0,
  fryingTemp: 135,
  targetMoisture: 10.5,
  grade: 'medium',
  bagSize: 50,
}

export interface StreamData {
  mass: number
  moisture: number
  solids: number
}

export interface GarriMassBalance {
  // Stage 1: Peeling
  rootsIn: StreamData
  peelsOut: StreamData
  peeledRoots: StreamData

  // Stage 2: Washing
  washWaterUsed: number
  washEffluent: number
  washedRoots: StreamData

  // Stage 3: Grating
  graterLoss: number
  wetMash: StreamData

  // Stage 4: Fermentation & Dewatering
  fermentAcidity: number // % lactic acid
  cyanideRoots: number // mg/kg HCN
  cyanideCake: number // mg/kg HCN
  cyanideGarri: number // mg/kg HCN
  liquorExpelled: StreamData
  pressCake: StreamData

  // Stage 5: Disintegration & Granulating Sieve
  chaffFiberOut: StreamData
  siftedGrits: StreamData

  // Stage 6: Frying / Garifying
  steamEvaporated: number
  sensibleHeatKj: number
  latentHeatKj: number
  totalHeatKj: number
  specificEnergyKjKg: number
  friedGarri: StreamData

  // Stage 7: Cooling
  flashMoistureLost: number
  cooledGarri: StreamData

  // Stage 8: Sifting & Grading
  oversizeRecycle: StreamData
  gradedGarri: StreamData

  // Stage 9: Packaging
  packagedGarri: StreamData
  fullBags: number
  partialBagKg: number
  extractionYieldPct: number

  // Standards verification (Codex STAN 151-1989)
  standards: {
    moisturePass: boolean
    moistureVal: number
    moistureLimit: number // 12.0 %

    acidityPass: boolean
    acidityVal: number
    acidityMin: number // 0.6 %
    acidityMax: number // 1.0 %

    fibrePass: boolean
    fibreVal: number
    fibreLimit: number // 2.0 %

    ashPass: boolean
    ashVal: number
    ashLimit: number // 2.75 %

    cyanidePass: boolean
    cyanideVal: number
    cyanideLimit: number // 2 mg/kg total HCN (Codex STAN 151)

    allPass: boolean
  }
}

/**
 * Detailed step-by-step mass balance and chemical/physical transitions through the garri line.
 * Follows FAO / Nigerian crop processing engineering standards and Codex STAN 151-1989 (GSTD).
 */
export function calcGarriMassBalance(p: GarriParams): GarriMassBalance {
  const m0 = Math.max(1, p.batchRoots)
  const mc0 = Math.max(10, Math.min(85, p.rootMoisture)) / 100
  const s0 = m0 * (1 - mc0)

  // 1. Peeling
  const fPeel = Math.max(5, Math.min(40, p.peelLoss)) / 100
  const mPeel = m0 * fPeel
  const sPeel = s0 * fPeel
  const mPeeled = m0 - mPeel
  const sPeeled = s0 - sPeel

  // 2. Washing: 2.0 L water per kg peeled roots, removes surface dirt (~0.5% solids lost)
  const washWaterUsed = mPeeled * 2.0
  const fWashSolidsLoss = 0.005
  const sWashed = sPeeled * (1 - fWashSolidsLoss)
  const mWashed = mPeeled * (1 - fWashSolidsLoss)
  const washEffluent = washWaterUsed + mPeeled * fWashSolidsLoss

  // 3. Grating: size reduction to wet mash, ~0.5% mechanical transfer loss
  const fGrateLoss = 0.005
  const sMash = sWashed * (1 - fGrateLoss)
  const mMash = mWashed * (1 - fGrateLoss)
  const graterLoss = mWashed * fGrateLoss

  // 4. Fermentation & Dewatering
  // Lactic acid fermentation kinetics: 0.15% fresh -> 0.60-1.00% depending on days (Codex §3.3)
  const tFerm = Math.max(0.5, p.fermentDays)
  const fermentAcidity = 0.15 + 0.85 * (1 - Math.exp(-0.7 * tFerm))

  // Cyanide detoxification (HCN in mg/kg)
  const cyanideRoots = 120
  const cyanideCake = cyanideRoots * Math.exp(-0.85 * tFerm) * 0.25
  const cyanideGarri = cyanideCake * 0.14 // thermal volatisation during roasting

  // Dewatering press: liquor contains water + ~4% dissolved soluble solids/starch
  const mcCake = Math.max(30, Math.min(60, p.dewaterMoisture)) / 100
  const fSolidsInLiquor = 0.04
  const sCake = sMash * (1 - fSolidsInLiquor)
  const mCake = sCake / (1 - mcCake)
  const mLiquor = mMash - mCake
  const sLiquor = sMash * fSolidsInLiquor

  // 5. Cake Disintegration & Granulating Sieve
  // Sieving dewatered cake removes woody fiber/chaff lumps (~4% of cake)
  const fChaff = 0.04
  const mChaff = mCake * fChaff
  const sChaff = sCake * fChaff
  const mGrits = mCake - mChaff
  const sGrits = sCake - sChaff

  // 6. Frying / Garifying (Partial gelatinisation + moisture evaporation)
  // Target moisture wet basis
  const mcTarget = Math.max(6, Math.min(18, p.targetMoisture)) / 100
  const sFried = sGrits // dry matter conserved in fryer
  const mFried = sFried / (1 - mcTarget)
  const steamEvaporated = Math.max(0, mGrits - mFried)

  // Energy: sensible heat (mash from 25°C to 85°C, Cp ≈ 2.8 kJ/kg·K) + latent heat of vaporisation (2260 kJ/kg)
  const cpMash = 2.8
  const deltaT = 85 - 25
  const sensibleHeatKj = mGrits * cpMash * deltaT
  const hfg = 2260
  const latentHeatKj = steamEvaporated * hfg
  const totalHeatKj = sensibleHeatKj + latentHeatKj
  const specificEnergyKjKg = mFried > 0 ? totalHeatKj / mFried : 0

  // 7. Cooling: hot garri spread on cooling table, flashes off ~0.3% moisture
  const flashMoistureLost = mFried * 0.003
  const mCooled = mFried - flashMoistureLost
  const sCooled = sFried
  const mcFinal = Math.max(0.04, (mCooled - sCooled) / mCooled)

  // 8. Secondary Sifting & Grading
  // Multi-deck sifter according to AFNOR aperture specs; separates ~2% oversize chunks (>2 mm) for re-milling
  const fOversize = 0.02
  const mOversize = mCooled * fOversize
  const sOversize = sCooled * fOversize
  const mGraded = mCooled - mOversize
  const sGraded = sCooled - sOversize

  // 9. Packaging into bags
  const bagWeight = p.bagSize
  const fullBags = Math.floor(mGraded / bagWeight)
  const partialBagKg = mGraded % bagWeight
  const extractionYieldPct = (mGraded / m0) * 100

  // Quality Standards verification against Codex STAN 151-1989
  const moistureVal = mcFinal * 100
  const moisturePass = moistureVal <= 12.0
  const acidityPass = fermentAcidity >= 0.6 && fermentAcidity <= 1.0
  const fibreVal = 1.6 // typical dewatered & sifted value (standard <= 2.0%)
  const fibrePass = fibreVal <= 2.0
  const ashVal = 1.35 // typical washed peeled root garri (standard <= 2.75%)
  const ashPass = ashVal <= 2.75
  const cyanidePass = cyanideGarri <= 2.0
  const allPass = moisturePass && acidityPass && fibrePass && ashPass && cyanidePass

  return {
    rootsIn: { mass: m0, moisture: mc0 * 100, solids: s0 },
    peelsOut: { mass: mPeel, moisture: mc0 * 100, solids: sPeel },
    peeledRoots: { mass: mPeeled, moisture: mc0 * 100, solids: sPeeled },

    washWaterUsed,
    washEffluent,
    washedRoots: { mass: mWashed, moisture: mc0 * 100, solids: sWashed },

    graterLoss,
    wetMash: { mass: mMash, moisture: mc0 * 100, solids: sMash },

    fermentAcidity,
    cyanideRoots,
    cyanideCake,
    cyanideGarri,
    liquorExpelled: { mass: mLiquor, moisture: 95.0, solids: sLiquor },
    pressCake: { mass: mCake, moisture: mcCake * 100, solids: sCake },

    chaffFiberOut: { mass: mChaff, moisture: mcCake * 100, solids: sChaff },
    siftedGrits: { mass: mGrits, moisture: mcCake * 100, solids: sGrits },

    steamEvaporated,
    sensibleHeatKj,
    latentHeatKj,
    totalHeatKj,
    specificEnergyKjKg,
    friedGarri: { mass: mFried, moisture: mcTarget * 100, solids: sFried },

    flashMoistureLost,
    cooledGarri: { mass: mCooled, moisture: mcFinal * 100, solids: sCooled },

    oversizeRecycle: { mass: mOversize, moisture: mcFinal * 100, solids: sOversize },
    gradedGarri: { mass: mGraded, moisture: mcFinal * 100, solids: sGraded },

    packagedGarri: { mass: mGraded, moisture: mcFinal * 100, solids: sGraded },
    fullBags,
    partialBagKg,
    extractionYieldPct,

    standards: {
      moisturePass,
      moistureVal,
      moistureLimit: 12.0,
      acidityPass,
      acidityVal: fermentAcidity,
      acidityMin: 0.6,
      acidityMax: 1.0,
      fibrePass,
      fibreVal,
      fibreLimit: 2.0,
      ashPass,
      ashVal,
      ashLimit: 2.75,
      cyanidePass,
      cyanideVal: cyanideGarri,
      cyanideLimit: 2.0,
      allPass,
    },
  }
}

/** AFNOR sieve aperture specifications per Codex STAN 151-1989 Annex. */
export const AFNOR_STANDARDS: Record<GarriGrade, { label: string; pass100mm: number; pass40mm: number; note: string }> = {
  'extra-fine': {
    label: 'Extra-Fine',
    pass100mm: 0.5,
    pass40mm: 0.25,
    note: '100% passes 0.50 mm sieve, ≥ 40% passes 0.25 mm sieve.',
  },
  fine: {
    label: 'Fine',
    pass100mm: 1.0,
    pass40mm: 0.5,
    note: '100% passes 1.00 mm sieve, ≤ 40% passes 0.50 mm sieve.',
  },
  medium: {
    label: 'Medium',
    pass100mm: 1.25,
    pass40mm: 1.0,
    note: '100% passes 1.25 mm sieve, ≤ 40% passes 1.00 mm sieve (most common commercial standard).',
  },
  coarse: {
    label: 'Coarse',
    pass100mm: 2.0,
    pass40mm: 1.25,
    note: '100% passes 2.00 mm sieve, ≤ 40% passes 1.25 mm sieve.',
  },
}

/** Mutable live bridge for 3D animation loop & reactive panel polling */
export interface GarriLiveState {
  peelerAngle: number
  graterRpm: number
  pressPressureBar: number
  paddleAngle: number
  sifterVibX: number
  steamIntensity: number
  liquorFlowRate: number
  running: boolean
}

export const live: GarriLiveState = {
  peelerAngle: 0,
  graterRpm: 1450,
  pressPressureBar: 12.5,
  paddleAngle: 0,
  sifterVibX: 0,
  steamIntensity: 1.0,
  liquorFlowRate: 0.85,
  running: true,
}

export interface GarriStore extends GarriParams {
  set: (p: Partial<GarriParams>) => void
  reset: () => void
}

export const useGarri = create<GarriStore>((set) => ({
  ...DEFAULTS,
  set: (patch) => set((s) => ({ ...s, ...patch })),
  reset: () => set(DEFAULTS),
}))
