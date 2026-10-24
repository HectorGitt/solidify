import { create } from 'zustand'

export const G = 9.81
const { PI, pow, exp, max, min } = Math

/**
 * Standard mass fractions per 1000 kg Fresh Fruit Bunches (FFB)
 * Source: docs/notes-inventory/AEE504-AEE536-crop-processing.md, IMG-POMB.
 */
export const MASS_BALANCE_1000KG = {
  ffb: 1000,
  efb: 234, // Empty Fruit Bunches (to plantation fertiliser / mulch)
  fruits: 666, // Loose threshed fruits
  fibre: 180, // Mesocarp fibre (to boiler fuel)
  shell: 73, // Palm nut shell (to boiler fuel)
  kernels: 67, // Palm kernels (to kernel crushing plant)
  sludge: 180, // Heavy sludge & effluent (to treatment)
  cpo: 225, // Crude Palm Oil (OER = 22.5%)
  /** not printed: 1000 − 234 − 666 = 100 kg leaves the steriliser/thresher as condensate and moisture (inferred) */
  moistureCondensate: 100,
  /** not printed: outputs from the fruit (225 + 180 + 180 + 73 + 67 = 725 kg) exceed the 666 kg of fruit, so ≈ 59 kg of dilution water must enter at the press/clarifier (inferred) */
  dilutionWater: 59,
} as const

export type StationId = 'all' | 'steriliser' | 'thresher' | 'digester' | 'press' | 'clarifier' | 'depericarper'

export interface PalmOilParams {
  /** Batch or hourly mass of Fresh Fruit Bunches (kg) */
  ffbInput: number
  /** Oil content of FFB mesocarp (% by wt, baseline 22.5%) */
  ffbOilContent: number
  /** Steriliser steam temperature (°C, 120–150 °C) */
  steriliserTemp: number
  /** Steriliser cycle time (min, 45–100 min) */
  steriliserTime: number
  /** Digester temperature (°C, 80–98 °C) */
  digesterTemp: number
  /** Digester beater arm shaft speed (rpm, 15–35 rpm) */
  digesterSpeed: number
  /** Screw press hydraulic cone backpressure (bar, 25–80 bar) */
  conePressure: number
  /** Screw press shaft speed (rpm, 8–20 rpm) */
  pressRpm: number
  /** Clarification settling tank temperature (°C, 75–95 °C) */
  clarifierTemp: number
  /** High-speed disk centrifuge purifier speed (rpm, 3000–6500 rpm) */
  centrifugeRpm: number
  /** Depericarper winnowing air column velocity (m/s, 4.0–9.0 m/s) */
  winnowerAirSpeed: number
  /** Oil globule diameter for Stokes separation (µm, 20–100 µm, baseline 50 from PQ p5 Q v) */
  oilGlobuleDiaUm: number
  /** Selected station highlight / focus */
  station: StationId
}

export const DEFAULTS: PalmOilParams = {
  ffbInput: 1000,
  ffbOilContent: 22.5,
  steriliserTemp: 135,
  steriliserTime: 75,
  digesterTemp: 92,
  digesterSpeed: 25,
  conePressure: 50,
  pressRpm: 12,
  clarifierTemp: 88,
  centrifugeRpm: 5000,
  winnowerAirSpeed: 6.0,
  oilGlobuleDiaUm: 50,
  station: 'all',
}

