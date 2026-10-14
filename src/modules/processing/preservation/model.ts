import { create } from 'zustand'
import {
  coolingLoadKw,
  plankFreezingTime,
} from '@/physics/processing'

export type Apparatus = 'all' | 'blancher' | 'retort' | 'coldstore' | 'storage' | 'packaging'
export type BlancherType = 'steam' | 'water'
export type AdditiveType = 'none' | 'carbonate' | 'cacl2' | 'salt'
export type Microbe = 'botulinum' | 'sporogenes' | 'stearothermophilus' | 'custom'
export type FreezeShape = 'sphere' | 'slab' | 'cylinder'
export type Commodity = 'meat' | 'oranges' | 'apples' | 'tomatoes'
export type StoreType = 'yam_barn' | 'platform' | 'cold_room_15' | 'grain_silo' | 'triple_bag'
export type PackagingType = 'metal_can' | 'glass_jar' | 'retort_pouch' | 'triple_bag' | 'jute_sack'

export interface PreservationParams {
  apparatus: Apparatus

  /* 1. Blancher (N536 §3B) */
  blancherType: BlancherType
  blancherTempC: number // 70–100 °C (typically 95 °C)
  blancherTimeMin: number // 2–3 min
  blancherAdditive: AdditiveType
  blancherBeltSpeed: number // m/min (e.g. 1.2)
  blancherThroughput: number // kg/h

  /* 2. Retort / Autoclave (N536 §3B Thermal destruction) */
  microbe: Microbe
  retortTempC: number // 100–135 °C (typically 121.1 °C / 250 °F)
  dRefMin: number // D-value at 121.1 °C (botulinum: 0.21 min = 12.6 s)
  zValueC: number // z-value in °C (typically 10 °C for bacterial spores)
  targetLogs: number // log reductions (typically 12D for botulinum)
  initialLoadN0: number // initial microbial spores/can
  canAgitation: boolean // rotary vs still retort
  canDiameterMm: number // can size diameter (mm)
  canHeightMm: number // can height (mm)

  /* 3. Cold Store & Blast Freezer (N536 §3C) */
  commodity: Commodity
  dailyMassT: number // t/day (worked example: 90 t/day)
  inletTempC: number // initial temp °C (e.g. 2 °C)
  storageTempC: number // target room temp °C (e.g. -12 °C)
  freezingPointC: number // °C (e.g. -1.0 °C for meat, -1.25 °C for sphere)
  Ca: number // kJ/kg·K above freezing (e.g. 3.2 for meat)
  latentHeatKj: number // kJ/kg (e.g. 225 for meat, 250 for food sphere)
  Cb: number // kJ/kg·K below freezing (e.g. 1.63 for meat)
  freezeShape: FreezeShape
  dimensionM: number // characteristic dimension (e.g. 0.07 m for 7 cm sphere)
  airTempC: number // blast air temp °C (e.g. -15 °C)
  hc: number // heat transfer coeff W/m²·K (e.g. 50 W/m²·K)
  kFrozen: number // frozen food thermal conductivity W/m·K (e.g. 1.2 W/m·K)
  foodDensity: number // kg/m³ (e.g. 1000 kg/m³)
  packageThicknessMm: number // packaging layer (mm)
  kPackage: number // packaging thermal conductivity W/m·K

  /* 4. Storage Structures (N536 Yam & Grain Storage) */
  storeType: StoreType
  yamPoleHeightM: number // ~3 m poles
  yamPoleSpacingM: number // ~0.5 m spacing
  yamTubersCount: number
  siloDiameterM: number // e.g. 3.5 m
  siloHeightM: number // e.g. 5.0 m
  aerationFanPowerKw: number // e.g. 1.5 kW

  /* 5. Packaging (PACK & N536) */
  packagingType: PackagingType
  hurdleBlanching: boolean
  hurdleDrying: boolean
  hurdlePreservative: boolean
  hurdleHermetic: boolean
  hurdleSterilization: boolean
}

