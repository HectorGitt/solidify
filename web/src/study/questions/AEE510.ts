import { SRC } from '@/content/citations'
import { cgFromFrontWeight } from '@/physics/chassis'
import { brakePower } from '@/physics/engine'
import { followerSpeed, groundSpeedKmh } from '@/physics/gearing'
import { KGCM2_TO_MPA, hydraulicPower, liftCapacity, liftRamPressure, ramSizing } from '@/physics/hydraulics'
import { axleTransfer, frictionPull } from '@/physics/traction'
import { decodeTyreSize, rearWeightRange, slipFromRevs, tyreContactArea } from '@/physics/tyres'
import { n } from '@/ui/Working'
import type { Question } from '../types'
import { num, parametric, tnum } from '../variants'

export const AEE510: Question[] = [
  parametric({
    id: '510-bp-2223',
    course: 'AEE510',
    topic: 'Power & torque',
    moduleId: 'engine',
    sceneId: 'performance',
    title: 'Brake power from speed and torque',
    inputs: [
      { key: 'T', value: 65, min: 40, max: 400, step: 5 },
      { key: 'N', value: 2000, min: 1200, max: 2600, step: 50 },
    ],
    statement: (v) => `A tractor engine delivers ${num(v.T)} N·m at ${num(v.N)} rpm. Find the brake power.`,
    answers: [{ key: 'bp', label: 'BP', unit: 'kW', expected: 13.6 }],
    solve: (v) => ({ bp: brakePower(v.N, v.T) / 1000 }),
    working: (v, r) => [{ label: 'Brake power', tex: 'BP = \\dfrac{2\\pi N T}{60}', sub: `\\dfrac{2\\pi\\times${tnum(v.N)}\\times${tnum(v.T)}}{60}`, result: `= ${n(r.bp)}\\ \\text{kW}`, cite: SRC.pt510('power and torque') }],
    cite: SRC.pt510('2022/23 Q3c'),
  }),
  parametric({
    id: '510-weight-transfer-2223',
    course: 'AEE510',
    topic: 'Weight transfer',
    moduleId: 'chassis',
    sceneId: 'weight-transfer',
    title: 'Weight transfer under a drawbar pull',
    inputs: [
      { key: 'W', value: 28.5, min: 20, max: 60, step: 0.5 },
      { key: 'Wf', value: 9, min: 5, max: 24, step: 0.5 },
      { key: 'L', value: 2083, min: 1800, max: 2800, step: 1 },
      { key: 'P', value: 12, min: 5, max: 25, step: 0.5 },
      { key: 'h', value: 580, min: 400, max: 800, step: 10 },
    ],
    statement: (v) =>
      `A tractor weighs ${num(v.W)} kN with ${num(v.Wf)} kN on the front axle; the wheelbase is ${num(v.L)} mm. It pulls ${num(v.P)} kN horizontally from a drawbar ${num(v.h)} mm above the ground. Find the horizontal distance of the centre of gravity from the rear axle, the weight transferred, and the dynamic front and rear axle loads.`,
    answers: [
      { key: 'x', label: 'x', unit: 'mm', expected: 657.8 },
      { key: 'dW', label: '\\Delta W', unit: 'kN', expected: 3.34 },
      { key: 'front', label: 'W_f', unit: 'kN', expected: 5.66 },
      { key: 'rear', label: 'W_r', unit: 'kN', expected: 22.84 },
    ],
    solve: (v) => {
      const t = axleTransfer(v.W - v.Wf, v.Wf, v.P, v.h / 1000, v.L / 1000)
      return { x: cgFromFrontWeight(v.Wf, v.W, v.L), dW: t.dW, front: t.front, rear: t.rear }
    },
    // front axle between 20 % and 45 % of the weight, and it must keep at least 15 % of its load
    valid: (v, r) => v.Wf >= 0.2 * v.W && v.Wf <= 0.45 * v.W && r.front >= 0.15 * v.Wf,
    working: (v, r) => [
      { label: 'Centre of gravity (moments about the rear axle)', tex: 'x = \\dfrac{R_f L}{W}', sub: `\\dfrac{${tnum(v.Wf)} \\times ${tnum(v.L)}}{${tnum(v.W)}}`, result: `= ${n(r.x)}\\ \\text{mm}`, cite: SRC.l27('weight transfer') },
      { label: 'Weight transfer', tex: '\\Delta W = \\dfrac{P h}{L}', sub: `\\dfrac{${tnum(v.P)} \\times ${tnum(v.h)}}{${tnum(v.L)}}`, result: `= ${n(r.dW)}\\ \\text{kN}` },
      { label: 'Dynamic loads', tex: 'W_f = R_f - \\Delta W,\\quad W_r = R_r + \\Delta W', sub: `${tnum(v.Wf)} - ${n(r.dW)},\\ ${tnum(v.W - v.Wf)} + ${n(r.dW)}`, result: `= ${n(r.front)},\\ ${n(r.rear)}\\ \\text{kN}` },
    ],
    // front and rear loads follow from the student's ΔW
    follow: (v, g) => ('dW' in g ? { front: v.Wf - g.dW, rear: v.W - v.Wf + g.dW } : {}),
    cite: SRC.l27('2022/23 Q2c'),
    params: (v) => ({ chassis: 'exam', pull: v.P, theta: 0, alpha: 0, yd: v.h / 1000, xd: 0.6 }),
  }),
  parametric({
    id: '510-friction-pull',
    course: 'AEE510',
    topic: 'Traction',
    moduleId: 'traction',
    sceneId: 'traction-lab',
    title: 'Maximum drawbar pull from friction',
    inputs: [
      { key: 'W', value: 25, min: 10, max: 60, step: 0.5 },
      { key: 'mu', value: 0.85, min: 0.4, max: 0.9, step: 0.05 },
    ],
    statement: (v) => `The driving wheels carry ${num(v.W)} kN and the coefficient of traction is ${num(v.mu)}. Find the maximum pull.`,
    answers: [{ key: 'P', label: 'P', unit: 'kN', expected: 21.25 }],
    solve: (v) => ({ P: frictionPull(v.mu, v.W) }),
    working: (v, r) => [{ label: 'Pull', tex: 'P = \\mu W', sub: `${tnum(v.mu)}\\times${tnum(v.W)}`, result: `= ${n(r.P)}\\ \\text{kN}`, cite: SRC.l27('traction') }],
    cite: SRC.l27('2022/23 Q3c'),
  }),
  parametric({
    id: '510-relief-power',
    course: 'AEE510',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'lift-circuit',
    title: 'Hydraulic power at the relief setting',
    inputs: [
      { key: 'Q', value: 27, min: 15, max: 60, step: 1 },
      { key: 'pk', value: 150, min: 100, max: 210, step: 5 },
    ],
    statement: (v) =>
      `A tractor gear pump delivers ${num(v.Q)} L/min and the relief valve is set at ${num(v.pk)} kg/cm². Convert the setting to MPa and find the hydraulic power carried by the oil at that pressure.`,
    answers: [
      { key: 'p', label: 'p', unit: 'MPa', expected: 14.71 },
      { key: 'Ph', label: 'P_h', unit: 'kW', expected: 6.62 },
    ],
    solve: (v) => {
      const p = v.pk * KGCM2_TO_MPA
      return { p, Ph: hydraulicPower(v.Q, p) }
    },
    working: (v, r) => [
      { label: 'Pressure', tex: `p = ${tnum(v.pk)} \\times 0.0981`, result: `= ${n(r.p)}\\ \\text{MPa}` },
      { label: 'Hydraulic power', tex: 'P_h = \\dfrac{Q\\,p}{60}\\ (\\text{L/min, MPa} \\to \\text{kW})', sub: `\\dfrac{${tnum(v.Q)}\\times${n(r.p)}}{60}`, result: `= ${n(r.Ph)}\\ \\text{kW}`, cite: SRC.hy510('p2–3') },
    ],
    // hydraulic power follows from the student's converted pressure
    follow: (v, g) => ('p' in g ? { Ph: hydraulicPower(v.Q, g.p) } : {}),
    cite: SRC.hy510('p2–3'),
  }),
  parametric({
    id: '510-ram-culpin',
    course: 'AEE510',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'cylinder',
    title: 'Lift ram: pressure, flow and capacity',
    inputs: [
      { key: 'd', value: 50, min: 40, max: 100, step: 5 },
      { key: 's', value: 200, min: 100, max: 300, step: 10 },
      { key: 'F', value: 20, min: 5, max: 40, step: 1 },
      { key: 't', value: 2, min: 1, max: 5, step: 0.5 },
      { key: 'pr', value: 275, min: 150, max: 300, step: 5 },
    ],
    statement: (v) =>
      `A single-acting lift ram, ${num(v.d)} mm bore and ${num(v.s)} mm stroke, lifts ${num(v.F)} kN directly in ${num(v.t)} s. Find the oil pressure, the pump flow needed, and the load the ram can hold when the relief valve is set at ${num(v.pr)} bar.`,
    answers: [
      { key: 'p', label: 'p', unit: 'bar', expected: 101.9 },
      { key: 'Q', label: 'Q', unit: 'L/min', expected: 11.8 },
      { key: 'F', label: 'F_{max}', unit: 'kN', expected: 54.0 },
    ],
    solve: (v) => {
      const d = v.d / 1000
      const r = ramSizing(v.s / 1000, d, v.F * 1e3, v.t)
      return { p: liftRamPressure(v.F * 1e3, 1, 1, d).pressurePa / 1e5, Q: r.flowLps * 60, F: liftCapacity(v.pr * 1e5, d, 1, 1) / 1000 }
    },
    // the working pressure must sit below the relief setting, or the ram couldn't lift the load
    valid: (v, r) => r.p < 0.9 * v.pr && r.p > 30,
    working: (v, r) => [
      { label: 'Pressure', tex: 'p = \\dfrac{F}{A} = \\dfrac{F}{\\tfrac{\\pi}{4}d^2}', sub: `\\dfrac{${tnum(v.F * 1000)}}{\\tfrac{\\pi}{4}(${tnum(v.d / 1000)})^2}`, result: `= ${n(r.p)}\\ \\text{bar}`, cite: SRC.top510('App. 2 p11') },
      { label: 'Flow', tex: 'Q = \\dfrac{A\\,s}{t}', sub: `\\dfrac{\\tfrac{\\pi}{4}(${tnum(v.d / 1000)})^2\\times${tnum(v.s / 1000)}}{${tnum(v.t)}}`, result: `= ${n(r.Q)}\\ \\text{L/min}` },
      { label: 'Capacity at the relief setting', tex: 'F = p_{relief} A', sub: `${tnum(v.pr)}\\times10^5\\times\\tfrac{\\pi}{4}(${tnum(v.d / 1000)})^2`, result: `= ${n(r.F)}\\ \\text{kN}` },
    ],
    cite: SRC.top510('Culpin App. 2 p11'),
  }),
  parametric({
    id: '510-gear-speed',
    course: 'AEE510',
    topic: 'Gearing',
    moduleId: 'powertrain',
    sceneId: 'gearboxes',
    title: 'Speed of a driven gear',
    inputs: [
      { key: 't', value: 20, min: 12, max: 30, step: 1 },
      { key: 'n', value: 1800, min: 600, max: 3000, step: 50 },
      { key: 'T', value: 60, min: 30, max: 90, step: 1 },
    ],
    statement: (v) => `A ${num(v.t)}-tooth pinion turning at ${num(v.n)} rpm drives a ${num(v.T)}-tooth gear. Find the speed of the gear.`,
    answers: [{ key: 'N', label: 'N', unit: 'rpm', expected: 600 }],
    solve: (v) => ({ N: followerSpeed(v.t, v.n, v.T) }),
    valid: (v) => v.T >= v.t + 6,
    working: (v, r) => [{ label: 'D·N = d·n', tex: 'N = \\dfrac{t\\,n}{T}', sub: `\\dfrac{${tnum(v.t)}\\times${tnum(v.n)}}{${tnum(v.T)}}`, result: `= ${n(r.N)}\\ \\text{rpm}`, cite: SRC.top510('p3–4') }],
    cite: SRC.top510('p3–4'),
  }),
  parametric({
    id: '510-ground-speed',
    course: 'AEE510',
    topic: 'Gearing',
    moduleId: 'powertrain',
    sceneId: 'line-of-drive',
    title: 'Ground speed through the overall reduction',
    inputs: [
      { key: 'Ne', value: 2000, min: 1400, max: 2600, step: 50 },
      { key: 'i', value: 100, min: 40, max: 200, step: 5 },
      { key: 'r', value: 0.75, min: 0.5, max: 0.95, step: 0.05 },
    ],
    statement: (v) => `An engine at ${num(v.Ne)} rpm drives the rear wheels through an overall reduction of ${num(v.i)} : 1. The rolling radius is ${num(v.r)} m. Find the forward speed.`,
    answers: [{ key: 'v', label: 'v', unit: 'km/h', expected: 5.65 }],
    solve: (v) => ({ v: groundSpeedKmh(v.Ne, 1 / v.i, v.r) }),
    // field and road speeds a tractor actually uses
    valid: (_v, r) => r.v >= 1 && r.v <= 40,
    working: (v, r) => [
      { label: 'Wheel speed', tex: 'N_w = \\dfrac{N_e}{i}', sub: `\\dfrac{${tnum(v.Ne)}}{${tnum(v.i)}}`, result: `= ${n(v.Ne / v.i)}\\ \\text{rpm}`, cite: SRC.tts510('p1') },
      { label: 'Ground speed', tex: 'v = \\dfrac{2\\pi r N_w}{60}\\times3.6', sub: `\\dfrac{2\\pi\\times${tnum(v.r)}\\times${n(v.Ne / v.i)}}{60}\\times3.6`, result: `= ${n(r.v)}\\ \\text{km/h}` },
    ],
    cite: SRC.tts510('p1'),
  }),
  parametric({
    id: '510-chalk-slip',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'ballast',
    title: 'Chalk-mark slip test',
    inputs: [
      { key: 'L', value: 10, min: 8, max: 16, step: 1 },
      { key: 'f1', value: 9, min: 6, max: 15.5, step: 0.5 },
      { key: 'f2', value: 8.5, min: 6, max: 15.5, step: 0.5 },
    ],
    statement: (v) =>
      `A drive wheel makes ${num(v.L)} revolutions under load over a measured distance. Without load it covers the same distance in ${num(v.f1)} revolutions (first run) and in ${num(v.f2)} revolutions (second run, after ballasting). Find the slip in each case.`,
    answers: [
      { key: 's1', label: 's_1', unit: '%', expected: 10, abs: 0.2 },
      { key: 's2', label: 's_2', unit: '%', expected: 15, abs: 0.2 },
    ],
    solve: (v) => ({ s1: slipFromRevs(v.f1, v.L) * 100, s2: slipFromRevs(v.f2, v.L) * 100 }),
    valid: (v, r) => v.f1 !== v.f2 && [r.s1, r.s2].every((s) => s >= 3 && s <= 30),
    working: (v, r) => [
      { label: 'Slip', tex: 's = \\dfrac{N_{loaded} - N_{free}}{N_{loaded}}\\times100', sub: `\\dfrac{${tnum(v.L)}-${tnum(v.f1)}}{${tnum(v.L)}},\\ \\dfrac{${tnum(v.L)}-${tnum(v.f2)}}{${tnum(v.L)}}`, result: `= ${n(r.s1)}\\,\\%,\\ ${n(r.s2)}\\,\\%`, cite: SRC.tt510('p9–10') },
    ],
    cite: SRC.tt510('p9–10'),
  }),
  parametric({
    id: '510-ballast-guide',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'ballast',
    title: 'Rear-axle weight from the weight guide',
    inputs: [
      { key: 'hp', value: 120, min: 40, max: 250, step: 5 },
      { key: 'lo', value: 84, min: 70, max: 95, step: 1 },
      { key: 'hi', value: 100, min: 85, max: 125, step: 1 },
    ],
    statement: (v) =>
      `A ${num(v.hp)} PTO-hp tractor pulls a semi-integral plough on firm soil at 5.3 mph. The weight guide gives ${num(v.lo)}–${num(v.hi)} lb per PTO hp on the rear axle. Find the range of rear weight, and the lower limit at ¾ load.`,
    answers: [
      { key: 'lo', label: 'W_{lo}', unit: 'lb', expected: 10100 },
      { key: 'hi', label: 'W_{hi}', unit: 'lb', expected: 12000 },
      { key: 'q', label: 'W_{lo,\\,3/4}', unit: 'lb', expected: 7560 },
    ],
    solve: (v) => {
      const r = rearWeightRange(v.hp, { lo: v.lo, hi: v.hi })
      return { lo: r.lo, hi: r.hi, q: rearWeightRange(v.hp, { lo: v.lo, hi: v.hi }, 0.75).lo }
    },
    valid: (v) => v.hi >= v.lo + 8,
    working: (v, r, original) => [
      { label: 'Rear weight', tex: 'W = \\text{hp}\\times(\\text{lb/hp})', sub: `${tnum(v.hp)}\\times${tnum(v.lo)},\\ ${tnum(v.hp)}\\times${tnum(v.hi)}`, result: `= ${n(r.lo, 5)}\\ \\text{to}\\ ${n(r.hi, 5)}\\ \\text{lb}`, cite: SRC.tt510('p11') },
      { label: '¾ load', tex: `W = 0.75\\times${tnum(v.hp)}\\times${tnum(v.lo)}`, result: `= ${n(r.q, 5)}\\ \\text{lb}`, ...(original ? { errata: 'The notes print 7,550 lb — an arithmetic slip for 7,560.' } : {}) },
    ],
    // the ¾-load figure follows from the student's lower limit
    follow: (_v, g) => ('lo' in g ? { q: 0.75 * g.lo } : {}),
    cite: SRC.tt510('p11 worked example'),
  }),
  parametric({
    id: '510-metric-tyre',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'tyre',
    title: 'Decode a metric tyre size',
    inputs: [
      { key: 'w', value: 710, min: 320, max: 900, step: 10 },
      { key: 'a', value: 70, min: 55, max: 85, step: 5 },
      { key: 'rim', value: 38, min: 24, max: 46, step: 2 },
    ],
    statement: (v) => `Decode the tyre size ${num(v.w)}/${num(v.a)}R${num(v.rim)}: find the section height and the overall diameter (1 in = 25.4 mm).`,
    answers: [
      { key: 'h', label: 'h', unit: 'mm', expected: 497 },
      { key: 'd', label: 'd', unit: 'mm', expected: 1959.2 },
    ],
    solve: (v) => {
      const t = decodeTyreSize(`${v.w}/${v.a}R${v.rim}`)
      return { h: t?.sectionHeightMm ?? NaN, d: t?.overallDiaMm ?? NaN }
    },
    working: (v, r) => [
      { label: 'Section height', tex: 'h = \\text{aspect}\\times b', sub: `${tnum(v.a / 100)}\\times${tnum(v.w)}`, result: `= ${n(r.h)}\\ \\text{mm}`, cite: SRC.l27('p32') },
      { label: 'Overall diameter', tex: 'd = d_{rim} + 2h', sub: `${tnum(v.rim)}\\times25.4 + 2\\times${n(r.h)}`, result: `= ${n(r.d, 5)}\\ \\text{mm}` },
    ],
    // the overall diameter follows from the student's section height
    follow: (v, g) => ('h' in g ? { d: v.rim * 25.4 + 2 * g.h } : {}),
    cite: SRC.l27('p32'),
  }),
  parametric({
    id: '510-contact-area',
    course: 'AEE510',
    topic: 'Tyres & ballast',
    moduleId: 'traction',
    sceneId: 'tyre',
    title: 'Tyre contact area from inflation pressure',
    inputs: [
      { key: 'W', value: 20, min: 5, max: 40, step: 0.5 },
      { key: 'p', value: 100, min: 60, max: 250, step: 5 },
    ],
    statement: (v) => `Ground pressure under a tyre is roughly equal to its inflation pressure. A tyre carrying ${num(v.W)} kN is inflated to ${num(v.p)} kPa: estimate the contact area.`,
    answers: [{ key: 'A', label: 'A', unit: 'm²', expected: 0.2 }],
    solve: (v) => ({ A: tyreContactArea(v.W * 1e3, v.p * 1e3) }),
    working: (v, r) => [{ label: 'Contact area', tex: 'A = \\dfrac{W}{p_i}', sub: `\\dfrac{${tnum(v.W * 1000)}}{${tnum(v.p * 1000)}}`, result: `= ${n(r.A)}\\ \\text{m}^2`, cite: SRC.l27('p39') }],
    cite: SRC.l27('p39'),
  }),
]