/** Pure mass-balance and process performance calculation */
export function calculateMillPerformance(p: PalmOilParams) {
  const scale = p.ffbInput / 1000

  // Enzyme arrest and softening factor from sterilisation:
  // Optimum sterilisation: 130–145 °C for 60–85 min
  const sterOptTemp = 135
  const sterTempFactor = exp(-pow((p.steriliserTemp - sterOptTemp) / 18, 2))
  const sterTimeFactor = min(1, p.steriliserTime / 60)
  const sterilisationEff = 0.90 + 0.10 * sterTempFactor * sterTimeFactor

  // Mesocarp digestion factor (rupturing oleiferous oil cells):
  // Optimum: 90–95 °C with active agitation (20–30 rpm)
  const digTempFactor = min(1, max(0.6, (p.digesterTemp - 60) / 32))
  const digSpeedFactor = min(1, p.digesterSpeed / 22)
  const digestionMaceration = digTempFactor * digSpeedFactor

  // Screw press extraction mechanics:
  // Higher cone backpressure presses more oil from fibre, but increases kernel breakage
  // Typical cone pressure is 40–55 bar.
  const pressureFactor = min(1.05, 0.70 + (p.conePressure / 50) * 0.30)
  const extractionCoeff = sterilisationEff * digestionMaceration * pressureFactor

  // Residual oil losses (kg per 1000 kg FFB):
  // 1. Loss in Empty Fruit Bunches (unstripped fruitlets / stalk absorption): ~8 kg
  const efbOilLoss = 8.0 * (1.8 - 0.8 * sterilisationEff) * scale
  // 2. Loss in pressed mesocarp fibre (unexpressed oil remaining in press cake): ~12 kg at 50 bar
  const fibreOilLoss = 12.0 * max(0.5, (1.8 - (p.conePressure / 50) * 0.8)) * scale
  // 3. Loss in clarification sludge (unrecovered fine oil globules in effluent): ~10 kg
  const sludgeOilLoss = 10.0 * max(0.4, (1.6 - (p.centrifugeRpm / 5000) * 0.6)) * scale

  const totalLossKg = efbOilLoss + fibreOilLoss + sludgeOilLoss

  // Potential oil in FFB
  const totalOilInFfbKg = (p.ffbOilContent / 100) * p.ffbInput * (255 / 225) // total lipid potential ~25.5% for 22.5% OER baseline
  const crudePalmOilYieldKg = max(0, totalOilInFfbKg - totalLossKg)
  const oer = (crudePalmOilYieldKg / p.ffbInput) * 100 // Oil Extraction Rate (%)

  // Product stream weights (kg)
  const efbKg = MASS_BALANCE_1000KG.efb * scale
  const fruitsKg = MASS_BALANCE_1000KG.fruits * scale
  const fibreKg = MASS_BALANCE_1000KG.fibre * scale
  const shellKg = MASS_BALANCE_1000KG.shell * scale
  const kernelsKg = MASS_BALANCE_1000KG.kernels * scale
  const cpoKg = crudePalmOilYieldKg
  const dilutionKg = MASS_BALANCE_1000KG.dilutionWater * scale
  const condensateKg = MASS_BALANCE_1000KG.moistureCondensate * scale
  // sludge closes the balance: oil not recovered as CPO leaves with the sludge/effluent
  const sludgeKg = max(0, fruitsKg + dilutionKg - cpoKg - fibreKg - shellKg - kernelsKg)
  const ker = (kernelsKg / p.ffbInput) * 100

  // Nut breakage risk (% of nuts broken in press, causing shell contamination in kernels)
  // Increases sharply above 55 bar
  const nutBreakagePct = p.conePressure <= 45 ? 1.5 : 1.5 + pow((p.conePressure - 45) / 10, 2) * 2.2

  // Biomass boiler co-generation potential:
  // Shell (73 kg) + Fibre (180 kg) = 253 kg solid biomass per tonne FFB
  // Calorific values: Fibre ~15.0 MJ/kg, Shell ~18.8 MJ/kg
  const boilerFuelKg = fibreKg + shellKg
  const thermalEnergyMj = (fibreKg * 15.0 + shellKg * 18.8)
  const steamGeneratedKg = thermalEnergyMj / 2.6 // ~2.6 MJ/kg steam enthalpy
  const millSteamDemandKg = 550 * scale // typical mill thermal consumption ~500–600 kg steam/t FFB
  const boilerSteamSurplusKg = steamGeneratedKg - millSteamDemandKg

  // Screw press mechanics
  const dCage = 0.30 // 300 mm press barrel diameter
  const dShaftIn = 0.10 // 100 mm shaft at feed end
  const dShaftOut = 0.18 // 180 mm tapered shaft at discharge end
  const pitchIn = 0.22
  const pitchOut = 0.12
  const volInPerRev = (PI * (dCage * dCage - dShaftIn * dShaftIn) * pitchIn) / 4
  const volOutPerRev = (PI * (dCage * dCage - dShaftOut * dShaftOut) * pitchOut) / 4
  const compressionRatio = volInPerRev / volOutPerRev
  const pressThroughputM3h = volInPerRev * p.pressRpm * 60 * 0.42 // 42% fill efficiency
  const pressThroughputTh = (pressThroughputM3h * 920) / 1000 // mash density ~920 kg/m³
  const pressPowerKw = 15.0 + (p.conePressure / 50) * 18.0 * (p.pressRpm / 12)

  // Clarification Stokes Settling (PQ p5 Q v and SEP eqs 11–12)
  // Oil globules rise in water because rho_oil < rho_water
  const rhoOil = 900 // kg/m³
  const rhoWater = 1000 // kg/m³
  // Viscosity: at 20 °C mu = 1.0e-3 Pa·s; at 88 °C mu ~ 0.32e-3 Pa·s
  // For exact PQ p5 Q v verification at mu = 1.0e-3 Pa·s:
  const muWaterTest = 1.0e-3
  const dTest = 50e-6
  const vStokesGravityPq = (G * dTest * dTest * (rhoWater - rhoOil)) / (18 * muWaterTest) // 1.3625e-4 m/s

  // At actual clarifier operating temperature:
  const muWaterActual = 0.00179 / (1 + 0.03368 * p.clarifierTemp + 0.000221 * p.clarifierTemp * p.clarifierTemp)
  const dM = p.oilGlobuleDiaUm * 1e-6
  const vStokesGravityActual = (G * dM * dM * (rhoWater - rhoOil)) / (18 * muWaterActual)

  // Centrifugal Purifier (SEP eq 18):
  // a_c = r * omega^2
  const rCentrifuge = 0.16 // 160 mm bowl radius
  const omegaCentrifuge = (2 * PI * p.centrifugeRpm) / 60
  const centrifugeAcc = rCentrifuge * omegaCentrifuge * omegaCentrifuge
  const separationFactor = centrifugeAcc / G
  const vStokesCentrifugal = (dM * dM * rCentrifuge * omegaCentrifuge * omegaCentrifuge * (rhoWater - rhoOil)) / (18 * muWaterActual)

  // Depericarper Aerodynamic Separation (SEP eqs 8–9)
  // Terminal velocities: Fibre ~2.8 m/s, Nut ~11.5 m/s
  const vTerminalFibre = 2.8
  const vTerminalNut = 11.5
  // Winnower air separation:
  // If airSpeed > vTerminalFibre, fibre is lifted upward (entrained)
  // If airSpeed < vTerminalNut, nuts drop down
  const fibreLiftPct = min(100, max(0, ((p.winnowerAirSpeed - 1.8) / (vTerminalFibre * 0.8)) * 100))
  const nutDropPurityPct = p.winnowerAirSpeed > 10.0 ? 80 : p.winnowerAirSpeed < 4.0 ? 70 : 99.2

  return {
    scale,
    sterilisationEff,
    digestionMaceration,
    extractionCoeff,
    // Mass outputs (kg)
    efbKg,
    fruitsKg,
    fibreKg,
    shellKg,
    kernelsKg,
    sludgeKg,
    cpoKg,
    dilutionKg,
    condensateKg,
    ker,
    totalLossKg,
    efbOilLoss,
    fibreOilLoss,
    sludgeOilLoss,
    oer,
    nutBreakagePct,
    // Boiler energy
    boilerFuelKg,
    thermalEnergyMj,
    steamGeneratedKg,
    millSteamDemandKg,
    boilerSteamSurplusKg,
    // Screw press
    compressionRatio,
    pressThroughputM3h,
    pressThroughputTh,
    pressPowerKw,
    // Clarification Stokes
    vStokesGravityPq,
    vStokesGravityActual,
    vStokesGravityMmPerHr: vStokesGravityActual * 3600 * 1000,
    centrifugeAcc,
    separationFactor,
    vStokesCentrifugal,
    vStokesCentrifugalMmPerS: vStokesCentrifugal * 1000,
    // Depericarper
    vTerminalFibre,
    vTerminalNut,
    fibreLiftPct,
    nutDropPurityPct,
  }
}