export const DEFAULTS: PreservationParams = {
  apparatus: 'all',

  // Blancher
  blancherType: 'steam',
  blancherTempC: 95,
  blancherTimeMin: 2.5,
  blancherAdditive: 'none',
  blancherBeltSpeed: 1.2,
  blancherThroughput: 500,

  // Retort
  microbe: 'botulinum',
  retortTempC: 121.1,
  dRefMin: 0.21, // 0.21 min for C. botulinum at 121.1 °C
  zValueC: 10.0, // 10 °C (18 °F)
  targetLogs: 12, // 12-D cook
  initialLoadN0: 1e4,
  canAgitation: false,
  canDiameterMm: 73,
  canHeightMm: 110,

  // Cold Store
  commodity: 'meat',
  dailyMassT: 90,
  inletTempC: 2.0,
  storageTempC: -12.0,
  freezingPointC: -1.0,
  Ca: 3.2,
  latentHeatKj: 225,
  Cb: 1.63,
  freezeShape: 'sphere',
  dimensionM: 0.07, // 7 cm sphere from N536
  airTempC: -15.0,
  hc: 50.0,
  kFrozen: 1.2,
  foodDensity: 1000,
  packageThicknessMm: 0,
  kPackage: 0.2,

  // Storage Structures
  storeType: 'yam_barn',
  yamPoleHeightM: 3.0,
  yamPoleSpacingM: 0.5,
  yamTubersCount: 200,
  siloDiameterM: 3.5,
  siloHeightM: 5.0,
  aerationFanPowerKw: 1.5,

  // Packaging & Hurdles
  packagingType: 'metal_can',
  hurdleBlanching: true,
  hurdleDrying: false,
  hurdlePreservative: false,
  hurdleHermetic: true,
  hurdleSterilization: true,
}

interface PreservationStore extends PreservationParams {
  set: (p: Partial<PreservationParams>) => void
  reset: () => void
}

export const usePreservation = create<PreservationStore>((set) => ({
  ...DEFAULTS,
  set: (p) => set(p),
  reset: () => set(DEFAULTS),
}))

/* ------------------ Physics & Engineering Analyses ------------------ */

/** Plank shape factors P' and R' (N536 eq (2)). */
export function plankShapeFactors(shape: FreezeShape): { P: number; R: number } {
  switch (shape) {
    case 'slab':
      return { P: 1 / 2, R: 1 / 8 }
    case 'cylinder':
      return { P: 1 / 4, R: 1 / 16 }
    case 'sphere':
    default:
      return { P: 1 / 6, R: 1 / 24 }
  }
}

/** Respiration heat rate in W/kg from N536 Table 3.1. */
export function respirationRateWPerKg(commodity: Commodity, tempC: number): number {
  // Table 3.1: J/kg per 24 h (converted to W/kg by dividing by 86400)
  // Apples: 0°C: 312–1560 (~936); 4.4°C: 625–2810 (~1718); 15.6°C: 2390–8215 (~5303)
  // Oranges: 0°C: 416–1040 (~728); 4.4°C: 1350–1665 (~1508); 15.6°C: 3850–5405 (~4628)
  // Tomatoes: 0°C: 1040; 4.4°C: 1350; 15.6°C: 5820
  if (tempC <= 0) {
    if (commodity === 'oranges') return 728 / 86400
    if (commodity === 'tomatoes') return 1040 / 86400
    return 936 / 86400
  } else if (tempC <= 4.4) {
    const f = tempC / 4.4
    if (commodity === 'oranges') return (728 + f * (1508 - 728)) / 86400
    if (commodity === 'tomatoes') return (1040 + f * (1350 - 1040)) / 86400
    return (936 + f * (1718 - 936)) / 86400
  } else {
    const f = Math.min(2.5, (tempC - 4.4) / (15.6 - 4.4))
    if (commodity === 'oranges') return (1508 + f * (4628 - 1508)) / 86400
    if (commodity === 'tomatoes') return (1350 + f * (5820 - 1350)) / 86400
    return (1718 + f * (5303 - 1718)) / 86400
  }
}

