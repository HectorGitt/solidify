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
import { num, parametric, tnum, type Vals } from '../variants'

/**
 * One of the performance scene's own exam presets, with the question's given numbers laid over it.
 * The preset stays selected only while every given number matches it; `derived` values (computed
 * from the givens, e.g. a bore) are applied without affecting that check.
 */
const perf = (id: string, given: Record<string, number> = {}, derived: Record<string, number> = {}): Record<string, unknown> => {
  const p = PERF.find((x) => x.id === id)
  if (!p) return {}
  const params = p.params as Record<string, unknown>
  const same = Object.entries(given).every(([k, x]) => typeof params[k] === 'number' && Math.abs((params[k] as number) - x) <= 1e-9 * Math.max(1, Math.abs(x)))
  return { ...p.params, ...given, ...(same ? {} : derived), preset: same ? id : null }
}

const base = { cylinders: 1, cycle: 4 as const, rpm: 2000, hv: 44e6, pAmb: 100e3, TAmb: 300, output: { kind: 'bp' as const, value: 60e3 } }

/** "A" or "An" before a number ("an 8-cylinder", "an 11-cylinder"). */
const an = (x: number) => (/^(8|11|18)/.test(num(x)) ? 'An' : 'A')

/** Mean piston speed 2LN/60, m/s (L in mm). */
const pistonSpeed = (strokeMm: number, rpm: number) => (2 * (strokeMm / 1000) * rpm) / 60

/** Bore = stroke design (worked example 6): swept volume (m³) and bore (m). */
const squareDesign = (v: Vals) => {
  const Vd = displacementForTorque(v.T, v.b1 * 1e3, 4)
  return { Vd, D: squareBore(Vd / v.z) }
}

/** Otto cycle of worked example 9. */
const ottoEx9 = (v: Vals) => airStandardCycle({ kind: 'otto', r: v.r, P1: v.P1, T1: v.T1, alpha: alphaFromPmax(v.Pmax, v.r, v.P1, AIR), delta: 1 })

