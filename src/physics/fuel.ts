/**
 * Fuel systems — AEE509.
 * Sources:
 *  - AEE 509 Miscellaneous Exercises p3 (A/F ratios), p4 eqs 1.2–1.3, p5 Examples 1–4, p6 Examples 5 & 7;
 *  - ENGINE SYSTEMS Supplementary notes (calorific values, injection pressure 120–300 kg/cm²);
 *  - extract fromtextbook(509) §4.4–4.5 (carburettor 1 : 15 by weight, helix-metered pump, injector ~140 kg/cm²).
 * Venturi / jet flow and the injector opening-pressure relation are standard fluid mechanics,
 * added because the notes describe the mechanism but give no equations (flagged "beyond notes" in the UI).
 *
 * SI units unless stated.
 */

const G = 9.80665

/* ------------------------------ Units & fuel data ------------------------------ */

/** 1 kg/cm² (kgf/cm²) in Pa. */
export const KG_PER_CM2 = G * 1e4

/** Convert a pressure in kg/cm² (as the notes write it) to Pa. */
export function kgcm2ToPa(p: number) {
  return p * KG_PER_CM2
}

export function paToKgcm2(p: number) {
  return p / KG_PER_CM2
}

/** 1 kcal = 4.1868 kJ. */
export function kcalPerKgToKJPerKg(cv: number) {
  return cv * 4.1868
}

/** Calorific values from the Supplementary notes table, kcal/kg. */
export const CALORIFIC_VALUES = {
  ldo: { name: 'Light diesel oil (LDO)', kcal: 10300 },
  hsd: { name: 'High-speed diesel (HSD)', kcal: 10550 },
  kerosene: { name: 'Power kerosene', kcal: 10850 },
  petrol: { name: 'Petrol', kcal: 11100 },
} as const

export type FuelId = keyof typeof CALORIFIC_VALUES

/** Heating value in J/kg for a fuel in the Supplementary-notes table. */
export function heatingValue(fuel: FuelId) {
  return kcalPerKgToKJPerKg(CALORIFIC_VALUES[fuel].kcal) * 1000
}

/** Typical densities, kg/m³ (beyond notes, except petrol 760 kg/m³ which Misc Ex 5 uses). */
export const DENSITY = { diesel: 835, petrol: 760 } as const

/* ------------------------------ Engine fuel & air ------------------------------ */

/** Stoichiometric (chemically correct) A/F used throughout the notes. */
export const STOICH_AF = 15

/** ṁf = P / (HV · η)  — Misc eq 1.2 rearranged. P in W, HV in J/kg → kg/s. */
export function fuelRateForPower(power: number, heatingValueJkg: number, eta: number) {
  return power / (heatingValueJkg * eta)
}

/** P = η · HV · ṁa · (F/A) — Misc eq 1.3. ṁa kg/s, HV J/kg → W. */
export function powerFromAir(eta: number, heatingValueJkg: number, airRate: number, fuelAir: number) {
  return eta * heatingValueJkg * airRate * fuelAir
}

/** Thermal efficiency η = P / (ṁf · HV) — Misc eq 1.2 (brake or indicated, depending on P). */
export function thermalEfficiency(power: number, fuelRate: number, heatingValueJkg: number) {
  return power / (fuelRate * heatingValueJkg)
}

/** Specific air consumption (kg/kWh) = sfc × A/F — Misc Ex 1. */
export function specificAirConsumption(sfcKgPerKWh: number, airFuel: number) {
  return sfcKgPerKWh * airFuel
}

export type MixtureStrength = 'very rich' | 'rich' | 'correct' | 'lean' | 'very lean'

/**
 * Mixture strength from the air–fuel ratio by mass. "Rich" = more fuel than 1 : 15
 * (TB §4.4.3), the SI operating band is 12 < A/F < 18 (Misc p3).
 */
export function mixtureStrength(airFuel: number, stoich = STOICH_AF): MixtureStrength {
  if (airFuel < 12) return 'very rich'
  if (airFuel < stoich - 0.5) return 'rich'
  if (airFuel <= stoich + 0.5) return 'correct'
  if (airFuel <= 18) return 'lean'
  return 'very lean'
}

/* ------------------------------ In-line injection pump ------------------------------ */

