import { create } from 'zustand'
import { HEAT_BALANCE_SUPP, HEAT_BALANCE_TB, type StrokeCycle } from '@/physics/engine'
import { enginePerformance, type PerformanceInput, type PerformanceResult } from '@/physics/engineExtra'
import { AIR, airStandardCycle, alphaFromPmax } from '@/physics/thermo'

/**
 * Engine performance calculator — AEE509 Misc Exercises p2–6, TB p9 & §3.3, exam papers.
 * The 3D view is a multi-cylinder tractor diesel on a test bed, coupled to a cradled
 * (trunnion-mounted) dynamometer whose torque arm presses on a scale; ribbons show the heat balance.
 */

export type ClrMode = 'cr' | 'cv' | 'pd' | 'tcvf' | 'tcv'
export type OutMode = 'torque' | 'bp' | 'bmep' | 'fuel'
export type LossMode = 'none' | 'etaM' | 'imep' | 'fp'
export type FuelMode = 'none' | 'rate' | 'fromAir' | 'etaBth'
export type AirMode = 'none' | 'etaV' | 'rate' | 'fromFuel'
export type ShareMode = 'supp' | 'tb'

export interface PerfParams {
  /** mm */
  bore: number
  /** mm */
  stroke: number
  /** piston area override, m² (0 = use the bore) */
  area: number
  cylinders: number
  cycle: StrokeCycle
  clr: ClrMode
  /** CR; CV in cm³; divisor x for CV = PD/x or TCV/x; TCV in litres */
  clrVal: number
  rpm: number
  out: OutMode
  /** N·m | kW | kPa | ηbth */
  outVal: number
  loss: LossMode
  /** ηm | imep kPa | FP kW */
  lossVal: number
  fuel: FuelMode
  /** kg/h | – | ηbth */
  fuelVal: number
  air: AirMode
  /** ηv | kg/h | – */
  airVal: number
  af: number
  /** MJ/kg */
  hv: number
  /** kPa */
  pAmb: number
  /** K */
  TAmb: number
  shares: ShareMode
  /** dynamometer torque-arm length, m */
  arm: number
}

export const DEFAULTS: PerfParams = {
  bore: 100,
  stroke: 120,
  cylinders: 4,
  area: 0,
  cycle: 4,
  clr: 'cr',
  clrVal: 17,
  rpm: 2000,
  out: 'torque',
  outVal: 220,
  loss: 'etaM',
  lossVal: 0.8,
  fuel: 'rate',
  fuelVal: 13,
  air: 'etaV',
  airVal: 0.85,
  af: 25,
  hv: 44,
  pAmb: 100,
  TAmb: 300,
  shares: 'supp',
  arm: 0.5,
}

interface Store extends PerfParams {
  preset: string | null
  set: (p: Partial<PerfParams> & { preset?: string | null }) => void
  reset: () => void
}

export const usePerf = create<Store>((set) => ({
  ...DEFAULTS,
  preset: null,
  set: (p) => set({ preset: null, ...p }),
  reset: () => set({ ...DEFAULTS, preset: null }),
}))

export function toInput(p: PerfParams): PerformanceInput {
  const clearance =
    p.clr === 'cr'
      ? ({ kind: 'cr', value: p.clrVal } as const)
      : p.clr === 'cv'
        ? ({ kind: 'cv', value: p.clrVal * 1e-6 } as const)
        : p.clr === 'pd'
          ? ({ kind: 'pdFraction', value: 1 / p.clrVal } as const)
          : p.clr === 'tcvf'
            ? ({ kind: 'tcvFraction', value: 1 / p.clrVal } as const)
            : ({ kind: 'tcv', value: p.clrVal * 1e-3 } as const)
  const output =
    p.out === 'torque'
      ? ({ kind: 'torque', value: p.outVal } as const)
      : p.out === 'bp'
        ? ({ kind: 'bp', value: p.outVal * 1000 } as const)
        : p.out === 'bmep'
          ? ({ kind: 'bmep', value: p.outVal * 1000 } as const)
          : ({ kind: 'fuel', etaBth: p.outVal } as const)
  const losses =
    p.loss === 'etaM' ? ({ kind: 'etaM', value: p.lossVal } as const) : p.loss === 'imep' ? ({ kind: 'imep', value: p.lossVal * 1000 } as const) : p.loss === 'fp' ? ({ kind: 'fp', value: p.lossVal * 1000 } as const) : undefined
  const fuel = p.fuel === 'rate' ? ({ kind: 'rate', kgPerH: p.fuelVal } as const) : p.fuel === 'fromAir' ? ({ kind: 'fromAir' } as const) : p.fuel === 'etaBth' ? ({ kind: 'etaBth', value: p.fuelVal } as const) : undefined
  const air = p.air === 'etaV' ? ({ kind: 'etaV', value: p.airVal } as const) : p.air === 'rate' ? ({ kind: 'rate', kgPerH: p.airVal } as const) : p.air === 'fromFuel' ? ({ kind: 'fromFuel' } as const) : undefined
  return {
    bore: p.bore / 1000,
    stroke: p.stroke / 1000,
    area: p.area > 0 ? p.area : undefined,
    cylinders: p.cylinders,
    cycle: p.cycle,
    clearance,
    rpm: p.rpm,
    output,
    losses,
    fuel,
    air,
    airFuel: p.af,
    hv: p.hv * 1e6,
    pAmb: p.pAmb * 1000,
    TAmb: p.TAmb,
    shares: p.shares === 'supp' ? HEAT_BALANCE_SUPP : HEAT_BALANCE_TB,
  }
}

