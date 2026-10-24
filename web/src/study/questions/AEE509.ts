import { SRC } from '@/content/citations'
import { PRESETS as PERF } from '@/modules/engine/performance/model'
import { capBoilingPointC } from '@/physics/cooling'
import {
  bmep,
  displacementForTorque,
  governorRegulation,
  imepFromBmep,
  indicatedFromBrake,
  indicatedThermalEfficiency,
  sfc,
  squareBore,
} from '@/physics/engine'
import { enginePerformance } from '@/physics/engineExtra'
import { fuelRateForPower, powerFromAir, specificAirConsumption } from '@/physics/fuel'
import { AIR, airStandardCycle, alphaFromPmax, deltaFromCutoffFraction, dualFromPmaxEqualHeat } from '@/physics/thermo'
import { n } from '@/ui/Working'
import type { Question } from '../types'

/** Load one of the performance scene's own exam presets. */
const perf = (id: string) => {
  const p = PERF.find((x) => x.id === id)
  return p ? { ...p.params, preset: id } : undefined
}

const base = { cylinders: 1, cycle: 4 as const, rpm: 2000, hv: 44e6, pAmb: 100e3, TAmb: 300, output: { kind: 'bp' as const, value: 60e3 } }

export const AEE509: Question[] = [
  {
    id: '509-ex1-fuel',
    course: 'AEE509',
    topic: 'Fuel & air consumption',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Fuel and air for a 2500 kW engine',
    statement:
      'An engine develops 2500 kW with a thermal efficiency of 30 %. The fuel has a heating value of 40 000 kJ/kg and the chemically correct air–fuel ratio is 15 : 1. Find the fuel rate (kg/min), the air rate (kg/min), the specific fuel consumption and the specific air consumption (kg/kWh).',
    answers: [
      { key: 'mf', label: '\\dot m_f', unit: 'kg/min', expected: 12.5 },
      { key: 'ma', label: '\\dot m_a', unit: 'kg/min', expected: 187.5 },
      { key: 'sfc', label: 'sfc', unit: 'kg/kWh', expected: 0.3 },
      { key: 'sac', label: 'sac', unit: 'kg/kWh', expected: 4.5 },
    ],
    solve: () => {
      const mf = fuelRateForPower(2500e3, 40e6, 0.3) * 60
      const s = sfc(mf * 60, 2500)
      return { mf, ma: mf * 15, sfc: s, sac: specificAirConsumption(s, 15) }
    },
    working: (r) => [
      { label: 'Fuel rate', tex: '\\dot m_f = \\dfrac{BP}{\\eta_{th}\\,HV}', sub: '\\dfrac{2500}{0.30 \\times 40\\,000}\\times 60', result: `= ${n(r.mf)}\\ \\text{kg/min}`, cite: SRC.misc509('p5, Ex 1') },
      { label: 'Air rate', tex: '\\dot m_a = (A/F)\\,\\dot m_f', sub: `15 \\times ${n(r.mf)}`, result: `= ${n(r.ma)}\\ \\text{kg/min}` },
      { label: 'Specific consumptions', tex: 'sfc = \\dfrac{\\dot m_f}{BP},\\quad sac = (A/F)\\,sfc', sub: `\\dfrac{${n(r.mf * 60)}}{2500},\\ 15 \\times ${n(r.sfc)}`, result: `= ${n(r.sfc)},\\ ${n(r.sac)}\\ \\text{kg/kWh}` },
    ],
    cite: SRC.misc509('p5, Example 1'),
    params: perf('ex1'),
  },
  {
    id: '509-ex2-mep',
    course: 'AEE509',
    topic: 'Mean effective pressure',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'bmep and imep of the 2500 kW engine',
    statement: 'The same four-stroke engine (2500 kW at 2000 rpm) has a stroke volume of 0.07 m³ and a mechanical efficiency of 80 %. Find the brake and indicated mean effective pressures.',
    answers: [
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 2142.9 },
      { key: 'imep', label: 'imep', unit: 'kPa', expected: 2678.6 },
    ],
    solve: () => {
      const b = bmep(2500e3, 0.35, 0.2, 2000, 1, 4)
      return { bmep: b / 1000, imep: imepFromBmep(b, 0.8) / 1000 }
    },
    working: (r) => [
      { label: 'bmep (four-stroke: N/2 cycles per minute)', tex: 'bmep = \\dfrac{60\\,BP}{L A\\,(N/2)}', sub: '\\dfrac{60 \\times 2500\\times10^3}{0.07 \\times 1000}', result: `= ${n(r.bmep)}\\ \\text{kPa}`, cite: SRC.misc509('Ex 2') },
      { label: 'imep', tex: 'imep = \\dfrac{bmep}{\\eta_m}', sub: `\\dfrac{${n(r.bmep)}}{0.8}`, result: `= ${n(r.imep)}\\ \\text{kPa}` },
    ],
    cite: SRC.misc509('Example 2'),
    params: perf('ex1'),
  },
  {
    id: '509-ex3-air',
    course: 'AEE509',
    topic: 'Fuel & air consumption',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Brake power from the air flow',
    statement:
      'An engine of thermal efficiency 25 % draws 195 kg of air per minute. The fuel–air ratio is 0.9 of the stoichiometric value (A/F = 15) and the heating value is 40 MJ/kg. Find the actual A/F ratio, the fuel rate and the brake power.',
    answers: [
      { key: 'af', label: 'A/F', unit: '', expected: 16.67 },
      { key: 'mf', label: '\\dot m_f', unit: 'kg/min', expected: 11.7 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 1950 },
    ],
    solve: () => {
      const fa = 0.9 / 15
      return { af: 1 / fa, mf: 195 * fa, bp: powerFromAir(0.25, 40e6, 195 / 60, fa) / 1000 }
    },
    working: (r) => [
      { label: 'Fuel–air ratio', tex: 'F/A = 0.9 \\times \\tfrac{1}{15}', result: `= ${n(1 / r.af)}\\ \\Rightarrow\\ A/F = ${n(r.af)}` },
      { label: 'Fuel rate', tex: '\\dot m_f = \\dot m_a\\,(F/A)', sub: `195 \\times ${n(1 / r.af)}`, result: `= ${n(r.mf)}\\ \\text{kg/min}` },
      { label: 'Brake power', tex: 'BP = \\eta\\,\\dot m_f\\,HV', sub: `0.25 \\times \\tfrac{${n(r.mf)}}{60} \\times 40\\,000`, result: `= ${n(r.bp)}\\ \\text{kW}`, cite: SRC.misc509('p5, Ex 3') },
    ],
    cite: SRC.misc509('p5, Example 3'),
  },
  {
    id: '509-ex4-volumetric',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: '8-cylinder SI engine from its volumetric efficiency',
    statement:
      'An 8-cylinder four-stroke SI engine, bore 100 mm, stroke 120 mm, runs at 3000 rpm with volumetric efficiency 0.85 (inlet 100 kPa, 300 K). A/F = 15, brake thermal efficiency 30 %, LHV 45 MJ/kg. Find the brake power and bmep.',
    answers: [
      { key: 'bp', label: 'BP', unit: 'kW', expected: 167.3 },
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 887.5 },
    ],
    solve: () => {
      const r = enginePerformance({ ...base, cylinders: 8, bore: 0.1, stroke: 0.12, rpm: 3000, hv: 45e6, clearance: { kind: 'cr', value: 8 }, output: { kind: 'fuel', etaBth: 0.3 }, air: { kind: 'etaV', value: 0.85 }, fuel: { kind: 'fromAir' }, airFuel: 15 })
      return { bp: r.bp! / 1000, bmep: r.bmep! / 1000 }
    },
    working: (r) => [
      { label: 'Swept volume rate', tex: '\\dot V_s = \\tfrac{\\pi}{4}D^2 L \\cdot z \\cdot \\tfrac{N}{2}', sub: '\\tfrac{\\pi}{4}(0.1)^2(0.12)\\times 8 \\times 1500', result: '= 11.31\\ \\text{m}^3/\\text{min}', cite: SRC.misc509('Ex 4') },
      { label: 'Air and fuel', tex: '\\dot m_a = \\eta_v\\,\\rho\\,\\dot V_s,\\quad \\rho = \\dfrac{p}{RT}', sub: '0.85 \\times \\dfrac{100}{0.287\\times300} \\times 11.31', result: '= 11.15\\ \\text{kg/min},\\ \\dot m_f = \\dot m_a/15' },
      { label: 'Brake power and bmep', tex: 'BP = \\eta_{bth}\\,\\dot m_f\\,HV,\\quad bmep = \\dfrac{60\\,BP}{L A z (N/2)}', result: `BP = ${n(r.bp)}\\ \\text{kW},\\ bmep = ${n(r.bmep)}\\ \\text{kPa}` },
    ],
    cite: SRC.misc509('Example 4'),
    params: perf('ex4'),
  },
  {
    id: '509-ex5-two-stroke',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'two-stroke',
    title: 'Two-stroke mower engine',
    statement:
      'A two-stroke lawn-mower engine gives 4.68 kW brake power with a mechanical efficiency of 85 %. It uses 2.4 L/h of petrol (density 760 kg/m³, heating value 44 MJ/kg). Find the indicated power and the indicated thermal efficiency.',
    answers: [
      { key: 'ip', label: 'IP', unit: 'kW', expected: 5.506 },
      { key: 'eta', label: '\\eta_{ith}', unit: '%', expected: 24.7 },
    ],
    solve: () => {
      const ip = indicatedFromBrake(4.68e3, 0.85)
      const mf = (2.4e-3 * 760) / 3600
      return { ip: ip / 1000, eta: indicatedThermalEfficiency(ip, mf, 44e6) * 100 }
    },
    working: (r) => [
      { label: 'Indicated power', tex: 'IP = \\dfrac{BP}{\\eta_m}', sub: '\\dfrac{4.68}{0.85}', result: `= ${n(r.ip)}\\ \\text{kW}`, cite: SRC.misc509('p6, Ex 5') },
      { label: 'Fuel mass rate', tex: '\\dot m_f = \\dot V\\rho', sub: '2.4\\times10^{-3} \\times 760', result: '= 1.824\\ \\text{kg/h}' },
      { label: 'Indicated thermal efficiency', tex: '\\eta_{ith} = \\dfrac{IP}{\\dot m_f\\,HV}', sub: `\\dfrac{${n(r.ip)}}{(1.824/3600)\\times 44\\,000}`, result: `= ${n(r.eta, 3)}\\,\\%` },
    ],
    cite: SRC.misc509('p6, Example 5'),
  },
  {
    id: '509-ex6-design',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Size a 4-cylinder engine for 160 N·m',
    statement:
      'A four-stroke 4-cylinder SI engine must give 160 N·m at a bmep of 950 kPa, with bore equal to stroke. Find the total swept volume and the bore. At maximum power the bmep is 825 kPa at 5000 rpm: find the brake power.',
    answers: [
      { key: 'Vs', label: 'V_s', unit: 'L', expected: 2.116 },
      { key: 'D', label: 'D = L', unit: 'mm', expected: 87.65 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 72.7 },
    ],
    solve: () => {
      const Vd = displacementForTorque(160, 950e3, 4)
      const D = squareBore(Vd / 4)
      const r = enginePerformance({ ...base, cylinders: 4, bore: D, stroke: D, rpm: 5000, clearance: { kind: 'cr', value: 9 }, output: { kind: 'bmep', value: 825e3 } })
      return { Vs: Vd * 1e3, D: D * 1000, bp: r.bp! / 1000 }
    },
    working: (r) => [
      { label: 'Swept volume from torque', tex: 'T = \\dfrac{bmep\\,V_s}{4\\pi} \\Rightarrow V_s = \\dfrac{4\\pi T}{bmep}', sub: '\\dfrac{4\\pi\\times160}{950\\times10^3}', result: `= ${n(r.Vs)}\\ \\text{L}`, cite: SRC.misc509('Ex 6') },
      { label: 'Bore = stroke', tex: '\\tfrac{\\pi}{4}D^3 = V_s/4', result: `D = ${n(r.D)}\\ \\text{mm}` },
      { label: 'Power at 825 kPa', tex: 'BP = \\dfrac{bmep\\,V_s\\,N}{120}', sub: `\\dfrac{825\\times10^3 \\times ${n(r.Vs / 1000)} \\times 5000}{120}`, result: `= ${n(r.bp)}\\ \\text{kW}` },
    ],
    cite: SRC.misc509('Example 6'),
    params: perf('ex6'),
  },
  {
    id: '509-ex7-torque',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: '8-cylinder engine with 90 cc clearance',
    statement:
      'An 8-cylinder four-stroke petrol engine, 100 mm bore × 120 mm stroke, has a clearance volume of 90 cm³ per cylinder. It uses 20 kg/h of fuel (44 MJ/kg) and gives 160 N·m at 4500 rpm. Find the compression ratio, brake power, bmep and brake thermal efficiency.',
    answers: [
      { key: 'cr', label: 'CR', unit: '', expected: 11.47 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 75.4 },
      { key: 'bmep', label: 'bmep', unit: 'bar', expected: 2.667 },
      { key: 'eta', label: '\\eta_{bth}', unit: '%', expected: 30.85 },
    ],
    solve: () => {
      const r = enginePerformance({ ...base, cylinders: 8, bore: 0.1, stroke: 0.12, rpm: 4500, clearance: { kind: 'cv', value: 90e-6 }, output: { kind: 'torque', value: 160 }, fuel: { kind: 'rate', kgPerH: 20 } })
      return { cr: r.CR, bp: r.bp! / 1000, bmep: r.bmep! / 1e5, eta: r.etaBth! * 100 }
    },
    working: (r) => [
      { label: 'Compression ratio', tex: 'CR = \\dfrac{V_s + V_c}{V_c}', sub: '\\dfrac{942.5 + 90}{90}', result: `= ${n(r.cr)}`, cite: SRC.misc509('Ex 7') },
      { label: 'Brake power', tex: 'BP = \\dfrac{2\\pi N T}{60}', sub: '\\dfrac{2\\pi \\times 4500 \\times 160}{60}', result: `= ${n(r.bp)}\\ \\text{kW}` },
      { label: 'bmep', tex: 'bmep = \\dfrac{60\\,BP}{L A z (N/2)}', result: `= ${n(r.bmep)}\\ \\text{bar}` },
      { label: 'Brake thermal efficiency', tex: '\\eta_{bth} = \\dfrac{BP}{\\dot m_f HV}', sub: `\\dfrac{${n(r.bp)}}{(20/3600)\\times 44\\,000}`, result: `= ${n(r.eta)}\\,\\%` },
    ],
    cite: SRC.misc509('Example 7'),
    params: perf('ex7'),
  },
  {
    id: '509-genset-2223',
    course: 'AEE509',
    topic: 'Mean effective pressure',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Genset: clearance volume, bmep and imep',
    statement:
      'An 8-cylinder four-stroke diesel genset has piston area 0.25 m², stroke 0.3 m and total cylinder volume 0.1 m³. It develops 3000 kW at 2000 rpm with a mechanical efficiency of 75 %. Find the clearance volume, bmep, imep and friction power.',
    answers: [
      { key: 'vc', label: 'V_c', unit: 'm³', expected: 0.025 },
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 300 },
      { key: 'imep', label: 'imep', unit: 'kPa', expected: 400 },
      { key: 'fp', label: 'FP', unit: 'kW', expected: 1000 },
    ],
    solve: () => {
      const r = enginePerformance({ ...base, cylinders: 8, bore: 0, area: 0.25, stroke: 0.3, clearance: { kind: 'tcv', value: 0.1 }, output: { kind: 'bp', value: 3000e3 }, losses: { kind: 'etaM', value: 0.75 } })
      return { vc: r.CV, bmep: r.bmep! / 1000, imep: r.imep! / 1000, fp: r.fp! / 1000 }
    },
    working: (r) => [
      { label: 'Clearance volume', tex: 'V_c = TCV - A L', sub: '0.1 - 0.25\\times0.3', result: `= ${n(r.vc)}\\ \\text{m}^3`, cite: SRC.exam509('2022/23 Q2') },
      { label: 'bmep', tex: 'bmep = \\dfrac{60\\,BP}{L A z (N/2)}', sub: '\\dfrac{60\\times3000}{0.3\\times0.25\\times8\\times1000}', result: `= ${n(r.bmep)}\\ \\text{kPa}` },
      { label: 'imep and friction power', tex: 'imep = \\dfrac{bmep}{\\eta_m},\\quad FP = \\dfrac{BP}{\\eta_m} - BP', result: `imep = ${n(r.imep)}\\ \\text{kPa},\\ FP = ${n(r.fp)}\\ \\text{kW}` },
    ],
    cite: SRC.exam509('2022/23 Q2'),
    params: perf('genset'),
  },
  {
    id: '509-mahindra-1718',
    course: 'AEE509',
    topic: 'Swept volume & compression ratio',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Mahindra tractor: piston displacement and CR',
    statement: 'A tractor engine has a bore of 100 mm and a stroke of 124 mm. The clearance volume is one-sixth of the piston displacement. Find the piston displacement (per cylinder) and the compression ratio.',
    answers: [
      { key: 'pd', label: 'PD', unit: 'cm³', expected: 973.9 },
      { key: 'cr', label: 'CR', unit: '', expected: 7 },
    ],
    solve: () => {
      const r = enginePerformance({ ...base, bore: 0.1, stroke: 0.124, clearance: { kind: 'pdFraction', value: 1 / 6 } })
      return { pd: r.PD * 1e6, cr: r.CR }
    },
    working: (r) => [
      { label: 'Piston displacement', tex: 'PD = \\tfrac{\\pi}{4} D^2 L', sub: '\\tfrac{\\pi}{4}(10)^2(12.4)', result: `= ${n(r.pd)}\\ \\text{cm}^3`, cite: SRC.exam509('2017/18 Q2b'), errata: 'The worked answer uses π = 3.14 and prints 973.4 cm³; both are accepted.' },
      { label: 'Compression ratio', tex: 'CR = \\dfrac{PD + CV}{CV} = \\dfrac{PD + PD/6}{PD/6}', result: `= ${n(r.cr)}` },
    ],
    cite: SRC.exam509('2017/18 Q2b'),
    params: perf('mahindra'),
  },
  {
    id: '509-six-si-2122',
    course: 'AEE509',
    topic: 'Swept volume & compression ratio',
    moduleId: 'engine',
    sceneId: 'performance',
    title: '6-cylinder SI engine: CR and air-standard efficiency',
    statement: 'A four-stroke 6-cylinder SI engine has bore 100 mm and stroke 125 mm; the clearance volume is ⅛ of the stroke volume. Find the piston displacement per cylinder, the total cylinder volume, the compression ratio and the Otto air-standard efficiency (k = 1.4).',
    answers: [
      { key: 'pd', label: 'PD', unit: 'cm³', expected: 981.7 },
      { key: 'tcv', label: 'TCV', unit: 'cm³', expected: 1104.5 },
      { key: 'cr', label: 'CR', unit: '', expected: 9 },
      { key: 'eta', label: '\\eta_{Otto}', unit: '%', expected: 58.5, abs: 0.3 },
    ],
    solve: () => {
      const r = enginePerformance({ ...base, cylinders: 6, bore: 0.1, stroke: 0.125, clearance: { kind: 'pdFraction', value: 1 / 8 } })
      const c = airStandardCycle({ kind: 'otto', r: r.CR, P1: 100, T1: 300, alpha: 2, delta: 1 })
      return { pd: r.PD * 1e6, tcv: r.TCV * 1e6, cr: r.CR, eta: c.etaFormula * 100 }
    },
    working: (r) => [
      { label: 'Displacement and total volume', tex: 'PD = \\tfrac{\\pi}{4}D^2L,\\quad TCV = PD + PD/8', result: `PD = ${n(r.pd)},\\ TCV = ${n(r.tcv)}\\ \\text{cm}^3`, cite: SRC.exam509('2021/22 Q3b') },
      { label: 'Compression ratio', tex: 'CR = TCV/CV', result: `= ${n(r.cr)}` },
      { label: 'Otto efficiency', tex: '\\eta = 1 - \\dfrac{1}{r^{k-1}}', sub: '1 - \\dfrac{1}{9^{0.4}}', result: `= ${n(r.eta, 3)}\\,\\%`, cite: SRC.thermo509('Otto cycle') },
    ],
    cite: SRC.exam509('2021/22 Q3b'),
    params: perf('six-si'),
  },
  {
    id: '509-otto-ex9',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Otto cycle: efficiency and mean effective pressure',
    statement: 'An Otto cycle has a compression ratio of 10. At the start of compression the air is at 105 kPa, 295 K; the maximum pressure is 8902 kPa (2500 K). Take k = 1.4, cv = 0.718 kJ/kg·K. Find T₂, the air-standard efficiency and the mean effective pressure.',
    answers: [
      { key: 'T2', label: 'T_2', unit: 'K', expected: 741 },
      { key: 'eta', label: '\\eta', unit: '%', expected: 60.2, abs: 0.2 },
      { key: 'mep', label: 'mep', unit: 'kPa', expected: 1048 },
    ],
    solve: () => {
      const c = airStandardCycle({ kind: 'otto', r: 10, P1: 105, T1: 295, alpha: alphaFromPmax(8902, 10, 105, AIR), delta: 1 })
      return { T2: c.s2.T, eta: c.eta * 100, mep: c.mep }
    },
    working: (r) => [
      { label: 'End of compression', tex: 'T_2 = T_1 r^{k-1}', sub: '295 \\times 10^{0.4}', result: `= ${n(r.T2)}\\ \\text{K}`, cite: SRC.misc509('p9, Ex 9') },
      { label: 'Efficiency', tex: '\\eta = 1 - r^{1-k}', result: `= ${n(r.eta, 3)}\\,\\%` },
      { label: 'Mean effective pressure', tex: 'mep = \\dfrac{\\eta\\,c_v (T_3 - T_2)}{v_1 - v_2}', result: `= ${n(r.mep)}\\ \\text{kPa}`, errata: 'The worked example uses cv = 0.778 and prints 1135.7 kPa; with 0.718 the mep is ≈ 1048 kPa.' },
    ],
    cite: SRC.misc509('p9, Example 9'),
    errata: 'otto-cv',
    params: { cycle: 'otto', r: 10, P1: 105, T1: 295, q: 1263 },
  },
  {
    id: '509-cutoff-ex13',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Diesel cut-off ratio from the cut-off point',
    statement: 'In a Diesel cycle with a compression ratio of 16, fuel is cut off at 10 % of the stroke. Find the cut-off ratio δ.',
    answers: [{ key: 'delta', label: '\\delta', unit: '', expected: 2.5 }],
    solve: () => ({ delta: deltaFromCutoffFraction(0.1, 16) }),
    working: (r) => [
      { label: 'Cut-off ratio', tex: '\\delta = \\dfrac{V_3}{V_2} = 1 + x\\,(r - 1)', sub: '1 + 0.1(16 - 1)', result: `= ${n(r.delta)}`, cite: SRC.misc509('Ex 13') },
    ],
    cite: SRC.misc509('Example 13'),
  },
  {
    id: '509-dual-exam',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Dual cycle: state at the end of compression',
    statement: 'A dual cycle has r = 16, starting at 1 bar and 50 °C. The maximum pressure is 70 bar and equal heat is added at constant volume and at constant pressure. Find T₂ and P₂ at the end of compression.',
    answers: [
      { key: 'T2', label: 'T_2', unit: 'K', expected: 979.1 },
      { key: 'P2', label: 'P_2', unit: 'kPa', expected: 4850 },
    ],
    solve: () => {
      const { alpha, delta } = dualFromPmaxEqualHeat(7000, 16, 100, 323)
      const c = airStandardCycle({ kind: 'dual', r: 16, P1: 100, T1: 323, alpha, delta })
      return { T2: c.s2.T, P2: c.s2.P }
    },
    working: (r) => [
      { label: 'Isentropic compression', tex: 'T_2 = T_1 r^{k-1},\\quad P_2 = P_1 r^{k}', sub: '323 \\times 16^{0.4},\\ 100 \\times 16^{1.4}', result: `T_2 = ${n(r.T2)}\\ \\text{K},\\ P_2 = ${n(r.P2)}\\ \\text{kPa}`, cite: SRC.thermo509('dual cycle') },
    ],
    cite: SRC.exam509('dual cycle (recurring)'),
  },
  {
    id: '509-governor',
    course: 'AEE509',
    topic: 'Governing',
    moduleId: 'engine',
    sceneId: 'air-governor',
    title: 'Governor regulation',
    statement: 'A governed engine runs at 1600 rpm with no load and 1500 rpm at full load. Find the governor regulation.',
    answers: [{ key: 'reg', label: '\\text{regulation}', unit: '%', expected: 6.45 }],
    solve: () => ({ reg: governorRegulation(1600, 1500) }),
    working: (r) => [
      { label: 'Regulation', tex: '\\text{reg} = \\dfrac{2(N_{nl} - N_{fl})}{N_{nl} + N_{fl}}\\times100', sub: '\\dfrac{2(1600-1500)}{1600+1500}\\times100', result: `= ${n(r.reg)}\\,\\%`, cite: SRC.supp509('governor') },
    ],
    cite: SRC.supp509('governor regulation example'),
  },
  {
    id: '509-pressure-cap',
    course: 'AEE509',
    topic: 'Cooling',
    moduleId: 'engine',
    sceneId: 'cooling',
    title: 'Boiling point under a pressure cap',
    statement: 'A radiator pressure cap holds 90 kPa above atmospheric (101.325 kPa). At what temperature does the coolant (water) boil?',
    answers: [{ key: 'T', label: 'T_{boil}', unit: '°C', expected: 118.9, abs: 1 }],
    solve: () => ({ T: capBoilingPointC(90) }),
    working: (r) => [
      { label: 'Absolute pressure in the system', tex: 'p = p_{atm} + p_{cap}', sub: '101.3 + 90', result: '= 191.3\\ \\text{kPa}' },
      { label: 'Saturation temperature', tex: 'T_{sat}(191.3\\ \\text{kPa})', result: `= ${n(r.T)}\\ ^\\circ\\text{C}`, cite: SRC.tb509('Ch 7, pressure cap') },
    ],
    cite: SRC.tb509('Ch 7, radiator pressure cap'),
  },
]