export const AEE509: Question[] = [
  parametric({
    id: '509-ex1-fuel',
    course: 'AEE509',
    topic: 'Fuel & air consumption',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Fuel and air for a given power',
    inputs: [
      { key: 'P', value: 2500, min: 50, max: 3000, step: 10 },
      { key: 'eta', value: 30, min: 20, max: 40, step: 1 },
      { key: 'HV', value: 40000, min: 40000, max: 46000, step: 500 },
      { key: 'af', value: 15, min: 14, max: 16, step: 0.5 },
    ],
    statement: (v) =>
      `An engine develops ${num(v.P)} kW with a thermal efficiency of ${num(v.eta)} %. The fuel has a heating value of ${num(v.HV)} kJ/kg and the chemically correct air–fuel ratio is ${num(v.af)} : 1. Find the fuel rate (kg/min), the air rate (kg/min), the specific fuel consumption and the specific air consumption (kg/kWh).`,
    answers: [
      { key: 'mf', label: '\\dot m_f', unit: 'kg/min', expected: 12.5 },
      { key: 'ma', label: '\\dot m_a', unit: 'kg/min', expected: 187.5 },
      { key: 'sfc', label: 'sfc', unit: 'kg/kWh', expected: 0.3 },
      { key: 'sac', label: 'sac', unit: 'kg/kWh', expected: 4.5 },
    ],
    solve: (v) => {
      const mf = fuelRateForPower(v.P * 1e3, v.HV * 1e3, v.eta / 100) * 60
      const s = sfc(mf * 60, v.P)
      return { mf, ma: mf * v.af, sfc: s, sac: specificAirConsumption(s, v.af) }
    },
    working: (v, r) => [
      { label: 'Fuel rate', tex: '\\dot m_f = \\dfrac{BP}{\\eta_{th}\\,HV}', sub: `\\dfrac{${tnum(v.P)}}{${tnum(v.eta / 100)} \\times ${tnum(v.HV)}}\\times 60`, result: `= ${n(r.mf)}\\ \\text{kg/min}`, cite: SRC.misc509('p5, Ex 1') },
      { label: 'Air rate', tex: '\\dot m_a = (A/F)\\,\\dot m_f', sub: `${tnum(v.af)} \\times ${n(r.mf)}`, result: `= ${n(r.ma)}\\ \\text{kg/min}` },
      { label: 'Specific consumptions', tex: 'sfc = \\dfrac{\\dot m_f}{BP},\\quad sac = (A/F)\\,sfc', sub: `\\dfrac{${n(r.mf * 60)}}{${tnum(v.P)}},\\ ${tnum(v.af)} \\times ${n(r.sfc)}`, result: `= ${n(r.sfc)},\\ ${n(r.sac)}\\ \\text{kg/kWh}` },
    ],
    cite: SRC.misc509('p5, Example 1'),
    params: (v) => perf('ex1', { outVal: v.P, fuelVal: v.eta / 100, af: v.af, hv: v.HV / 1000 }),
  }),
  parametric({
    id: '509-ex2-mep',
    course: 'AEE509',
    topic: 'Mean effective pressure',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'bmep and imep from the brake power',
    inputs: [
      { key: 'P', value: 2500, min: 500, max: 3000, step: 50 },
      { key: 'N', value: 2000, min: 1000, max: 2500, step: 50 },
      { key: 'Vs', value: 0.07, min: 0.02, max: 0.1, step: 0.005 },
      { key: 'etaM', value: 80, min: 70, max: 90, step: 1 },
    ],
    statement: (v) =>
      `A four-stroke engine develops ${num(v.P)} kW at ${num(v.N)} rpm. Its stroke volume is ${num(v.Vs)} m³ and its mechanical efficiency is ${num(v.etaM)} %. Find the brake and indicated mean effective pressures.`,
    answers: [
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 2142.9 },
      { key: 'imep', label: 'imep', unit: 'kPa', expected: 2678.6 },
    ],
    solve: (v) => {
      const b = bmep(v.P * 1e3, v.Vs, 1, v.N, 1, 4)
      return { bmep: b / 1000, imep: imepFromBmep(b, v.etaM / 100) / 1000 }
    },
    // keep the bmep within what real engines reach (the past paper's 2143 kPa is already high)
    valid: (_v, r) => r.bmep >= 400 && r.bmep <= 2500,
    working: (v, r) => [
      { label: 'bmep (four-stroke: N/2 cycles per minute)', tex: 'bmep = \\dfrac{60\\,BP}{L A\\,(N/2)}', sub: `\\dfrac{60 \\times ${tnum(v.P)}\\times10^3}{${tnum(v.Vs)} \\times ${tnum(v.N / 2)}}`, result: `= ${n(r.bmep)}\\ \\text{kPa}`, cite: SRC.misc509('Ex 2') },
      { label: 'imep', tex: 'imep = \\dfrac{bmep}{\\eta_m}', sub: `\\dfrac{${n(r.bmep)}}{${tnum(v.etaM / 100)}}`, result: `= ${n(r.imep)}\\ \\text{kPa}` },
    ],
    cite: SRC.misc509('Example 2'),
    // the scene draws one equivalent cylinder of area 0.2 m², so the stroke carries the volume
    params: (v) => perf('ex1', { outVal: v.P, rpm: v.N, lossVal: v.etaM / 100 }, { stroke: (v.Vs / 0.2) * 1000 }),
  }),
  parametric({
    id: '509-ex3-air',
    course: 'AEE509',
    topic: 'Fuel & air consumption',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Brake power from the air flow',
    inputs: [
      { key: 'eta', value: 25, min: 20, max: 40, step: 1 },
      { key: 'ma', value: 195, min: 5, max: 250, step: 5 },
      { key: 'phi', value: 0.9, min: 0.8, max: 1.1, step: 0.05 },
      { key: 'afs', value: 15, min: 14, max: 15.5, step: 0.5 },
      { key: 'HV', value: 40, min: 40, max: 46, step: 1 },
    ],
    statement: (v) =>
      `An engine of thermal efficiency ${num(v.eta)} % draws ${num(v.ma)} kg of air per minute. The fuel–air ratio is ${num(v.phi)} of the stoichiometric value (A/F = ${num(v.afs)}) and the heating value is ${num(v.HV)} MJ/kg. Find the actual A/F ratio, the fuel rate and the brake power.`,
    answers: [
      { key: 'af', label: 'A/F', unit: '', expected: 16.67 },
      { key: 'mf', label: '\\dot m_f', unit: 'kg/min', expected: 11.7 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 1950 },
    ],
    solve: (v) => {
      const fa = v.phi / v.afs
      return { af: 1 / fa, mf: v.ma * fa, bp: powerFromAir(v.eta / 100, v.HV * 1e6, v.ma / 60, fa) / 1000 }
    },
    working: (v, r) => [
      { label: 'Fuel–air ratio', tex: `F/A = ${tnum(v.phi)} \\times \\tfrac{1}{${tnum(v.afs)}}`, result: `= ${n(1 / r.af)}\\ \\Rightarrow\\ A/F = ${n(r.af)}` },
      { label: 'Fuel rate', tex: '\\dot m_f = \\dot m_a\\,(F/A)', sub: `${tnum(v.ma)} \\times ${n(1 / r.af)}`, result: `= ${n(r.mf)}\\ \\text{kg/min}` },
      { label: 'Brake power', tex: 'BP = \\eta\\,\\dot m_f\\,HV', sub: `${tnum(v.eta / 100)} \\times \\tfrac{${n(r.mf)}}{60} \\times ${tnum(v.HV * 1000)}`, result: `= ${n(r.bp)}\\ \\text{kW}`, cite: SRC.misc509('p5, Ex 3') },
    ],
    cite: SRC.misc509('p5, Example 3'),
  }),
  parametric({
    id: '509-ex4-volumetric',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'SI engine power from its volumetric efficiency',
    inputs: [
      { key: 'z', value: 8, min: 2, max: 8, step: 1 },
      { key: 'D', value: 100, min: 80, max: 130, step: 5 },
      { key: 'L', value: 120, min: 90, max: 150, step: 5 },
      { key: 'N', value: 3000, min: 1500, max: 3600, step: 100 },
      { key: 'etaV', value: 0.85, min: 0.75, max: 0.95, step: 0.01 },
      { key: 'p', value: 100, min: 90, max: 105, step: 1 },
      { key: 'T', value: 300, min: 285, max: 320, step: 5 },
      { key: 'af', value: 15, min: 13, max: 17, step: 0.5 },
      { key: 'eta', value: 30, min: 25, max: 38, step: 1 },
      { key: 'hv', value: 45, min: 42, max: 46, step: 1 },
    ],
    statement: (v) =>
      `${an(v.z)} ${num(v.z)}-cylinder four-stroke SI engine, bore ${num(v.D)} mm, stroke ${num(v.L)} mm, runs at ${num(v.N)} rpm with volumetric efficiency ${num(v.etaV)} (inlet ${num(v.p)} kPa, ${num(v.T)} K). A/F = ${num(v.af)}, brake thermal efficiency ${num(v.eta)} %, LHV ${num(v.hv)} MJ/kg. Find the brake power and bmep.`,
    answers: [
      { key: 'bp', label: 'BP', unit: 'kW', expected: 167.3 },
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 887.5 },
    ],
    solve: (v) => {
      const r = enginePerformance({ ...base, cylinders: v.z, bore: v.D / 1000, stroke: v.L / 1000, rpm: v.N, hv: v.hv * 1e6, pAmb: v.p * 1e3, TAmb: v.T, clearance: { kind: 'cr', value: 8 }, output: { kind: 'fuel', etaBth: v.eta / 100 }, air: { kind: 'etaV', value: v.etaV }, fuel: { kind: 'fromAir' }, airFuel: v.af })
      return { bp: r.bp! / 1000, bmep: r.bmep! / 1000 }
    },
    // mean piston speed of a real SI engine (≤ 15 m/s) and a sensible stroke/bore ratio
    valid: (v) => pistonSpeed(v.L, v.N) <= 15 && v.L / v.D >= 0.8 && v.L / v.D <= 1.4,
    working: (v, r) => {
      const swept = (Math.PI / 4) * (v.D / 1000) ** 2 * (v.L / 1000) * v.z * (v.N / 2)
      const ma = v.etaV * (v.p / (0.287 * v.T)) * swept
      return [
        { label: 'Swept volume rate', tex: '\\dot V_s = \\tfrac{\\pi}{4}D^2 L \\cdot z \\cdot \\tfrac{N}{2}', sub: `\\tfrac{\\pi}{4}(${tnum(v.D / 1000)})^2(${tnum(v.L / 1000)})\\times ${tnum(v.z)} \\times ${tnum(v.N / 2)}`, result: `= ${n(swept)}\\ \\text{m}^3/\\text{min}`, cite: SRC.misc509('Ex 4') },
        { label: 'Air and fuel', tex: '\\dot m_a = \\eta_v\\,\\rho\\,\\dot V_s,\\quad \\rho = \\dfrac{p}{RT}', sub: `${tnum(v.etaV)} \\times \\dfrac{${tnum(v.p)}}{0.287\\times${tnum(v.T)}} \\times ${n(swept)}`, result: `= ${n(ma)}\\ \\text{kg/min},\\ \\dot m_f = \\dot m_a/${tnum(v.af)}` },
        { label: 'Brake power and bmep', tex: 'BP = \\eta_{bth}\\,\\dot m_f\\,HV,\\quad bmep = \\dfrac{60\\,BP}{L A z (N/2)}', result: `BP = ${n(r.bp)}\\ \\text{kW},\\ bmep = ${n(r.bmep)}\\ \\text{kPa}` },
      ]
    },
    cite: SRC.misc509('Example 4'),
    params: (v) => perf('ex4', { cylinders: v.z, bore: v.D, stroke: v.L, rpm: v.N, airVal: v.etaV, pAmb: v.p, TAmb: v.T, af: v.af, outVal: v.eta / 100, hv: v.hv }),
  }),
  parametric({
    id: '509-ex5-two-stroke',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'two-stroke',
    title: 'Two-stroke mower engine',
    inputs: [
      { key: 'bp', value: 4.68, min: 2, max: 8, step: 0.1 },
      { key: 'etaM', value: 85, min: 75, max: 90, step: 1 },
      { key: 'V', value: 2.4, min: 1, max: 4, step: 0.1 },
      { key: 'rho', value: 760, min: 720, max: 780, step: 5 },
      { key: 'hv', value: 44, min: 42, max: 46, step: 1 },
    ],
    statement: (v) =>
      `A two-stroke lawn-mower engine gives ${num(v.bp)} kW brake power with a mechanical efficiency of ${num(v.etaM)} %. It uses ${num(v.V)} L/h of petrol (density ${num(v.rho)} kg/m³, heating value ${num(v.hv)} MJ/kg). Find the indicated power and the indicated thermal efficiency.`,
    answers: [
      { key: 'ip', label: 'IP', unit: 'kW', expected: 5.506 },
      { key: 'eta', label: '\\eta_{ith}', unit: '%', expected: 24.7 },
    ],
    solve: (v) => {
      const ip = indicatedFromBrake(v.bp * 1e3, v.etaM / 100)
      const mf = (v.V * 1e-3 * v.rho) / 3600
      return { ip: ip / 1000, eta: indicatedThermalEfficiency(ip, mf, v.hv * 1e6) * 100 }
    },
    // a small petrol engine's indicated thermal efficiency
    valid: (_v, r) => r.eta >= 15 && r.eta <= 38,
    working: (v, r) => {
      const mfh = v.V * 1e-3 * v.rho
      return [
        { label: 'Indicated power', tex: 'IP = \\dfrac{BP}{\\eta_m}', sub: `\\dfrac{${tnum(v.bp)}}{${tnum(v.etaM / 100)}}`, result: `= ${n(r.ip)}\\ \\text{kW}`, cite: SRC.misc509('p6, Ex 5') },
        { label: 'Fuel mass rate', tex: '\\dot m_f = \\dot V\\rho', sub: `${tnum(v.V)}\\times10^{-3} \\times ${tnum(v.rho)}`, result: `= ${n(mfh)}\\ \\text{kg/h}` },
        { label: 'Indicated thermal efficiency', tex: '\\eta_{ith} = \\dfrac{IP}{\\dot m_f\\,HV}', sub: `\\dfrac{${n(r.ip)}}{(${n(mfh)}/3600)\\times ${tnum(v.hv * 1000)}}`, result: `= ${n(r.eta, 3)}\\,\\%` },
      ]
    },
    cite: SRC.misc509('p6, Example 5'),
  }),
  parametric({
    id: '509-ex6-design',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Size a square engine for a target torque',
    inputs: [
      { key: 'z', value: 4, min: 2, max: 6, step: 1 },
      { key: 'T', value: 160, min: 80, max: 400, step: 5 },
      { key: 'b1', value: 950, min: 750, max: 1100, step: 10 },
      { key: 'b2', value: 825, min: 650, max: 1000, step: 5 },
      { key: 'N', value: 5000, min: 3000, max: 6000, step: 100 },
    ],
    statement: (v) =>
      `A four-stroke ${num(v.z)}-cylinder SI engine must give ${num(v.T)} N·m at a bmep of ${num(v.b1)} kPa, with bore equal to stroke. Find the total swept volume and the bore. At maximum power the bmep is ${num(v.b2)} kPa at ${num(v.N)} rpm: find the brake power.`,
    answers: [
      { key: 'Vs', label: 'V_s', unit: 'L', expected: 2.116 },
      { key: 'D', label: 'D = L', unit: 'mm', expected: 87.65 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 72.7 },
    ],
    solve: (v) => {
      const { Vd, D } = squareDesign(v)
      const r = enginePerformance({ ...base, cylinders: v.z, bore: D, stroke: D, rpm: v.N, clearance: { kind: 'cr', value: 9 }, output: { kind: 'bmep', value: v.b2 * 1e3 } })
      return { Vs: Vd * 1e3, D: D * 1000, bp: r.bp! / 1000 }
    },
    // bmep falls off from peak torque to peak power; piston speed ≤ 16 m/s; bore 60–130 mm
    valid: (v, r) => v.b2 < v.b1 - 50 && pistonSpeed(r.D, v.N) <= 16 && r.D >= 60 && r.D <= 130,
    working: (v, r) => [
      { label: 'Swept volume from torque', tex: 'T = \\dfrac{bmep\\,V_s}{4\\pi} \\Rightarrow V_s = \\dfrac{4\\pi T}{bmep}', sub: `\\dfrac{4\\pi\\times${tnum(v.T)}}{${tnum(v.b1)}\\times10^3}`, result: `= ${n(r.Vs)}\\ \\text{L}`, cite: SRC.misc509('Ex 6') },
      { label: 'Bore = stroke', tex: `\\tfrac{\\pi}{4}D^3 = V_s/${tnum(v.z)}`, result: `D = ${n(r.D)}\\ \\text{mm}` },
      { label: `Power at ${num(v.b2)} kPa`, tex: 'BP = \\dfrac{bmep\\,V_s\\,N}{120}', sub: `\\dfrac{${tnum(v.b2)}\\times10^3 \\times ${n(r.Vs / 1000)} \\times ${tnum(v.N)}}{120}`, result: `= ${n(r.bp)}\\ \\text{kW}` },
    ],
    cite: SRC.misc509('Example 6'),
    params: (v) => {
      const D = Math.round(squareDesign(v).D * 1e5) / 100
      return perf('ex6', { cylinders: v.z, rpm: v.N, outVal: v.b2 }, { bore: D, stroke: D })
    },
  }),
  parametric({
    id: '509-ex7-torque',
    course: 'AEE509',
    topic: 'Engine performance',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Petrol engine from its clearance volume',
    inputs: [
      { key: 'z', value: 8, min: 2, max: 8, step: 1 },
      { key: 'D', value: 100, min: 80, max: 120, step: 5 },
      { key: 'L', value: 120, min: 90, max: 140, step: 5 },
      { key: 'Vc', value: 90, min: 50, max: 150, step: 5 },
      { key: 'mf', value: 20, min: 4, max: 30, step: 0.5 },
      { key: 'hv', value: 44, min: 42, max: 46, step: 1 },
      { key: 'T', value: 160, min: 80, max: 400, step: 5 },
      { key: 'N', value: 4500, min: 2000, max: 5000, step: 100 },
    ],
    statement: (v) =>
      `${an(v.z)} ${num(v.z)}-cylinder four-stroke petrol engine, ${num(v.D)} mm bore × ${num(v.L)} mm stroke, has a clearance volume of ${num(v.Vc)} cm³ per cylinder. It uses ${num(v.mf)} kg/h of fuel (${num(v.hv)} MJ/kg) and gives ${num(v.T)} N·m at ${num(v.N)} rpm. Find the compression ratio, brake power, bmep and brake thermal efficiency.`,
    answers: [
      { key: 'cr', label: 'CR', unit: '', expected: 11.47 },
      { key: 'bp', label: 'BP', unit: 'kW', expected: 75.4 },
      { key: 'bmep', label: 'bmep', unit: 'bar', expected: 2.667 },
      { key: 'eta', label: '\\eta_{bth}', unit: '%', expected: 30.85 },
    ],
    solve: (v) => {
      const r = enginePerformance({ ...base, cylinders: v.z, bore: v.D / 1000, stroke: v.L / 1000, rpm: v.N, hv: v.hv * 1e6, clearance: { kind: 'cv', value: v.Vc * 1e-6 }, output: { kind: 'torque', value: v.T }, fuel: { kind: 'rate', kgPerH: v.mf } })
      return { cr: r.CR, bp: r.bp! / 1000, bmep: r.bmep! / 1e5, eta: r.etaBth! * 100 }
    },
    // petrol compression ratio, a plausible brake thermal efficiency and piston speed ≤ 18 m/s
    valid: (v, r) => r.cr >= 6 && r.cr <= 12 && r.eta >= 18 && r.eta <= 38 && pistonSpeed(v.L, v.N) <= 18,
    working: (v, r) => {
      const pd = (Math.PI / 4) * (v.D / 10) ** 2 * (v.L / 10)
      return [
        { label: 'Compression ratio', tex: 'CR = \\dfrac{V_s + V_c}{V_c}', sub: `\\dfrac{${n(pd)} + ${tnum(v.Vc)}}{${tnum(v.Vc)}}`, result: `= ${n(r.cr)}`, cite: SRC.misc509('Ex 7') },
        { label: 'Brake power', tex: 'BP = \\dfrac{2\\pi N T}{60}', sub: `\\dfrac{2\\pi \\times ${tnum(v.N)} \\times ${tnum(v.T)}}{60}`, result: `= ${n(r.bp)}\\ \\text{kW}` },
        { label: 'bmep', tex: 'bmep = \\dfrac{60\\,BP}{L A z (N/2)}', result: `= ${n(r.bmep)}\\ \\text{bar}` },
        { label: 'Brake thermal efficiency', tex: '\\eta_{bth} = \\dfrac{BP}{\\dot m_f HV}', sub: `\\dfrac{${n(r.bp)}}{(${tnum(v.mf)}/3600)\\times ${tnum(v.hv * 1000)}}`, result: `= ${n(r.eta)}\\,\\%` },
      ]
    },
    cite: SRC.misc509('Example 7'),
    params: (v) => perf('ex7', { cylinders: v.z, bore: v.D, stroke: v.L, clrVal: v.Vc, fuelVal: v.mf, hv: v.hv, outVal: v.T, rpm: v.N }),
  }),
  parametric({
    id: '509-genset-2223',
    course: 'AEE509',
    topic: 'Mean effective pressure',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Genset: clearance volume, bmep and imep',
    inputs: [
      { key: 'z', value: 8, min: 4, max: 12, step: 1 },
      { key: 'A', value: 0.25, min: 0.15, max: 0.3, step: 0.01 },
      { key: 'L', value: 0.3, min: 0.2, max: 0.4, step: 0.01 },
      { key: 'tcv', value: 0.1, min: 0.04, max: 0.15, step: 0.005 },
      { key: 'bp', value: 3000, min: 500, max: 4000, step: 50 },
      { key: 'N', value: 2000, min: 1000, max: 2000, step: 50 },
      { key: 'etaM', value: 75, min: 70, max: 90, step: 1 },
    ],
    statement: (v) =>
      `${an(v.z)} ${num(v.z)}-cylinder four-stroke diesel genset has piston area ${num(v.A)} m², stroke ${num(v.L)} m and total cylinder volume ${num(v.tcv)} m³. It develops ${num(v.bp)} kW at ${num(v.N)} rpm with a mechanical efficiency of ${num(v.etaM)} %. Find the clearance volume, bmep, imep and friction power.`,
    answers: [
      { key: 'vc', label: 'V_c', unit: 'm³', expected: 0.025 },
      { key: 'bmep', label: 'bmep', unit: 'kPa', expected: 300 },
      { key: 'imep', label: 'imep', unit: 'kPa', expected: 400 },
      { key: 'fp', label: 'FP', unit: 'kW', expected: 1000 },
    ],
    solve: (v) => {
      const r = enginePerformance({ ...base, cylinders: v.z, bore: 0, area: v.A, stroke: v.L, rpm: v.N, clearance: { kind: 'tcv', value: v.tcv }, output: { kind: 'bp', value: v.bp * 1e3 }, losses: { kind: 'etaM', value: v.etaM / 100 } })
      return { vc: r.CV, bmep: r.bmep! / 1000, imep: r.imep! / 1000, fp: r.fp! / 1000 }
    },
    // the clearance volume must be positive (CR 3–22); bmep 200–2000 kPa; piston speed no worse than the paper's 20 m/s
    valid: (v, r) => r.vc > 0 && v.tcv / r.vc >= 3 && v.tcv / r.vc <= 22 && r.bmep >= 200 && r.bmep <= 2000 && (2 * v.L * v.N) / 60 <= 20,
    working: (v, r) => [
      { label: 'Clearance volume', tex: 'V_c = TCV - A L', sub: `${tnum(v.tcv)} - ${tnum(v.A)}\\times${tnum(v.L)}`, result: `= ${n(r.vc)}\\ \\text{m}^3`, cite: SRC.exam509('2022/23 Q2') },
      { label: 'bmep', tex: 'bmep = \\dfrac{60\\,BP}{L A z (N/2)}', sub: `\\dfrac{60\\times${tnum(v.bp)}}{${tnum(v.L)}\\times${tnum(v.A)}\\times${tnum(v.z)}\\times${tnum(v.N / 2)}}`, result: `= ${n(r.bmep)}\\ \\text{kPa}` },
      { label: 'imep and friction power', tex: 'imep = \\dfrac{bmep}{\\eta_m},\\quad FP = \\dfrac{BP}{\\eta_m} - BP', result: `imep = ${n(r.imep)}\\ \\text{kPa},\\ FP = ${n(r.fp)}\\ \\text{kW}` },
    ],
    cite: SRC.exam509('2022/23 Q2'),
    params: (v) => perf('genset', { cylinders: v.z, area: v.A, stroke: v.L * 1000, clrVal: v.tcv * 1000, outVal: v.bp, rpm: v.N, lossVal: v.etaM / 100 }, { bore: Math.round(Math.sqrt((4 * v.A) / Math.PI) * 1e4) / 10 }),
  }),
  parametric({
    id: '509-mahindra-1718',
    course: 'AEE509',
    topic: 'Swept volume & compression ratio',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Mahindra tractor: piston displacement and CR',
    inputs: [
      { key: 'D', value: 100, min: 80, max: 130, step: 5 },
      { key: 'L', value: 124, min: 90, max: 150, step: 2 },
      { key: 'x', value: 6, min: 5, max: 20, step: 1 },
    ],
    statement: (v) => `A tractor engine has a bore of ${num(v.D)} mm and a stroke of ${num(v.L)} mm. The clearance volume is 1/${num(v.x)} of the piston displacement. Find the piston displacement (per cylinder) and the compression ratio.`,
    answers: [
      { key: 'pd', label: 'PD', unit: 'cm³', expected: 973.9 },
      { key: 'cr', label: 'CR', unit: '', expected: 7 },
    ],
    solve: (v) => {
      const r = enginePerformance({ ...base, bore: v.D / 1000, stroke: v.L / 1000, clearance: { kind: 'pdFraction', value: 1 / v.x } })
      return { pd: r.PD * 1e6, cr: r.CR }
    },
    // a sensible stroke/bore ratio for a tractor engine
    valid: (v) => v.L / v.D >= 0.9 && v.L / v.D <= 1.5,
    working: (v, r, original) => [
      { label: 'Piston displacement', tex: 'PD = \\tfrac{\\pi}{4} D^2 L', sub: `\\tfrac{\\pi}{4}(${tnum(v.D / 10)})^2(${tnum(v.L / 10)})`, result: `= ${n(r.pd)}\\ \\text{cm}^3`, cite: SRC.exam509('2017/18 Q2b'), ...(original ? { errata: 'The worked answer uses π = 3.14 and prints 973.4 cm³; both are accepted.' } : {}) },
      { label: 'Compression ratio', tex: `CR = \\dfrac{PD + CV}{CV} = \\dfrac{PD + PD/${tnum(v.x)}}{PD/${tnum(v.x)}}`, result: `= ${n(r.cr)}` },
    ],
    cite: SRC.exam509('2017/18 Q2b'),
    params: (v) => perf('mahindra', { bore: v.D, stroke: v.L, clrVal: v.x }),
  }),
  parametric({
    id: '509-six-si-2122',
    course: 'AEE509',
    topic: 'Swept volume & compression ratio',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'SI engine: CR and air-standard efficiency',
    inputs: [
      { key: 'z', value: 6, min: 2, max: 8, step: 1 },
      { key: 'D', value: 100, min: 75, max: 120, step: 5 },
      { key: 'L', value: 125, min: 80, max: 140, step: 5 },
      { key: 'x', value: 8, min: 6, max: 10, step: 1 },
    ],
    statement: (v) =>
      `A four-stroke ${num(v.z)}-cylinder SI engine has bore ${num(v.D)} mm and stroke ${num(v.L)} mm; the clearance volume is 1/${num(v.x)} of the stroke volume. Find the piston displacement per cylinder, the total cylinder volume, the compression ratio and the Otto air-standard efficiency (k = 1.4).`,
    answers: [
      { key: 'pd', label: 'PD', unit: 'cm³', expected: 981.7 },
      { key: 'tcv', label: 'TCV', unit: 'cm³', expected: 1104.5 },
      { key: 'cr', label: 'CR', unit: '', expected: 9 },
      { key: 'eta', label: '\\eta_{Otto}', unit: '%', expected: 58.5, abs: 0.3 },
    ],
    solve: (v) => {
      const r = enginePerformance({ ...base, cylinders: v.z, bore: v.D / 1000, stroke: v.L / 1000, clearance: { kind: 'pdFraction', value: 1 / v.x } })
      const c = airStandardCycle({ kind: 'otto', r: r.CR, P1: 100, T1: 300, alpha: 2, delta: 1 })
      return { pd: r.PD * 1e6, tcv: r.TCV * 1e6, cr: r.CR, eta: c.etaFormula * 100 }
    },
    // a sensible stroke/bore ratio
    valid: (v) => v.L / v.D >= 0.8 && v.L / v.D <= 1.4,
    working: (v, r) => [
      { label: 'Displacement and total volume', tex: `PD = \\tfrac{\\pi}{4}D^2L,\\quad TCV = PD + PD/${tnum(v.x)}`, sub: `\\tfrac{\\pi}{4}(${tnum(v.D / 10)})^2(${tnum(v.L / 10)})`, result: `PD = ${n(r.pd)},\\ TCV = ${n(r.tcv)}\\ \\text{cm}^3`, cite: SRC.exam509('2021/22 Q3b') },
      { label: 'Compression ratio', tex: 'CR = TCV/CV', result: `= ${n(r.cr)}` },
      { label: 'Otto efficiency', tex: '\\eta = 1 - \\dfrac{1}{r^{k-1}}', sub: `1 - \\dfrac{1}{${n(r.cr)}^{0.4}}`, result: `= ${n(r.eta, 3)}\\,\\%`, cite: SRC.thermo509('Otto cycle') },
    ],
    cite: SRC.exam509('2021/22 Q3b'),
    params: (v) => perf('six-si', { cylinders: v.z, bore: v.D, stroke: v.L, clrVal: v.x }),
  }),
  parametric({
    id: '509-otto-ex9',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Otto cycle: efficiency and mean effective pressure',
    inputs: [
      { key: 'r', value: 10, min: 6, max: 11, step: 0.5 },
      { key: 'P1', value: 105, min: 90, max: 110, step: 1 },
      { key: 'T1', value: 295, min: 285, max: 320, step: 5 },
      { key: 'Pmax', value: 8902, min: 4000, max: 10000, step: 50 },
    ],
    // the maximum temperature is shown for context, rounded to 10 K (2501 K → 2500 K as printed in the paper)
    statement: (v) =>
      `An Otto cycle has a compression ratio of ${num(v.r)}. At the start of compression the air is at ${num(v.P1)} kPa, ${num(v.T1)} K; the maximum pressure is ${num(v.Pmax)} kPa (${num(Math.round(ottoEx9(v).s3.T / 10) * 10)} K). Take k = 1.4, cv = 0.718 kJ/kg·K. Find T₂, the air-standard efficiency and the mean effective pressure.`,
    answers: [
      { key: 'T2', label: 'T_2', unit: 'K', expected: 741 },
      { key: 'eta', label: '\\eta', unit: '%', expected: 60.2, abs: 0.2 },
      { key: 'mep', label: 'mep', unit: 'kPa', expected: 1048 },
    ],
    solve: (v) => {
      const c = ottoEx9(v)
      return { T2: c.s2.T, eta: c.eta * 100, mep: c.mep }
    },
    // heat must be added (Pmax well above P2) and the peak temperature kept within 1800–3000 K
    valid: (v) => {
      const T3 = ottoEx9(v).s3.T
      return T3 >= 1800 && T3 <= 3000
    },
    working: (v, r, original) => [
      { label: 'End of compression', tex: 'T_2 = T_1 r^{k-1}', sub: `${tnum(v.T1)} \\times ${tnum(v.r)}^{0.4}`, result: `= ${n(r.T2)}\\ \\text{K}`, cite: SRC.misc509('p9, Ex 9') },
      { label: 'Efficiency', tex: '\\eta = 1 - r^{1-k}', result: `= ${n(r.eta, 3)}\\,\\%` },
      { label: 'Mean effective pressure', tex: 'mep = \\dfrac{\\eta\\,c_v (T_3 - T_2)}{v_1 - v_2}', result: `= ${n(r.mep)}\\ \\text{kPa}`, ...(original ? { errata: 'The worked example uses cv = 0.778 and prints 1135.7 kPa; with 0.718 the mep is ≈ 1048 kPa.' } : {}) },
    ],
    cite: SRC.misc509('p9, Example 9'),
    errata: 'otto-cv',
    params: (v) => {
      const orig = v.r === 10 && v.P1 === 105 && v.T1 === 295 && v.Pmax === 8902
      return { cycle: 'otto', r: v.r, P1: v.P1, T1: v.T1, q: orig ? 1263 : Math.round(ottoEx9(v).qIn) }
    },
  }),
  parametric({
    id: '509-cutoff-ex13',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Diesel cut-off ratio from the cut-off point',
    inputs: [
      { key: 'x', value: 10, min: 4, max: 15, step: 1 },
      { key: 'r', value: 16, min: 12, max: 22, step: 0.5 },
    ],
    statement: (v) => `In a Diesel cycle with a compression ratio of ${num(v.r)}, fuel is cut off at ${num(v.x)} % of the stroke. Find the cut-off ratio δ.`,
    answers: [{ key: 'delta', label: '\\delta', unit: '', expected: 2.5 }],
    solve: (v) => ({ delta: deltaFromCutoffFraction(v.x / 100, v.r) }),
    working: (v, r) => [
      { label: 'Cut-off ratio', tex: '\\delta = \\dfrac{V_3}{V_2} = 1 + x\\,(r - 1)', sub: `1 + ${tnum(v.x / 100)}(${tnum(v.r)} - 1)`, result: `= ${n(r.delta)}`, cite: SRC.misc509('Ex 13') },
    ],
    cite: SRC.misc509('Example 13'),
  }),
  parametric({
    id: '509-dual-exam',
    course: 'AEE509',
    topic: 'Air-standard cycles',
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    title: 'Dual cycle: state at the end of compression',
    inputs: [
      { key: 'r', value: 16, min: 12, max: 22, step: 0.5 },
      { key: 'P1', value: 1, min: 0.9, max: 1.1, step: 0.05 },
      { key: 't1', value: 50, min: 15, max: 60, step: 5 },
      { key: 'Pmax', value: 70, min: 50, max: 120, step: 5 },
    ],
    statement: (v) =>
      `A dual cycle has r = ${num(v.r)}, starting at ${num(v.P1)} bar and ${num(v.t1)} °C. The maximum pressure is ${num(v.Pmax)} bar and equal heat is added at constant volume and at constant pressure. Find T₂ and P₂ at the end of compression.`,
    answers: [
      { key: 'T2', label: 'T_2', unit: 'K', expected: 979.1 },
      { key: 'P2', label: 'P_2', unit: 'kPa', expected: 4850 },
    ],
    solve: (v) => {
      const P1 = v.P1 * 100
      const T1 = v.t1 + 273
      const { alpha, delta } = dualFromPmaxEqualHeat(v.Pmax * 100, v.r, P1, T1)
      const c = airStandardCycle({ kind: 'dual', r: v.r, P1, T1, alpha, delta })
      return { T2: c.s2.T, P2: c.s2.P }
    },
    // the maximum pressure must sit clearly above the compression pressure, or no heat is added at constant volume
    valid: (v, r) => v.Pmax * 100 >= 1.1 * r.P2,
    working: (v, r) => [
      { label: 'Isentropic compression', tex: 'T_2 = T_1 r^{k-1},\\quad P_2 = P_1 r^{k}', sub: `${tnum(v.t1 + 273)} \\times ${tnum(v.r)}^{0.4},\\ ${tnum(v.P1 * 100)} \\times ${tnum(v.r)}^{1.4}`, result: `T_2 = ${n(r.T2)}\\ \\text{K},\\ P_2 = ${n(r.P2)}\\ \\text{kPa}`, cite: SRC.thermo509('dual cycle') },
    ],
    cite: SRC.exam509('dual cycle (recurring)'),
  }),
  parametric({
    id: '509-governor',
    course: 'AEE509',
    topic: 'Governing',
    moduleId: 'engine',
    sceneId: 'air-governor',
    title: 'Governor regulation',
    inputs: [
      { key: 'nl', value: 1600, min: 1300, max: 2800, step: 10 },
      { key: 'fl', value: 1500, min: 1200, max: 2600, step: 10 },
    ],
    statement: (v) => `A governed engine runs at ${num(v.nl)} rpm with no load and ${num(v.fl)} rpm at full load. Find the governor regulation.`,
    answers: [{ key: 'reg', label: '\\text{regulation}', unit: '%', expected: 6.45 }],
    solve: (v) => ({ reg: governorRegulation(v.nl, v.fl) }),
    // no-load speed above full-load speed, with a typical 2–12 % droop
    valid: (_v, r) => r.reg >= 2 && r.reg <= 12,
    working: (v, r) => [
      { label: 'Regulation', tex: '\\text{reg} = \\dfrac{2(N_{nl} - N_{fl})}{N_{nl} + N_{fl}}\\times100', sub: `\\dfrac{2(${tnum(v.nl)}-${tnum(v.fl)})}{${tnum(v.nl)}+${tnum(v.fl)}}\\times100`, result: `= ${n(r.reg)}\\,\\%`, cite: SRC.supp509('governor') },
    ],
    cite: SRC.supp509('governor regulation example'),
  }),
  parametric({
    id: '509-pressure-cap',
    course: 'AEE509',
    topic: 'Cooling',
    moduleId: 'engine',
    sceneId: 'cooling',
    title: 'Boiling point under a pressure cap',
    inputs: [
      { key: 'cap', value: 90, min: 30, max: 140, step: 5 },
      // atmospheric pressure: sea level down to a high-altitude farm (~1500 m)
      { key: 'atm', value: 101.325, min: 85, max: 101.5, step: 0.5 },
    ],
    statement: (v) => `A radiator pressure cap holds ${num(v.cap)} kPa above atmospheric (${num(v.atm)} kPa). At what temperature does the coolant (water) boil?`,
    answers: [{ key: 'T', label: 'T_{boil}', unit: '°C', expected: 118.9, abs: 1 }],
    solve: (v) => ({ T: capBoilingPointC(v.cap, v.atm) }),
    working: (v, r) => [
      { label: 'Absolute pressure in the system', tex: 'p = p_{atm} + p_{cap}', sub: `${tnum(v.atm)} + ${tnum(v.cap)}`, result: `= ${n(v.atm + v.cap)}\\ \\text{kPa}` },
      { label: 'Saturation temperature', tex: `T_{sat}(${n(v.atm + v.cap)}\\ \\text{kPa})`, result: `= ${n(r.T)}\\ ^\\circ\\text{C}`, cite: SRC.tb509('Ch 7, pressure cap') },
    ],
    cite: SRC.tb509('Ch 7, radiator pressure cap'),
  }),
]