export function compute(p: PerfParams): PerformanceResult {
  return enginePerformance(toInput(p))
}

/** Heat-balance fractions used for the 3D ribbons: from the calculation when complete, else the notes' split. */
export function shares(p: PerfParams, r: PerformanceResult) {
  if (r.heat && r.heat.consistent && r.fuelPower) {
    const f = r.fuelPower
    return { brake: r.heat.brake / f, cooling: r.heat.cooling / f, exhaust: r.heat.exhaust / f, friction: r.heat.friction / f, source: 'calculated' as const }
  }
  if (p.shares === 'tb') return { brake: 0.235, cooling: 0.4, exhaust: 0.31, friction: 0.055, source: '31/40/5.5 split' as const }
  return { brake: 0.3, cooling: 0.3, exhaust: 0.4, friction: 0, source: '40/30/30 split' as const }
}

/* ------------------------------ exam presets ------------------------------ */

const ORCHARD = airStandardCycle({ kind: 'otto', r: 10, P1: 105, T1: 295, alpha: alphaFromPmax(8902, 10, 105, AIR), delta: 1 })

export interface Preset {
  id: string
  label: string
  note: string
  params: Partial<PerfParams>
  /** numbers to compare against (from the notes / marking) */
  expect: string
  errata?: string
}

const base: Partial<PerfParams> = { area: 0, cycle: 4, loss: 'none', fuel: 'none', air: 'none', pAmb: 100, TAmb: 300, af: 15 }