/**
 * Mutable live animation state updated every simulation frame in Scene3D
 * read by the Panel without triggering React re-renders.
 */
export const live = {
  time: 0,
  thresherRot: 0,
  digesterRot: 0,
  pressRot: 0,
  coneDisp: 0,
  centrifugeRot: 0,
  nutDrumRot: 0,
  oilFlowActive: true,
}

interface PalmOilStore extends PalmOilParams {
  set: (p: Partial<PalmOilParams>) => void
  reset: () => void
  setStation: (station: StationId) => void
}

export const usePalmOil = create<PalmOilStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set((s) => ({ ...s, ...p })),
  reset: () => set(DEFAULTS),
  setStation: (station) => set({ station }),
}))

/** IMG-POMB per-1000 kg balance check: returns the inferred steriliser loss and dilution water. */
export function pombClosure(m = MASS_BALANCE_1000KG) {
  const sterLoss = m.ffb - m.efb - m.fruits
  const fromFruit = m.cpo + m.sludge + m.fibre + m.shell + m.kernels
  return { sterLoss, fromFruit, dilution: fromFruit - m.fruits, oer: (m.cpo / m.ffb) * 100, ker: (m.kernels / m.ffb) * 100, fruitToBunch: (m.fruits / m.ffb) * 100 }
}