/** Complete thermal and preservation calculations. */
export function analysePreservation(p: PreservationParams) {
  /* 1. Thermal Death Time (Retort) */
  // D(T) = D_ref * 10^((T_ref - T) / z)
  const dAtTempMin = p.dRefMin * Math.pow(10, (121.1 - p.retortTempC) / p.zValueC)
  const dAtTempSec = dAtTempMin * 60
  // Thermal death time for target log reductions: t = D * log10(N0 / N_final)
  const sterilisationTimeMin = dAtTempMin * p.targetLogs
  const sterilisationTimeSec = sterilisationTimeMin * 60
  // F0 = equivalent time at 121.1 °C with z = 10 °C: F0 = D_121.1 * logs
  const F0Min = p.dRefMin * p.targetLogs
  // Lethality rate L = 10^((T - 121.1) / z)
  const lethalityRate = Math.pow(10, (p.retortTempC - 121.1) / p.zValueC)
  // Reaction rate constant k = 2.303 / D
  const kRatePerMin = 2.303 / Math.max(1e-6, dAtTempMin)
  const finalSporeCount = p.initialLoadN0 * Math.pow(10, -p.targetLogs)

  /* 2. Cold Store Cooling Load (N536 eq (1)) */
  // mass rate in kg/s
  const mKgPerSec = (p.dailyMassT * 1000) / 86400
  const dTa = Math.max(0, p.inletTempC - p.freezingPointC)
  const dTb = Math.max(0, p.freezingPointC - p.storageTempC)
  const productLoadKw = coolingLoadKw(mKgPerSec, p.Ca, dTa, p.latentHeatKj, p.Cb, dTb)
  // 1 TR = 3.516 kW
  const productLoadTr = productLoadKw / 3.516

  // Respiration load for fruit/vegetables
  const respRateWKg = respirationRateWPerKg(p.commodity, Math.max(0, p.inletTempC))
  const respLoadW = p.dailyMassT * 1000 * respRateWKg
  const respLoadKw = respLoadW / 1000

  // Total estimated plant load (+25% transmission, lights, fan, infiltration allowance)
  const totalCoolingLoadKw = (productLoadKw + respLoadKw) * 1.25
  const totalCoolingLoadTr = totalCoolingLoadKw / 3.516

  /* 3. Plank Freezing Time (N536 eq (2) & eq (3)) */
  const { P, R } = plankShapeFactors(p.freezeShape)
  const deltaT = Math.max(0.1, p.freezingPointC - p.airTempC)
  // Latent heat in J/kg
  const latentHeatJPerKg = p.latentHeatKj * 1000
  const xPkgM = (p.packageThicknessMm || 0) / 1000

  let plankSeconds = 0
  if (xPkgM > 0 && p.kPackage > 0) {
    // Packaged form (N536 eq (3)): tf = [rho*HL/(Tf - Tinf)] * [P'*a*(1/hc + x/k1) + R'*a^2/k2]
    const factor1 = (p.foodDensity * latentHeatJPerKg) / deltaT
    const convectionPkg = P * p.dimensionM * (1 / p.hc + xPkgM / p.kPackage)
    const conduction = (R * p.dimensionM * p.dimensionM) / p.kFrozen
    plankSeconds = factor1 * (convectionPkg + conduction)
  } else {
    // Standard form (N536 eq (2))
    plankSeconds = plankFreezingTime(
      p.foodDensity,
      latentHeatJPerKg,
      p.freezingPointC,
      p.airTempC,
      P,
      p.dimensionM,
      p.hc,
      R,
      p.kFrozen
    )
  }
  const plankHours = plankSeconds / 3600

  /* 4. Blancher Enzyme Inactivation */
  // Blanching 70–100 °C for 2–3 min inactivates peroxidase and polyphenol oxidase
  const peroxidaseInactivated = p.blancherTempC >= 85 && p.blancherTimeMin >= 1.5
  const steamLeachingLossPct = p.blancherType === 'steam' ? 3.5 : 12.0 // hot water leaches ~3-4x more water soluble solids

  /* 5. Yam Barn Capacity and Loss Projection */
  // Yam barn poles 3 m high, 0.5 m spacing, tubers horizontal
  const tubersPerPole = Math.floor(p.yamPoleHeightM / 0.25) // ~12 tubers per pole
  const totalPolesNeeded = Math.ceil(p.yamTubersCount / tubersPerPole)
  const barnLengthM = (totalPolesNeeded / 2) * p.yamPoleSpacingM // dual sided rack

  return {
    dAtTempMin,
    dAtTempSec,
    sterilisationTimeMin,
    sterilisationTimeSec,
    F0Min,
    lethalityRate,
    kRatePerMin,
    finalSporeCount,
    mKgPerSec,
    dTa,
    dTb,
    productLoadKw,
    productLoadTr,
    respLoadKw,
    totalCoolingLoadKw,
    totalCoolingLoadTr,
    plankSeconds,
    plankHours,
    peroxidaseInactivated,
    steamLeachingLossPct,
    tubersPerPole,
    totalPolesNeeded,
    barnLengthM,
  }
}

/* ------------------ Live Animation Frame Data ------------------ */

export interface LivePreservation {
  timeSec: number
  retortActive: boolean
  retortTemp: number
  canCenterTemp: number
  coldStoreAirTemp: number
  freezingFrontFraction: number // 0 (unfrozen) to 1 (frozen solid)
  blancherConveyorPos: number
  airBlowerRpm: number
}

export const live: LivePreservation = {
  timeSec: 0,
  retortActive: true,
  retortTemp: 121.1,
  canCenterTemp: 25.0,
  coldStoreAirTemp: -15.0,
  freezingFrontFraction: 0.35,
  blancherConveyorPos: 0,
  airBlowerRpm: 1400,
}