export interface HelixElement {
  /** plunger diameter, m */
  plungerD: number
  /** control-sleeve pinion pitch radius, m (rack travel / radius = plunger rotation) */
  sleeveR: number
  /** axial rise of the control helix per full turn of the plunger, m */
  helixLead: number
  /** rotation (rad) at which the helix runs out (maximum-fuel stop) */
  maxRotation: number
  /** plunger lift at which the top edge closes the barrel ports (pre-stroke), m */
  preStroke: number
  /** total cam lift, m */
  camLift: number
}

/**
 * Effective (delivery) stroke of a helix-metered plunger. Rack travel x rotates the plunger by
 * x / r. With the vertical slot facing the spill port (x = 0) the port is never covered: no fuel
 * (stop). Turning the plunger brings a taller strip of land under the port, so delivery lasts
 * lead · θ / 2π of lift. TB §4.6: "controlled by a helical groove on the plunger".
 */
export function helixEffectiveStroke(rack: number, el: HelixElement) {
  const theta = Math.max(0, Math.min(el.maxRotation, rack / el.sleeveR))
  return Math.min(el.camLift - el.preStroke, (el.helixLead * theta) / (2 * Math.PI))
}

/** Plunger cross-section area, m². */
export function plungerArea(el: Pick<HelixElement, 'plungerD'>) {
  return (Math.PI / 4) * el.plungerD * el.plungerD
}

/** Geometric delivery per pumping stroke, m³ = (π/4) d² · effective stroke. */
export function deliveryPerStroke(rack: number, el: HelixElement) {
  return plungerArea(el) * helixEffectiveStroke(rack, el)
}

/**
 * Fuel mass flow for a four-stroke engine, kg/s. Each element pumps once per pump-camshaft
 * revolution and the pump turns at half crank speed, so each cylinder gets one charge per
 * 2 crank revolutions.
 */
export function pumpFuelRate(volumePerStroke: number, rpm: number, cylinders: number, density: number = DENSITY.diesel) {
  return volumePerStroke * density * cylinders * (rpm / 2 / 60)
}

/**
 * Plunger state for a pump-camshaft angle (rad). Simple-harmonic cam lift.
 * Delivery happens while lift is between the pre-stroke (ports closed) and pre-stroke + effective
 * stroke (helix uncovers the spill port).
 */
export function plungerState(camAngle: number, rack: number, el: HelixElement) {
  const a = ((camAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const lift = (el.camLift / 2) * (1 - Math.cos(a))
  const rising = a < Math.PI
  const eff = helixEffectiveStroke(rack, el)
  const delivering = rising && eff > 0 && lift >= el.preStroke && lift < el.preStroke + eff
  return { lift, rising, delivering, eff }
}

/* ------------------------------ Injector ------------------------------ */

/**
 * Nozzle opening pressure: the needle lifts when the fuel pressure on its differential
 * (annular) area overcomes the spring load. p = F / [π/4 (d_needle² − d_seat²)].
 * Beyond notes — the Supplementary notes state the principle only.
 */
export function injectorOpeningPressure(springForce: number, needleD: number, seatD: number) {
  return springForce / ((Math.PI / 4) * (needleD * needleD - seatD * seatD))
}

/** Spring load needed for an opening pressure (Pa). */
export function injectorSpringForce(openingPressure: number, needleD: number, seatD: number) {
  return openingPressure * (Math.PI / 4) * (needleD * needleD - seatD * seatD)
}

/* ------------------------------ Carburettor (beyond notes) ------------------------------ */

/** Depression across an orifice / venturi for a mass flow: Δp = ½ρ (ṁ/(Cd A ρ))². Pa. */
export function orificeDepression(massFlow: number, area: number, cd: number, rho: number) {
  if (area <= 0) return Infinity
  const v = massFlow / (cd * area * rho)
  return 0.5 * rho * v * v
}

/** Air velocity at an area for a mass flow, m/s. */
export function velocityAt(massFlow: number, area: number, rho: number) {
  return massFlow / (rho * area)
}

/**
 * Fuel flow out of a jet whose tip stands h above the float-chamber level, driven by a
 * depression Δp: ṁf = Cd A √(2ρf (Δp − ρf g h)). Zero until Δp lifts fuel to the tip.
 */
export function jetFuelFlow(depression: number, jetArea: number, cd: number, rhoFuel: number, liftHeight: number) {
  const head = depression - rhoFuel * G * liftHeight
  if (head <= 0) return 0
  return cd * jetArea * Math.sqrt(2 * rhoFuel * head)
}
