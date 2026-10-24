import { SRC, cite } from '@/content/citations'
import { ulvRateKmh } from '@/physics/application'
import { armPower } from '@/physics/dynamometer'
import { cylinder, pump } from '@/physics/hydraulics'
import { hookeAcceleration, hookeInertiaTorque, hookeSpeedRange, inertiaFromWeight, rpmToRad } from '@/physics/joints'
import { ploughPerformance, ploughWork, travelForArea } from '@/physics/tillage'
import { gearTrainEfficiency, overallEfficiency, tractiveEfficiency } from '@/physics/tractor'
import { n } from '@/ui/Working'
import type { Question } from '../types'
import { num, parametric, tnum } from '../variants'

const rad = (d: number) => (d * Math.PI) / 180
const G1617 = cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', 'pump and cylinder')
const G1819 = cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', 'Q3(c)ii')

export const AEE502: Question[] = [
  parametric({
    id: '502-pump-1617',
    course: 'AEE502',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'pumps',
    title: 'Pump flows, torques and powers',
    inputs: [
      { key: 'D', value: 150, min: 10, max: 250, step: 5 },
      { key: 'N', value: 1800, min: 1000, max: 3000, step: 100 },
      { key: 'dp', value: 18, min: 7, max: 25, step: 0.5 },
      { key: 'ev', value: 0.8, min: 0.75, max: 0.98, step: 0.01 },
      { key: 'et', value: 0.9, min: 0.8, max: 0.95, step: 0.01 },
    ],
    statement: (v) =>
      `A hydraulic pump of displacement ${num(v.D)} cm³/rev runs at ${num(v.N)} rpm against ${num(v.dp)} MPa. Its volumetric efficiency is ${num(v.ev)} and its torque (mechanical) efficiency ${num(v.et)}. Find the theoretical and actual flows, the theoretical and actual torques, the hydraulic and shaft powers, and the heat generated.`,
    answers: [
      { key: 'QT', label: 'Q_T', unit: 'L/min', expected: 270 },
      { key: 'QA', label: 'Q_A', unit: 'L/min', expected: 216 },
      { key: 'TT', label: 'T_T', unit: 'N·m', expected: 429.7 },
      { key: 'TA', label: 'T_A', unit: 'N·m', expected: 477.5 },
      { key: 'Ph', label: 'P_h', unit: 'kW', expected: 64.8 },
      { key: 'Ps', label: 'P_s', unit: 'kW', expected: 90 },
      { key: 'heat', label: 'P_{loss}', unit: 'kW', expected: 25.2 },
    ],
    solve: (v) => {
      const r = pump(v.D, v.N, v.dp, v.ev, v.et)
      return { QT: r.QT, QA: r.QA, TT: r.TT, TA: r.TA, Ph: r.Ph, Ps: r.Ps, heat: r.heatLoss }
    },
    working: (v, r) => [
      { label: 'Flows', tex: 'Q_T = D N,\\quad Q_A = \\eta_v Q_T', sub: `${tnum(v.D)}\\times${tnum(v.N)}/1000,\\ ${tnum(v.ev)}\\times${n(r.QT)}`, result: `= ${n(r.QT)},\\ ${n(r.QA)}\\ \\text{L/min}`, cite: SRC.hy510('pump efficiencies') },
      { label: 'Torques', tex: 'T_T = \\dfrac{\\Delta p\\,D}{2\\pi},\\quad T_A = \\dfrac{T_T}{\\eta_T}', sub: `\\dfrac{${tnum(v.dp)}\\times${tnum(v.D)}}{2\\pi},\\ \\dfrac{${n(r.TT)}}{${tnum(v.et)}}`, result: `= ${n(r.TT)},\\ ${n(r.TA)}\\ \\text{N·m}` },
      { label: 'Powers', tex: 'P_h = \\dfrac{Q_A\\,\\Delta p}{60},\\quad P_s = \\dfrac{2\\pi N T_A}{60}', result: `P_h = ${n(r.Ph)},\\ P_s = ${n(r.Ps)},\\ \\text{heat} = ${n(r.heat)}\\ \\text{kW}` },
    ],
    cite: G1617,
    params: (v) => ({ source: 'manual', D: v.D, rpm: v.N, dp: v.dp, etaV: v.ev, etaT: v.et }),
  }),
  parametric({
    id: '502-cylinder-1617',
    course: 'AEE502',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'cylinder',
    title: 'Double-acting cylinder: forces and speeds',
    inputs: [
      { key: 'bore', value: 76.2, min: 40, max: 150, step: 5 },
      { key: 'rod', value: 25, min: 20, max: 90, step: 5 },
      { key: 'Q', value: 68.13, min: 10, max: 120, step: 1 },
      { key: 'p', value: 17.2, min: 7, max: 25, step: 0.5 },
    ],
    statement: (v) =>
      `A double-acting cylinder has a ${num(v.bore)} mm bore and a ${num(v.rod)} mm rod. It is supplied with ${num(v.Q)} L/min at ${num(v.p)} MPa. Find the extending and retracting forces and speeds, and the return flow while retracting.`,
    answers: [
      { key: 'Fe', label: 'F_{ext}', unit: 'kN', expected: 78.4 },
      { key: 'Fr', label: 'F_{ret}', unit: 'kN', expected: 70.0 },
      { key: 've', label: 'v_{ext}', unit: 'm/s', expected: 0.249 },
      { key: 'vr', label: 'v_{ret}', unit: 'm/s', expected: 0.279 },
      { key: 'Qr', label: 'Q_{return}', unit: 'L/min', expected: 76.3 },
    ],
    solve: (v) => {
      const c = cylinder(v.bore / 1000, v.rod / 1000, v.p * 1e6, v.Q)
      return { Fe: c.forceExtend / 1000, Fr: c.forceRetract / 1000, ve: c.speedExtend, vr: c.speedRetract, Qr: c.returnFlowRetract }
    },
    // a real rod is 30–70 % of the bore, and the piston speeds stay within what seals allow
    valid: (v, r) => v.rod >= 0.3 * v.bore && v.rod <= 0.7 * v.bore && r.ve >= 0.03 && r.vr <= 1,
    working: (v, r) => [
      { label: 'Forces', tex: 'F_{ext} = p\\,\\tfrac{\\pi}{4}D^2,\\quad F_{ret} = p\\,\\tfrac{\\pi}{4}(D^2 - d^2)', sub: `${tnum(v.p)}\\times10^6\\times\\tfrac{\\pi}{4}(${tnum(v.bore / 1000)})^2,\\ ${tnum(v.p)}\\times10^6\\times\\tfrac{\\pi}{4}(${tnum(v.bore / 1000)}^2 - ${tnum(v.rod / 1000)}^2)`, result: `= ${n(r.Fe)},\\ ${n(r.Fr)}\\ \\text{kN}`, cite: SRC.hy510('cylinders') },
      { label: 'Speeds', tex: 'v = \\dfrac{Q}{A}', sub: `\\dfrac{${tnum(v.Q)}/60\\,000}{A}`, result: `v_{ext} = ${n(r.ve)},\\ v_{ret} = ${n(r.vr)}\\ \\text{m/s}` },
      { label: 'Return flow (cap end empties while retracting)', tex: 'Q_{ret} = v_{ret}\\,\\tfrac{\\pi}{4}D^2', result: `= ${n(r.Qr)}\\ \\text{L/min}` },
    ],
    cite: G1617,
    params: (v) => ({ bore: v.bore / 1000, rod: v.rod / 1000, p: v.p, Q: v.Q, load: 20 }),
  }),
  parametric({
    id: '502-hooke-range',
    course: 'AEE502',
    topic: "Hooke's joint",
    moduleId: 'pto',
    sceneId: 'hookes-joint',
    title: "Hooke's joint: driven speed range",
    inputs: [
      { key: 'delta', value: 20, min: 5, max: 30, step: 1 },
      { key: 'N', value: 1000, min: 300, max: 2000, step: 50 },
    ],
    statement: (v) => `A Hooke's joint connects two shafts at ${num(v.delta)}°. The driving shaft turns at a uniform ${num(v.N)} rpm. Find the maximum and minimum speeds of the driven shaft.`,
    answers: [
      { key: 'max', label: '(\\omega_B)_{max}', unit: 'rpm', expected: 1064 },
      { key: 'min', label: '(\\omega_B)_{min}', unit: 'rpm', expected: 939.7 },
    ],
    solve: (v) => {
      const r = hookeSpeedRange(v.N, rad(v.delta))
      return { max: r.max, min: r.min }
    },
    working: (v, r) => [
      { label: 'Maximum (θ = 0°, 180°)', tex: '(\\omega_B)_{max} = \\dfrac{\\omega_A}{\\cos\\delta}', sub: `\\dfrac{${tnum(v.N)}}{\\cos${tnum(v.delta)}^\\circ}`, result: `= ${n(r.max)}\\ \\text{rpm}`, cite: SRC.hj502('speed ratio') },
      { label: 'Minimum (θ = 90°, 270°)', tex: '(\\omega_B)_{min} = \\omega_A\\cos\\delta', sub: `${tnum(v.N)}\\cos${tnum(v.delta)}^\\circ`, result: `= ${n(r.min)}\\ \\text{rpm}` },
    ],
    cite: SRC.hj502('Example 26.3'),
    params: (v) => ({ delta: v.delta, rpm: v.N }),
  }),
  parametric({
    id: '502-hooke-inertia',
    course: 'AEE502',
    topic: "Hooke's joint",
    moduleId: 'pto',
    sceneId: 'hookes-joint',
    title: "Hooke's joint: inertia torque",
    inputs: [
      { key: 'delta', value: 20, min: 5, max: 30, step: 1 },
      { key: 'N', value: 1000, min: 300, max: 1500, step: 50 },
      { key: 'W', value: 147, min: 50, max: 500, step: 1 },
      { key: 'k', value: 0.25, min: 0.1, max: 0.5, step: 0.01 },
      { key: 'theta', value: 45, min: 10, max: 80, step: 5 },
    ],
    statement: (v) =>
      `The driven shaft of a Hooke's joint (δ = ${num(v.delta)}°, driver at ${num(v.N)} rpm) carries a mass weighing ${num(v.W)} N with radius of gyration ${num(v.k)} m. Find its moment of inertia, the angular acceleration of the driven shaft at θ = ${num(v.theta)}°, and the inertia torque on the driven shaft.`,
    answers: [
      { key: 'I', label: 'I', unit: 'kg·m²', expected: 0.9365 },
      { key: 'alpha', label: '|\\alpha_B|', unit: 'rad/s²', expected: 1360 },
      { key: 'TB', label: '|T_B|', unit: 'N·m', expected: 1273.6 },
    ],
    solve: (v) => {
      const I = inertiaFromWeight(v.W, v.k)
      const t = hookeInertiaTorque(rad(v.delta), rad(v.theta), rpmToRad(v.N), I)
      return { I, alpha: Math.abs(hookeAcceleration(rad(v.delta), rad(v.theta), rpmToRad(v.N))), TB: Math.abs(t.TB) }
    },
    working: (v, r, original) => [
      { label: 'Inertia', tex: 'I = \\dfrac{W}{g}k^2', sub: `\\dfrac{${tnum(v.W)}}{9.81}(${tnum(v.k)})^2`, result: `= ${n(r.I)}\\ \\text{kg·m}^2` },
      { label: 'Acceleration', tex: '\\alpha_B = \\dfrac{-\\omega_A^2\\cos\\delta\\sin^2\\delta\\sin2\\theta}{(1-\\cos^2\\theta\\sin^2\\delta)^2}', result: `|\\alpha_B| = ${n(r.alpha)}\\ \\text{rad/s}^2`, ...(original ? { errata: 'The book rounds sin²20° to 0.1175 and prints −1365 rad/s² and 1278.4 N·m.' } : {}) },
      { label: 'Inertia torque', tex: 'T_B = I\\,\\alpha_B', result: `= ${n(r.TB)}\\ \\text{N·m}` },
    ],
    cite: SRC.hj502('Example 26.3'),
    errata: 'hooke-inertia',
    params: (v) => ({ delta: v.delta, rpm: v.N, weight: v.W, k: v.k, thetaProbe: v.theta }),
  }),
  parametric({
    id: '502-two-bottom-1819',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Multi-bottom plough: draft and power',
    inputs: [
      { key: 'b', value: 2, min: 2, max: 5, step: 1 },
      { key: 'w', value: 150, min: 150, max: 400, step: 25 },
      { key: 'd', value: 70, min: 50, max: 250, step: 10 },
      { key: 'S', value: 2.8, min: 2, max: 8, step: 0.1 },
      { key: 'k', value: 2, min: 2, max: 10, step: 0.5 },
    ],
    statement: (v) =>
      `A ${num(v.b)}-bottom mouldboard plough has ${num(v.w)} mm bottoms working ${num(v.d)} mm deep at ${num(v.S)} km/h in soil of unit draft ${num(v.k)} N/cm². Find the furrow cross-section, the draft and the power.`,
    answers: [
      { key: 'A', label: 'A', unit: 'cm²', expected: 210 },
      { key: 'D', label: 'D', unit: 'N', expected: 420 },
      { key: 'P', label: 'P', unit: 'W', expected: 327 },
    ],
    solve: (v) => {
      const r = ploughPerformance(v.k, v.w / 1000, v.d / 1000, v.b, v.S)
      return { A: r.A, D: r.D, P: r.P }
    },
    // a mouldboard furrow is no deeper than about 70 % of the bottom's width
    valid: (v) => v.d <= 0.7 * v.w,
    working: (v, r, original) => [
      { label: 'Furrow area (all bottoms)', tex: 'A = n\\,w\\,d', sub: `${tnum(v.b)}\\times${tnum(v.w / 10)}\\times${tnum(v.d / 10)}`, result: `= ${n(r.A)}\\ \\text{cm}^2`, cite: SRC.am502('§12 draft'), ...(original ? { errata: 'The 2018/19 guide uses one bottom only (105 cm², 210 N).' } : {}) },
      { label: 'Draft', tex: 'D = k\\,A', sub: `${tnum(v.k)}\\times${n(r.A)}`, result: `= ${n(r.D)}\\ \\text{N}` },
      { label: 'Power', tex: 'P = D\\,v', sub: `${n(r.D)}\\times\\dfrac{${tnum(v.S)}}{3.6}`, result: `= ${n(r.P)}\\ \\text{W}` },
    ],
    cite: G1819,
    errata: 'two-bottom',
    params: (v) => ({ bottoms: v.b, width: v.w / 1000, depth: v.d / 1000, unitDraft: v.k, speed: v.S }),
  }),
  parametric({
    id: '502-plough-hp',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Plough draft power in horsepower',
    inputs: [
      { key: 'w', value: 150, min: 150, max: 400, step: 25 },
      { key: 'd', value: 60, min: 50, max: 250, step: 10 },
      { key: 'k', value: 2, min: 2, max: 12, step: 0.5 },
      { key: 'S', value: 1, min: 0.5, max: 2.5, step: 0.1 },
    ],
    statement: (v) =>
      `A single ${num(v.w)} mm × ${num(v.d)} mm furrow is ploughed in clay (unit draft ${num(v.k)} N/cm²) at ${num(v.S)} m/s. Find the draft, the power, and the power in metric horsepower (735.5 W).`,
    answers: [
      { key: 'D', label: 'D', unit: 'N', expected: 180 },
      { key: 'P', label: 'P', unit: 'W', expected: 180 },
      { key: 'hp', label: 'P', unit: 'hp', expected: 0.245 },
    ],
    solve: (v) => {
      const r = ploughPerformance(v.k, v.w / 1000, v.d / 1000, 1, v.S * 3.6)
      return { D: r.D, P: r.P, hp: r.hp }
    },
    // a mouldboard furrow is no deeper than about 70 % of its width
    valid: (v) => v.d <= 0.7 * v.w,
    working: (v, r, original) => [
      { label: 'Draft', tex: 'D = k\\,w\\,d', sub: `${tnum(v.k)}\\times${tnum(v.w / 10)}\\times${tnum(v.d / 10)}`, result: `= ${n(r.D)}\\ \\text{N}`, cite: SRC.am502('§12') },
      { label: 'Power', tex: 'P = D\\,v', sub: `${n(r.D)}\\times${tnum(v.S)}`, result: `= ${n(r.P)}\\ \\text{W} = ${n(r.hp, 3)}\\ \\text{hp}`, ...(original ? { errata: 'The notes treat newtons as kgf and print 2.4 hp.' } : {}) },
    ],
    cite: SRC.am502('§12, draft example'),
    errata: 'plough-hp',
    params: (v) => ({ bottoms: 1, width: v.w / 1000, depth: v.d / 1000, unitDraft: v.k, speed: v.S * 3.6 }),
  }),
  parametric({
    id: '502-plough-work',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Work to plough a field',
    inputs: [
      { key: 'D', value: 420, min: 400, max: 4000, step: 10 },
      { key: 'w', value: 0.3, min: 0.3, max: 1.5, step: 0.05 },
      { key: 'A', value: 1, min: 1, max: 10, step: 0.5 },
    ],
    statement: (v) => `A plough with a draft of ${num(v.D)} N and a working width of ${num(v.w)} m ploughs ${num(v.A)} ha. Find the work done.`,
    answers: [{ key: 'W', label: 'W', unit: 'MJ', expected: 14.0 }],
    solve: (v) => ({ W: ploughWork(v.D, v.w, v.A) / 1e6 }),
    working: (v, r, original) => [
      { label: 'Distance travelled', tex: 's = \\dfrac{10\\,000\\,A}{w}', sub: `\\dfrac{10\\,000\\times${tnum(v.A)}}{${tnum(v.w)}}`, result: `= ${n(travelForArea(v.w, v.A), 5)}\\ \\text{m}` },
      { label: 'Work', tex: 'W = D\\,s', sub: `${tnum(v.D)}\\times${n(travelForArea(v.w, v.A), 5)}`, result: `= ${n(r.W)}\\ \\text{MJ}`, ...(original ? { errata: 'The 2018/19 guide gives a dimensionless 2×10⁸.' } : {}) },
    ],
    cite: G1819,
    errata: 'two-bottom',
  }),
  parametric({
    id: '502-dyno-arm',
    course: 'AEE502',
    topic: 'Tractor testing',
    moduleId: 'testing',
    sceneId: 'dynamometers',
    title: 'Absorption dynamometer power',
    inputs: [
      { key: 'l', value: 0.8, min: 0.3, max: 1.5, step: 0.05 },
      { key: 'F', value: 200, min: 50, max: 1000, step: 10 },
      { key: 'N', value: 1500, min: 800, max: 2600, step: 50 },
    ],
    statement: (v) => `A brake dynamometer has a torque arm of ${num(v.l)} m. The scale reads ${num(v.F)} N with the engine at ${num(v.N)} rpm. Find the power.`,
    answers: [{ key: 'P', label: 'P', unit: 'kW', expected: 25.13 }],
    solve: (v) => ({ P: armPower(v.l, v.F, v.N) }),
    // a tractor engine on test: between 5 and 200 kW
    valid: (_v, r) => r.P >= 5 && r.P <= 200,
    working: (v, r) => [{ label: 'Power', tex: 'P = \\dfrac{2\\pi l F n}{60\\,000}', sub: `\\dfrac{2\\pi\\times${tnum(v.l)}\\times${tnum(v.F)}\\times${tnum(v.N)}}{60\\,000}`, result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.tests502('eq 3–5') }],
    cite: SRC.tests502('eq 3–5'),
  }),
  parametric({
    id: '502-tractive-eff',
    course: 'AEE502',
    topic: 'Tractor mechanics',
    moduleId: 'traction',
    sceneId: 'traction-lab',
    title: 'Tractive efficiency',
    inputs: [
      { key: 'P', value: 10, min: 5, max: 60, step: 0.5 },
      { key: 'R', value: 1, min: 0.5, max: 8, step: 0.1 },
      { key: 's', value: 10, min: 4, max: 25, step: 1 },
    ],
    statement: (v) => `A tractor develops a pull of ${num(v.P)} kN against a rolling resistance of ${num(v.R)} kN with ${num(v.s)} % wheel slip. Find the tractive efficiency.`,
    answers: [{ key: 'eta', label: '\\eta_t', unit: '', expected: 0.818 }],
    solve: (v) => ({ eta: tractiveEfficiency(v.P, v.R, v.s / 100) }),
    // rolling resistance is a modest fraction of the pull on a working tractor
    valid: (v) => v.R >= 0.04 * v.P && v.R <= 0.3 * v.P,
    working: (v, r) => [{ label: 'Tractive efficiency', tex: '\\eta_t = \\dfrac{P}{P + R}(1 - i)', sub: `\\dfrac{${tnum(v.P)}}{${tnum(v.P + v.R)}}(1-${tnum(v.s / 100)})`, result: `= ${n(r.eta, 3)}`, cite: SRC.mac502('eq 2.10') }],
    cite: SRC.mac502('eq 2.10'),
  }),
  parametric({
    id: '502-overall-eff',
    course: 'AEE502',
    topic: 'Tractor mechanics',
    moduleId: 'powertrain',
    sceneId: 'line-of-drive',
    title: 'Transmission and overall efficiency',
    inputs: [
      { key: 'pairs', value: 5, min: 2, max: 8, step: 1 },
      { key: 'pe', value: 98, min: 95, max: 99, step: 0.5 },
      { key: 'ee', value: 0.3, min: 0.25, max: 0.4, step: 0.01 },
      { key: 'et', value: 0.75, min: 0.6, max: 0.85, step: 0.01 },
      { key: 'etr', value: 0.9, min: 0.8, max: 0.95, step: 0.01 },
    ],
    statement: (v) =>
      `Power reaches the wheels through ${num(v.pairs)} gear pairs, each ${num(v.pe)} % efficient. The engine efficiency is ${num(v.ee)} and the tractive efficiency ${num(v.et)}; take the transmission efficiency as ${num(v.etr)}. Find the gear-train efficiency and the overall efficiency.`,
    answers: [
      { key: 'g', label: '\\eta_{gears}', unit: '', expected: 0.904 },
      { key: 'o', label: '\\eta_{overall}', unit: '', expected: 0.2025 },
    ],
    solve: (v) => ({ g: gearTrainEfficiency(v.pairs, v.pe / 100), o: overallEfficiency(v.ee, v.etr, v.et) }),
    working: (v, r) => [
      { label: 'Gear train', tex: `\\eta = ${tnum(v.pe / 100)}^{${tnum(v.pairs)}}`, result: `= ${n(r.g, 3)}`, cite: SRC.mac502('Ch 2') },
      { label: 'Overall', tex: '\\eta_o = \\eta_e\\,\\eta_{tr}\\,\\eta_t', sub: `${tnum(v.ee)}\\times${tnum(v.etr)}\\times${tnum(v.et)}`, result: `= ${n(r.o)}` },
    ],
    cite: SRC.mac502('Ch 2'),
  }),
  parametric({
    id: '502-ulv-rate',
    course: 'AEE502',
    topic: 'Spraying',
    moduleId: 'implements',
    sceneId: 'sprayer',
    title: 'ULV sprayer work rate',
    inputs: [
      { key: 'S', value: 3.6, min: 2, max: 6, step: 0.1 },
      { key: 'W', value: 15, min: 3, max: 20, step: 0.5 },
    ],
    statement: (v) => `An operator with a ULV (spinning-disc) sprayer walks at ${num(v.S)} km/h and treats a ${num(v.W)} m swath. Find the rate of work.`,
    answers: [{ key: 'C', label: 'C', unit: 'ha/h', expected: 5.4 }],
    solve: (v) => ({ C: ulvRateKmh(v.S, v.W) }),
    working: (v, r) => [{ label: 'Work rate', tex: 'C = \\dfrac{S\\,W}{10}', sub: `\\dfrac{${tnum(v.S)}\\times${tnum(v.W)}}{10}`, result: `= ${n(r.C)}\\ \\text{ha/h}`, cite: SRC.am502('§15.10–15.11') }],
    cite: SRC.am502('§15.10–15.11'),
  }),
]
