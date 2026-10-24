import { SRC } from '@/content/citations'
import { cgFromFrontWeight } from '@/physics/chassis'
import { brakePower } from '@/physics/engine'
import { followerSpeed, groundSpeedKmh } from '@/physics/gearing'
import { KGCM2_TO_MPA, hydraulicPower, liftCapacity, liftRamPressure, ramSizing } from '@/physics/hydraulics'
import { axleTransfer, frictionPull } from '@/physics/traction'
import { decodeTyreSize, rearWeightRange, slipFromRevs, tyreContactArea } from '@/physics/tyres'
import { n } from '@/ui/Working'
import type { Question } from '../types'

export const AEE510: Question[] = [
  {
    id: '510-bp-2223',
    course: 'AEE510',
    topic: 'Power & torque',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Brake power from speed and torque',
    statement: 'A tractor engine delivers 65 N·m at 2000 rpm. Find the brake power.',
    answers: [{ key: 'bp', label: 'BP', unit: 'kW', expected: 13.6 }],
    solve: () => ({ bp: brakePower(2000, 65) / 1000 }),
    working: (r) => [{ label: 'Brake power', tex: 'BP = \\dfrac{2\\pi N T}{60}', sub: '\\dfrac{2\\pi\\times2000\\times65}{60}', result: `= ${n(r.bp)}\\ \\text{kW}`, cite: SRC.pt510('power and torque') }],
    cite: SRC.pt510('2022/23 Q3c'),
  },
  {
    id: '510-weight-transfer-2223',
    course: 'AEE510',
    topic: 'Weight transfer',
    moduleId: 'chassis',
    sceneId: 'weight-transfer',
    title: 'Weight transfer under a drawbar pull',
    statement:
      'A tractor weighs 28.5 kN with 9 kN on the front axle; the wheelbase is 2083 mm. It pulls 12 kN horizontally from a drawbar 580 mm above the ground. Find the horizontal distance of the centre of gravity from the rear axle, the weight transferred, and the dynamic front and rear axle loads.',
    answers: [
      { key: 'x', label: 'x', unit: 'mm', expected: 657.8 },
      { key: 'dW', label: '\\Delta W', unit: 'kN', expected: 3.34 },
      { key: 'front', label: 'W_f', unit: 'kN', expected: 5.66 },
      { key: 'rear', label: 'W_r', unit: 'kN', expected: 22.84 },
    ],
    solve: () => {
      const t = axleTransfer(28.5 - 9, 9, 12, 0.58, 2.083)
      return { x: cgFromFrontWeight(9, 28.5, 2083), dW: t.dW, front: t.front, rear: t.rear }
    },
    working: (r) => [
      { label: 'Centre of gravity (moments about the rear axle)', tex: 'x = \\dfrac{R_f L}{W}', sub: '\\dfrac{9 \\times 2083}{28.5}', result: `= ${n(r.x)}\\ \\text{mm}`, cite: SRC.l27('weight transfer') },
      { label: 'Weight transfer', tex: '\\Delta W = \\dfrac{P h}{L}', sub: '\\dfrac{12 \\times 580}{2083}', result: `= ${n(r.dW)}\\ \\text{kN}` },
      { label: 'Dynamic loads', tex: 'W_f = R_f - \\Delta W,\\quad W_r = R_r + \\Delta W', sub: `9 - ${n(r.dW)},\\ 19.5 + ${n(r.dW)}`, result: `= ${n(r.front)},\\ ${n(r.rear)}\\ \\text{kN}` },
    ],
    cite: SRC.l27('2022/23 Q2c'),
    params: { chassis: 'exam', pull: 12, theta: 0, alpha: 0, yd: 0.58, xd: 0.6 },
  },
  {
    id: '510-friction-pull',
    course: 'AEE510',
    topic: 'Traction',
    moduleId: 'traction',
    sceneId: 'traction-lab',
    title: 'Maximum drawbar pull from friction',
    statement: 'The driving wheels carry 25 kN and the coefficient of traction is 0.85. Find the maximum pull.',
    answers: [{ key: 'P', label: 'P', unit: 'kN', expected: 21.25 }],
    solve: () => ({ P: frictionPull(0.85, 25) }),
    working: (r) => [{ label: 'Pull', tex: 'P = \\mu W', sub: '0.85\\times25', result: `= ${n(r.P)}\\ \\text{kN}`, cite: SRC.l27('traction') }],
    cite: SRC.l27('2022/23 Q3c'),
  },
  {
    id: '510-relief-power',
    course: 'AEE510',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'lift-circuit',
    title: 'Hydraulic power at the relief setting',
    statement: 'A tractor gear pump delivers 27 L/min and the relief valve is set at 150 kg/cm². Convert the setting to MPa and find the hydraulic power carried by the oil at that pressure.',
    answers: [
      { key: 'p', label: 'p', unit: 'MPa', expected: 14.71 },
      { key: 'Ph', label: 'P_h', unit: 'kW', expected: 6.62 },
    ],
    solve: () => {
      const p = 150 * KGCM2_TO_MPA
      return { p, Ph: hydraulicPower(27, p) }
    },
    working: (r) => [
      { label: 'Pressure', tex: 'p = 150 \\times 0.0981', result: `= ${n(r.p)}\\ \\text{MPa}` },
      { label: 'Hydraulic power', tex: 'P_h = \\dfrac{Q\\,p}{60}\\ (\\text{L/min, MPa} \\to \\text{kW})', sub: `\\dfrac{27\\times${n(r.p)}}{60}`, result: `= ${n(r.Ph)}\\ \\text{kW}`, cite: SRC.hy510('p2–3') },
    ],
    cite: SRC.hy510('p2–3'),
  },
  {
    id: '510-ram-culpin',
    course: 'AEE510',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'cylinder',
    title: 'Lift ram: pressure, flow and capacity',
    statement:
      'A single-acting lift ram, 50 mm bore and 200 mm stroke, lifts 20 kN directly in 2 s. Find the oil pressure, the pump flow needed, and the load the ram can hold when the relief valve is set at 275 bar.',
    answers: [
      { key: 'p', label: 'p', unit: 'bar', expected: 101.9 },
      { key: 'Q', label: 'Q', unit: 'L/min', expected: 11.8 },
      { key: 'F', label: 'F_{max}', unit: 'kN', expected: 54.0 },
    ],
    solve: () => {
      const r = ramSizing(0.2, 0.05, 20e3, 2)
      return { p: liftRamPressure(20e3, 1, 1, 0.05).pressurePa / 1e5, Q: r.flowLps * 60, F: liftCapacity(275e5, 0.05, 1, 1) / 1000 }
    },
    working: (r) => [
      { label: 'Pressure', tex: 'p = \\dfrac{F}{A} = \\dfrac{F}{\\tfrac{\\pi}{4}d^2}', sub: '\\dfrac{20\\,000}{\\tfrac{\\pi}{4}(0.05)^2}', result: `= ${n(r.p)}\\ \\text{bar}`, cite: SRC.top510('App. 2 p11') },
      { label: 'Flow', tex: 'Q = \\dfrac{A\\,s}{t}', sub: '\\dfrac{\\tfrac{\\pi}{4}(0.05)^2\\times0.2}{2}', result: `= ${n(r.Q)}\\ \\text{L/min}` },
      { label: 'Capacity at the relief setting', tex: 'F = p_{relief} A', sub: '275\\times10^5\\times\\tfrac{\\pi}{4}(0.05)^2', result: `= ${n(r.F)}\\ \\text{kN}` },
    ],
    cite: SRC.top510('Culpin App. 2 p11'),
  },
  {
    id: '510-gear-speed',
    course: 'AEE510',
    topic: 'Gearing',
    moduleId: 'powertrain',
    sceneId: 'gearboxes',
    title: 'Speed of a driven gear',
    statement: 'A 20-tooth pinion turning at 1800 rpm drives a 60-tooth gear. Find the speed of the gear.',
    answers: [{ key: 'N', label: 'N', unit: 'rpm', expected: 600 }],
    solve: () => ({ N: followerSpeed(20, 1800, 60) }),
    working: (r) => [{ label: 'D·N = d·n', tex: 'N = \\dfrac{t\\,n}{T}', sub: '\\dfrac{20\\times1800}{60}', result: `= ${n(r.N)}\\ \\text{rpm}`, cite: SRC.top510('p3–4') }],
    cite: SRC.top510('p3–4'),
  },
  {
    id: '510-ground-speed',
    course: 'AEE510',
    topic: 'Gearing',
    moduleId: 'powertrain',
    sceneId: 'line-of-drive',
    title: 'Ground speed through a 100 : 1 reduction',
    statement: 'An engine at 2000 rpm drives the rear wheels through an overall reduction of 100 : 1. The rolling radius is 0.75 m. Find the forward speed.',
    answers: [{ key: 'v', label: 'v', unit: 'km/h', expected: 5.65 }],
    solve: () => ({ v: groundSpeedKmh(2000, 1 / 100, 0.75) }),
    working: (r) => [
      { label: 'Wheel speed', tex: 'N_w = \\dfrac{N_e}{i}', sub: '\\dfrac{2000}{100}', result: '= 20\\ \\text{rpm}', cite: SRC.tts510('p1') },
      { label: 'Ground speed', tex: 'v = \\dfrac{2\\pi r N_w}{60}\\times3.6', sub: '\\dfrac{2\\pi\\times0.75\\times20}{60}\\times3.6', result: `= ${n(r.v)}\\ \\text{km/h}` },
    ],
    cite: SRC.tts510('p1'),
  },
  {
    id: '510-chalk-slip',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'ballast',
    title: 'Chalk-mark slip test',
    statement: 'A drive wheel makes 10 revolutions under load over a measured distance. Without load it covers the same distance in 9 revolutions (first run) and in 8½ revolutions (second run, after ballasting). Find the slip in each case.',
    answers: [
      { key: 's1', label: 's_1', unit: '%', expected: 10, abs: 0.2 },
      { key: 's2', label: 's_2', unit: '%', expected: 15, abs: 0.2 },
    ],
    solve: () => ({ s1: slipFromRevs(9, 10) * 100, s2: slipFromRevs(8.5, 10) * 100 }),
    working: (r) => [{ label: 'Slip', tex: 's = \\dfrac{N_{loaded} - N_{free}}{N_{loaded}}\\times100', sub: '\\dfrac{10-9}{10},\\ \\dfrac{10-8.5}{10}', result: `= ${n(r.s1)}\\,\\%,\\ ${n(r.s2)}\\,\\%`, cite: SRC.tt510('p9–10') }],
    cite: SRC.tt510('p9–10'),
  },
  {
    id: '510-ballast-guide',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'ballast',
    title: 'Rear-axle weight for a 120 PTO-hp tractor',
    statement: 'A 120 PTO-hp tractor pulls a semi-integral plough on firm soil at 5.3 mph. The weight guide gives 84–100 lb per PTO hp on the rear axle. Find the range of rear weight, and the lower limit at ¾ load.',
    answers: [
      { key: 'lo', label: 'W_{lo}', unit: 'lb', expected: 10100 },
      { key: 'hi', label: 'W_{hi}', unit: 'lb', expected: 12000 },
      { key: 'q', label: 'W_{lo,\\,3/4}', unit: 'lb', expected: 7560 },
    ],
    solve: () => {
      const r = rearWeightRange(120, { lo: 84, hi: 100 })
      return { lo: r.lo, hi: r.hi, q: rearWeightRange(120, { lo: 84, hi: 100 }, 0.75).lo }
    },
    working: (r) => [
      { label: 'Rear weight', tex: 'W = \\text{hp}\\times(\\text{lb/hp})', sub: '120\\times84,\\ 120\\times100', result: `= ${n(r.lo, 5)}\\ \\text{to}\\ ${n(r.hi, 5)}\\ \\text{lb}`, cite: SRC.tt510('p11') },
      { label: '¾ load', tex: 'W = 0.75\\times120\\times84', result: `= ${n(r.q, 5)}\\ \\text{lb}`, errata: 'The notes print 7,550 lb — an arithmetic slip for 7,560.' },
    ],
    cite: SRC.tt510('p11 worked example'),
  },
  {
    id: '510-metric-tyre',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'tyre',
    title: 'Decode a metric tyre size',
    statement: 'Decode the tyre size 710/70R38: find the section height and the overall diameter (1 in = 25.4 mm).',
    answers: [
      { key: 'h', label: 'h', unit: 'mm', expected: 497 },
      { key: 'd', label: 'd', unit: 'mm', expected: 1959.2 },
    ],
    solve: () => {
      const t = decodeTyreSize('710/70R38')!
      return { h: t.sectionHeightMm!, d: t.overallDiaMm! }
    },
    working: (r) => [
      { label: 'Section height', tex: 'h = \\text{aspect}\\times b', sub: '0.70\\times710', result: `= ${n(r.h)}\\ \\text{mm}`, cite: SRC.l27('p32') },
      { label: 'Overall diameter', tex: 'd = d_{rim} + 2h', sub: '38\\times25.4 + 2\\times497', result: `= ${n(r.d, 5)}\\ \\text{mm}` },
    ],
    cite: SRC.l27('p32'),
  },
  {
    id: '510-contact-area',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'tyre',
    title: 'Tyre contact area from inflation pressure',
    statement: 'Ground pressure under a tyre is roughly equal to its inflation pressure. A tyre carrying 20 kN is inflated to 100 kPa: estimate the contact area.',
    answers: [{ key: 'A', label: 'A', unit: 'm²', expected: 0.2 }],
    solve: () => ({ A: tyreContactArea(20e3, 100e3) }),
    working: (r) => [{ label: 'Contact area', tex: 'A = \\dfrac{W}{p_i}', sub: '\\dfrac{20\\,000}{100\\,000}', result: `= ${n(r.A)}\\ \\text{m}^2`, cite: SRC.l27('p39') }],
    cite: SRC.l27('p39'),
  },
]