export const PRESETS: Preset[] = [
  {
    id: 'mahindra',
    label: 'Exam 17/18 · Mahindra 60 kW',
    note: 'A 60 kW Mahindra tractor: bore 100 mm, stroke 124 mm, clearance volume = stroke volume / 6. Find PD, TCV and CR. Speed not given — 2000 rpm assumed for the power figures.',
    params: { ...base, bore: 100, stroke: 124, cylinders: 3, clr: 'pd', clrVal: 6, rpm: 2000, out: 'bp', outVal: 60, hv: 44 },
    expect: 'PD = 973 400 mm³ (π = 3.14; 973 894 with full π), TCV = 1 135 633 mm³, CR = 7.0',
  },
  {
    id: 'six-si',
    label: 'Exam 21/22 · 6-cyl SI 60 kW',
    note: 'Four-stroke 6-cylinder SI engine, 60 kW, bore 100 mm, stroke 125 mm, clearance = ⅛ stroke volume, firing order 1-6-3-5-2-4 (see the Crankshafts scene). Find PD, TCV, CR and thermal efficiency (ASE, Otto).',
    params: { ...base, bore: 100, stroke: 125, cylinders: 6, clr: 'pd', clrVal: 8, rpm: 3000, out: 'bp', outVal: 60, hv: 44 },
    expect: 'PD = 981.7 cm³, TCV = 1104.5 cm³, CR = 9, ASE = 1 − 1/9^0.4 = 58.5 %',
  },
  {
    id: 'genset',
    label: 'Exam 22/23 · 100 kVA genset',
    note: '8-cylinder four-stroke diesel genset: piston area 0.25 m², stroke 0.3 m, total cylinder volume 0.1 m³, η = 25 %, ηm = 75 %, 3000 kW at 2000 rpm, firing order 1-7-5-3-8-6-2-4. Find Vc, bmep and imep.',
    params: { ...base, bore: 564.2, stroke: 300, area: 0.25, cylinders: 8, clr: 'tcv', clrVal: 100, rpm: 2000, out: 'bp', outVal: 3000, loss: 'etaM', lossVal: 0.75, fuel: 'etaBth', fuelVal: 0.25, hv: 44 },
    expect: 'Vc = 0.025 m³, bmep = 300 kPa, imep = 400 kPa (FP = 1000 kW)',
    errata: 'The data are not self-consistent: 3000 kW is thirty times a "100 kVA" set, and a 0.3 m stroke at 2000 rpm means a mean piston speed of 20 m/s — above the usual 8–15 m/s range. The method is what is examined.',
  },
  {
    id: 'ex4',
    label: '8-cyl SI from ηv',
    note: '8-cylinder four-stroke SI, 100 × 120 mm, 3000 rpm, A/F 15, ηv 0.85, ηbth 0.3, LHV 45 MJ/kg, inlet 100 kPa 300 K. Brake power from the air the engine breathes (also the tractor exam questions).',
    params: { ...base, bore: 100, stroke: 120, cylinders: 8, clr: 'cr', clrVal: 8, rpm: 3000, out: 'fuel', outVal: 0.3, air: 'etaV', airVal: 0.85, fuel: 'fromAir', af: 15, hv: 45 },
    expect: 'Swept 11.31 m³/min, ρ = 1.16 kg/m³, ṁa = 11.15 kg/min, ṁf = 0.743 kg/min, BP = 167.3 kW, bmep = 887.5 kPa',
  },
  {
    id: 'ex1',
    label: '2500 kW engine',
    note: 'Four-stroke engine developing 2500 kW at 2000 rpm, stroke volume 0.07 m³, ηth 0.30, HV 40 MJ/kg, chemically correct A/F 15; ηm 0.8. Drawn as one equivalent cylinder of A·L = 0.07 m³.',
    params: { ...base, bore: 504.6, stroke: 350, area: 0.2, cylinders: 1, clr: 'cr', clrVal: 16, rpm: 2000, out: 'bp', outVal: 2500, loss: 'etaM', lossVal: 0.8, fuel: 'etaBth', fuelVal: 0.3, air: 'fromFuel', af: 15, hv: 40 },
    expect: 'ṁf = 12.5 kg/min, ṁa = 187.5 kg/min, sfc = 0.3 kg/kWh, bmep = 2142.9 kPa, imep = 2678.6 kPa',
  },
  {
    id: 'ex6',
    label: 'Design a 4-cyl SI',
    note: '4-cylinder SI engine for 160 N·m: with bmep 950 kPa the swept volume is 2.116 L → D = L = 87.65 mm. Max power at 825 kPa bmep and 5000 rpm (piston speed limit 15 m/s gives 5134 rpm).',
    params: { ...base, bore: 87.65, stroke: 87.65, cylinders: 4, clr: 'cr', clrVal: 9, rpm: 5000, out: 'bmep', outVal: 825, hv: 44 },
    expect: 'Vs = 2.116 L, D = L = 87.65 mm, BP = 72.73 kW, Sp = 14.6 m/s',
  },
  {
    id: 'ex7',
    label: '8-cyl, Vc 90 cc',
    note: '8-cylinder four-stroke petrol engine, 100 × 120 mm, clearance 90 cm³ per cylinder, 20 kg/h fuel, 160 N·m at 4500 rpm, HV 44 MJ/kg.',
    params: { ...base, bore: 100, stroke: 120, cylinders: 8, clr: 'cv', clrVal: 90, rpm: 4500, out: 'torque', outVal: 160, fuel: 'rate', fuelVal: 20, hv: 44 },
    expect: 'CR = 11.47, BP = 75.41 kW, bmep = 2.667 bar, ηbth = 30.85 %',
  },
  {
    id: 'orchard',
    label: 'Exam 22/23 · orchard tractor',
    note: '4-stroke, 4-cylinder gasoline orchard tractor: 300 rpm, 100 × 120 mm, 105 kPa / 295 K at the start of compression, 8902 kPa / 2500 K at the start of expansion, torque 160 N·m. The imep is the Otto-cycle mep (r = 10). Find IP, BP and FP.',
    params: { ...base, bore: 100, stroke: 120, cylinders: 4, clr: 'cr', clrVal: 10, rpm: 300, out: 'torque', outVal: 160, loss: 'imep', lossVal: Math.round(ORCHARD.mep * 10) / 10, hv: 44, pAmb: 105, TAmb: 295 },
    expect: `mep = ${ORCHARD.mep.toFixed(0)} kPa → IP ≈ 9.88 kW, BP = 5.03 kW, FP ≈ 4.85 kW`,
    errata: 'The notes’ worked example with the same cycle data uses Cv = 0.778, giving mep = 1135.7 kPa and IP ≈ 10.7 kW. With Cv = 0.718 the mep is ≈ 1048 kPa.',
  },
  {
    id: 'tb-q9',
    label: '2-cyl 100 × 130',
    note: 'Two-cylinder 100 mm × 130 mm engine; each cylinder’s clearance volume is one fifth of its total cylinder volume. Find the total piston displacement, the clearance volume and the CR.',
    params: { ...base, bore: 100, stroke: 130, cylinders: 2, clr: 'tcvf', clrVal: 5, rpm: 2000, out: 'torque', outVal: 120, hv: 44 },
    expect: 'Total PD = 2042 cm³ (1021 cm³ each), CV = 255.3 cm³, CR = 5',
  },
]

/* ------------------------------ live (3D → panel) ------------------------------ */

export const live = { crank: 0, shaftRpm: 0 }
