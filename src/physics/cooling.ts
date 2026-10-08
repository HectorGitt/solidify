/**
 * Engine cooling — AEE509.
 * Sources: 509 Lecture 4 (operating temperature 60–93 °C); ENGINE SYSTEMS Supplementary notes
 * (heat balance 40 % exhaust / 30 % cooling / 30 % work; 140–200 °F); extract fromtextbook(509)
 * Ch 7 (air cooling, thermosiphon, forced circulation, thermostat + bypass, pressure cap).
 *
 * The notes describe the system qualitatively. The lumped two-node model below (engine jacket
 * node + radiator node) and the thermostat/boiling-point numbers are standard textbook values
 * and are flagged "beyond notes" where they are shown.
 *
 * SI units: K or °C (differences only), W, kg/s, J/K, kPa for pressures.
 */

export const CP_WATER = 4186 // J/kg·K

/**
 * Saturation (boiling) temperature of water at an absolute pressure (kPa), °C.
 * Antoine equation (mmHg, °C), two ranges.
 */
export function boilingPointC(pAbsKPa: number) {
  const mmHg = (pAbsKPa * 760) / 101.325
  const low = { A: 8.07131, B: 1730.63, C: 233.426 }
  const high = { A: 8.14019, B: 1810.94, C: 244.485 }
  const t = (c: typeof low) => c.B / (c.A - Math.log10(mmHg)) - c.C
  const tl = t(low)
  return tl <= 100 ? tl : t(high)
}

/** Boiling point under a pressure cap (gauge kPa) at a given atmospheric pressure. */
export function capBoilingPointC(capGaugeKPa: number, atmKPa = 101.325) {
  return boilingPointC(atmKPa + capGaugeKPa)
}

export interface ThermostatSpec {
  /** starts to open, °C */
  openC: number
  /** fully open, °C */
  fullC: number
}

/** Typical wax-pellet thermostat (beyond notes). */
export const TYPICAL_THERMOSTAT: ThermostatSpec = { openC: 82, fullC: 95 }

/** Thermostat opening 0…1 (linear between start-to-open and fully-open temperatures). */
export function thermostatOpening(Tc: number, spec: ThermostatSpec = TYPICAL_THERMOSTAT) {
  return Math.max(0, Math.min(1, (Tc - spec.openC) / (spec.fullC - spec.openC)))
}

export type CoolingMode = 'forced' | 'thermosiphon' | 'air'

export interface CoolingParams {
  mode: CoolingMode
  /** heat to be removed by the cooling system, W */
  heat: number
  /** ambient air, °C */
  ambient: number
  /** engine speed, rpm (drives pump, fan) */
  rpm: number
  fan: boolean
  /** pressure-cap setting (gauge), kPa */
  capKPa: number
  thermostat: boolean
}

export interface CoolingState {
  /** coolant (or cylinder) temperature leaving the engine, °C */
  Te: number
  /** mean radiator temperature, °C */
  Tr: number
}

export interface CoolingFlows {
  /** coolant flow through the radiator, kg/s */
  radFlow: number
  /** coolant through the bypass, kg/s */
  bypassFlow: number
  /** heat carried to the radiator, W */
  toRadiator: number
  /** heat rejected to the air, W */
  toAir: number
  thermostat: number
  boiling: boolean
  boilC: number
}

/** Model constants (typical small tractor engine; beyond notes). */
export const COOLING_MODEL = {
  /** engine metal + jacket coolant heat capacity, J/K */
  Ce: 62_000,
  /** radiator core + coolant, J/K */
  Cr: 24_000,
  /** pump flow per engine rpm, kg/s per rpm (≈ 2 kg/s at 2000 rpm) */
  pumpPerRpm: 1e-3,
  /** radiator UA with the fan at 2000 rpm, W/K */
  UAfan: 760,
  /** radiator UA from natural draught only, W/K */
  UAnatural: 220,
  /** thermosiphon flow coefficient, kg/s per √K */
  siphonK: 0.17,
  /** thermostat leak (fraction of flow to the radiator when shut) */
  leak: 0.02,
  /** air-cooled fin conductance at 2000 rpm with flywheel fan, W/K */
  hAfins: 520,
  /** air-cooled cylinder heat capacity, J/K */
  CeAir: 30_000,
}

/** Instantaneous flows for the current temperatures. */
export function coolingFlows(s: CoolingState, p: CoolingParams): CoolingFlows {
  const M = COOLING_MODEL
  const boilC = capBoilingPointC(p.mode === 'air' ? 0 : p.capKPa)
  if (p.mode === 'air') {
    const h = M.hAfins * (0.25 + 0.75 * (p.fan ? Math.min(1.4, p.rpm / 2000) : 0))
    const toAir = h * (s.Te - p.ambient)
    return { radFlow: 0, bypassFlow: 0, toRadiator: toAir, toAir, thermostat: 1, boiling: false, boilC }
  }
  const th = p.thermostat ? thermostatOpening(s.Te) : 1
  let radFlow: number
  let bypassFlow = 0
  if (p.mode === 'forced') {
    const total = M.pumpPerRpm * p.rpm
    const open = M.leak + (1 - M.leak) * th
    radFlow = total * open
    bypassFlow = total - radFlow
  } else {
    // thermosiphon: buoyancy-driven, flow grows with the hot-leg / cold-leg temperature difference
    radFlow = M.siphonK * Math.sqrt(Math.max(0, s.Te - s.Tr)) * (M.leak + (1 - M.leak) * th)
  }
  const fanFactor = p.fan ? Math.min(1.4, p.rpm / 2000) : 0
  const UA = M.UAnatural + (M.UAfan - M.UAnatural) * fanFactor
  const toRadiator = radFlow * CP_WATER * (s.Te - s.Tr)
  const toAir = UA * (s.Tr - p.ambient)
  return { radFlow, bypassFlow, toRadiator, toAir, thermostat: th, boiling: s.Te >= boilC, boilC }
}

/** Advance the lumped model by dt seconds (explicit, sub-stepped for stability). */
export function coolingStep(s: CoolingState, p: CoolingParams, dt: number): CoolingState {
  const M = COOLING_MODEL
  let { Te, Tr } = s
  const n = Math.max(1, Math.ceil(dt / 0.5))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    const f = coolingFlows({ Te, Tr }, p)
    if (p.mode === 'air') {
      Te += (h * (p.heat - f.toAir)) / M.CeAir
      Tr = p.ambient
    } else {
      // boiling at the cap pressure clamps the jacket temperature (steam escapes via the cap)
      Te = Math.min(f.boilC + 0.5, Te + (h * (p.heat - f.toRadiator)) / M.Ce)
      Tr += (h * (f.toRadiator - f.toAir)) / M.Cr
    }
  }
  return { Te, Tr }
}

/** Steady state by time-marching (used by tests and the panel's "settled" readout). */
export function coolingSteady(p: CoolingParams, start?: CoolingState, seconds = 6000) {
  let s = start ?? { Te: p.ambient, Tr: p.ambient }
  for (let t = 0; t < seconds; t += 5) s = coolingStep(s, p, 5)
  return s
}
