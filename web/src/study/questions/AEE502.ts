import { SRC, cite } from '@/content/citations'
import { ulvRateKmh } from '@/physics/application'
import { armPower } from '@/physics/dynamometer'
import { cylinder, pump } from '@/physics/hydraulics'
import { hookeAcceleration, hookeInertiaTorque, hookeSpeedRange, inertiaFromWeight, rpmToRad } from '@/physics/joints'
import { ploughPerformance, ploughWork } from '@/physics/tillage'
import { gearTrainEfficiency, overallEfficiency, tractiveEfficiency } from '@/physics/tractor'
import { n } from '@/ui/Working'
import type { Question } from '../types'

const rad = (d: number) => (d * Math.PI) / 180
const G1617 = cite('AEE502', 'AEE 502-2016-2017- Marking Guide-draft-new.docx', 'pump and cylinder')
const G1819 = cite('AEE502', 'AEE 502 -2018-2019-Marking Guide.docx', 'Q3(c)ii')

export const AEE502: Question[] = [
  {
    id: '502-pump-1617',
    course: 'AEE502',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'pumps',
    title: 'Pump flows, torques and powers',
    statement:
      'A hydraulic pump of displacement 150 cm³/rev runs at 1800 rpm against 18 MPa. Its volumetric efficiency is 0.8 and its torque (mechanical) efficiency 0.9. Find the theoretical and actual flows, the theoretical and actual torques, the hydraulic and shaft powers, and the heat generated.',
    answers: [
      { key: 'QT', label: 'Q_T', unit: 'L/min', expected: 270 },
      { key: 'QA', label: 'Q_A', unit: 'L/min', expected: 216 },
      { key: 'TT', label: 'T_T', unit: 'N·m', expected: 429.7 },
      { key: 'TA', label: 'T_A', unit: 'N·m', expected: 477.5 },
      { key: 'Ph', label: 'P_h', unit: 'kW', expected: 64.8 },
      { key: 'Ps', label: 'P_s', unit: 'kW', expected: 90 },
      { key: 'heat', label: 'P_{loss}', unit: 'kW', expected: 25.2 },
    ],
    solve: () => {
      const r = pump(150, 1800, 18, 0.8, 0.9)
      return { QT: r.QT, QA: r.QA, TT: r.TT, TA: r.TA, Ph: r.Ph, Ps: r.Ps, heat: r.heatLoss }
    },
    working: (r) => [
      { label: 'Flows', tex: 'Q_T = D N,\\quad Q_A = \\eta_v Q_T', sub: '150\\times1800/1000,\\ 0.8\\times270', result: `= ${n(r.QT)},\\ ${n(r.QA)}\\ \\text{L/min}`, cite: SRC.hy510('pump efficiencies') },
      { label: 'Torques', tex: 'T_T = \\dfrac{\\Delta p\\,D}{2\\pi},\\quad T_A = \\dfrac{T_T}{\\eta_T}', sub: '\\dfrac{18\\times150}{2\\pi},\\ \\dfrac{429.7}{0.9}', result: `= ${n(r.TT)},\\ ${n(r.TA)}\\ \\text{N·m}` },
      { label: 'Powers', tex: 'P_h = \\dfrac{Q_A\\,\\Delta p}{60},\\quad P_s = \\dfrac{2\\pi N T_A}{60}', result: `P_h = ${n(r.Ph)},\\ P_s = ${n(r.Ps)},\\ \\text{heat} = ${n(r.heat)}\\ \\text{kW}` },
    ],
    cite: G1617,
    params: { source: 'manual', D: 150, rpm: 1800, dp: 18, etaV: 0.8, etaT: 0.9 },
  },
  {
    id: '502-cylinder-1617',
    course: 'AEE502',
    topic: 'Hydraulics',
    moduleId: 'hydraulics',
    sceneId: 'cylinder',
    title: 'Double-acting cylinder: forces and speeds',
    statement:
      'A double-acting cylinder has a 76.2 mm bore and a 25 mm rod. It is supplied with 68.13 L/min at 17.2 MPa. Find the extending and retracting forces and speeds, and the return flow while retracting.',
    answers: [
      { key: 'Fe', label: 'F_{ext}', unit: 'kN', expected: 78.4 },
      { key: 'Fr', label: 'F_{ret}', unit: 'kN', expected: 70.0 },
      { key: 've', label: 'v_{ext}', unit: 'm/s', expected: 0.249 },
      { key: 'vr', label: 'v_{ret}', unit: 'm/s', expected: 0.279 },
      { key: 'Qr', label: 'Q_{return}', unit: 'L/min', expected: 76.3 },
    ],
    solve: () => {
      const c = cylinder(0.0762, 0.025, 17.2e6, 68.13)
      return { Fe: c.forceExtend / 1000, Fr: c.forceRetract / 1000, ve: c.speedExtend, vr: c.speedRetract, Qr: c.returnFlowRetract }
    },
    working: (r) => [
      { label: 'Forces', tex: 'F_{ext} = p\\,\\tfrac{\\pi}{4}D^2,\\quad F_{ret} = p\\,\\tfrac{\\pi}{4}(D^2 - d^2)', result: `= ${n(r.Fe)},\\ ${n(r.Fr)}\\ \\text{kN}`, cite: SRC.hy510('cylinders') },
      { label: 'Speeds', tex: 'v = \\dfrac{Q}{A}', result: `v_{ext} = ${n(r.ve)},\\ v_{ret} = ${n(r.vr)}\\ \\text{m/s}` },
      { label: 'Return flow (cap end empties while retracting)', tex: 'Q_{ret} = v_{ret}\\,\\tfrac{\\pi}{4}D^2', result: `= ${n(r.Qr)}\\ \\text{L/min}` },
    ],
    cite: G1617,
    params: { bore: 0.0762, rod: 0.025, p: 17.2, Q: 68.13, load: 20 },
  },
  {
    id: '502-hooke-range',
    course: 'AEE502',
    topic: "Hooke's joint",
    moduleId: 'pto',
    sceneId: 'hookes-joint',
    title: "Hooke's joint: driven speed range",
    statement: "A Hooke's joint connects two shafts at 20°. The driving shaft turns at a uniform 1000 rpm. Find the maximum and minimum speeds of the driven shaft.",
    answers: [
      { key: 'max', label: '(\\omega_B)_{max}', unit: 'rpm', expected: 1064 },
      { key: 'min', label: '(\\omega_B)_{min}', unit: 'rpm', expected: 939.7 },
    ],
    solve: () => {
      const r = hookeSpeedRange(1000, rad(20))
      return { max: r.max, min: r.min }
    },
    working: (r) => [
      { label: 'Maximum (θ = 0°, 180°)', tex: '(\\omega_B)_{max} = \\dfrac{\\omega_A}{\\cos\\delta}', sub: '\\dfrac{1000}{\\cos20^\\circ}', result: `= ${n(r.max)}\\ \\text{rpm}`, cite: SRC.hj502('speed ratio') },
      { label: 'Minimum (θ = 90°, 270°)', tex: '(\\omega_B)_{min} = \\omega_A\\cos\\delta', sub: '1000\\cos20^\\circ', result: `= ${n(r.min)}\\ \\text{rpm}` },
    ],
    cite: SRC.hj502('Example 26.3'),
    params: { delta: 20, rpm: 1000 },
  },
  {
    id: '502-hooke-inertia',
    course: 'AEE502',
    topic: "Hooke's joint",
    moduleId: 'pto',
    sceneId: 'hookes-joint',
    title: "Hooke's joint: inertia torque",
    statement:
      "The driven shaft of a Hooke's joint (δ = 20°, driver at 1000 rpm) carries a mass weighing 147 N with radius of gyration 0.25 m. Find its moment of inertia, the angular acceleration of the driven shaft at θ = 45°, and the inertia torque on the driven shaft.",
    answers: [
      { key: 'I', label: 'I', unit: 'kg·m²', expected: 0.9365 },
      { key: 'alpha', label: '|\\alpha_B|', unit: 'rad/s²', expected: 1360 },
      { key: 'TB', label: '|T_B|', unit: 'N·m', expected: 1273.6 },
    ],
    solve: () => {
      const I = inertiaFromWeight(147, 0.25)
      const t = hookeInertiaTorque(rad(20), rad(45), rpmToRad(1000), I)
      return { I, alpha: Math.abs(hookeAcceleration(rad(20), rad(45), rpmToRad(1000))), TB: Math.abs(t.TB) }
    },
    working: (r) => [
      { label: 'Inertia', tex: 'I = \\dfrac{W}{g}k^2', sub: '\\dfrac{147}{9.81}(0.25)^2', result: `= ${n(r.I)}\\ \\text{kg·m}^2` },
      { label: 'Acceleration', tex: '\\alpha_B = \\dfrac{-\\omega_A^2\\cos\\delta\\sin^2\\delta\\sin2\\theta}{(1-\\cos^2\\theta\\sin^2\\delta)^2}', result: `|\\alpha_B| = ${n(r.alpha)}\\ \\text{rad/s}^2`, errata: 'The book rounds sin²20° to 0.1175 and prints −1365 rad/s² and 1278.4 N·m.' },
      { label: 'Inertia torque', tex: 'T_B = I\\,\\alpha_B', result: `= ${n(r.TB)}\\ \\text{N·m}` },
    ],
    cite: SRC.hj502('Example 26.3'),
    errata: 'hooke-inertia',
    params: { delta: 20, rpm: 1000, weight: 147, k: 0.25, thetaProbe: 45 },
  },
  {
    id: '502-two-bottom-1819',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Two-bottom plough: draft and power',
    statement: 'A two-bottom mouldboard plough has 150 mm bottoms working 70 mm deep at 2.8 km/h in soil of unit draft 2 N/cm². Find the furrow cross-section, the draft and the power.',
    answers: [
      { key: 'A', label: 'A', unit: 'cm²', expected: 210 },
      { key: 'D', label: 'D', unit: 'N', expected: 420 },
      { key: 'P', label: 'P', unit: 'W', expected: 327 },
    ],
    solve: () => {
      const r = ploughPerformance(2, 0.15, 0.07, 2, 2.8)
      return { A: r.A, D: r.D, P: r.P }
    },
    working: (r) => [
      { label: 'Furrow area (both bottoms)', tex: 'A = n\\,w\\,d', sub: '2\\times15\\times7', result: `= ${n(r.A)}\\ \\text{cm}^2`, cite: SRC.am502('§12 draft'), errata: 'The 2018/19 guide uses one bottom only (105 cm², 210 N).' },
      { label: 'Draft', tex: 'D = k\\,A', sub: `2\\times${n(r.A)}`, result: `= ${n(r.D)}\\ \\text{N}` },
      { label: 'Power', tex: 'P = D\\,v', sub: `${n(r.D)}\\times\\dfrac{2.8}{3.6}`, result: `= ${n(r.P)}\\ \\text{W}` },
    ],
    cite: G1819,
    errata: 'two-bottom',
    params: { bottoms: 2, width: 0.15, depth: 0.07, unitDraft: 2, speed: 2.8 },
  },
  {
    id: '502-plough-hp',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Plough draft power in horsepower',
    statement: 'A single 150 mm × 60 mm furrow is ploughed in clay (unit draft 2 N/cm²) at 1 m/s. Find the draft, the power, and the power in metric horsepower (735.5 W).',
    answers: [
      { key: 'D', label: 'D', unit: 'N', expected: 180 },
      { key: 'P', label: 'P', unit: 'W', expected: 180 },
      { key: 'hp', label: 'P', unit: 'hp', expected: 0.245 },
    ],
    solve: () => {
      const r = ploughPerformance(2, 0.15, 0.06, 1, 3.6)
      return { D: r.D, P: r.P, hp: r.hp }
    },
    working: (r) => [
      { label: 'Draft', tex: 'D = k\\,w\\,d', sub: '2\\times15\\times6', result: `= ${n(r.D)}\\ \\text{N}`, cite: SRC.am502('§12') },
      { label: 'Power', tex: 'P = D\\,v', sub: '180\\times1', result: `= ${n(r.P)}\\ \\text{W} = ${n(r.hp, 3)}\\ \\text{hp}`, errata: 'The notes treat newtons as kgf and print 2.4 hp.' },
    ],
    cite: SRC.am502('§12, draft example'),
    errata: 'plough-hp',
    params: { bottoms: 1, width: 0.15, depth: 0.06, unitDraft: 2, speed: 3.6 },
  },
  {
    id: '502-plough-work',
    course: 'AEE502',
    topic: 'Tillage draft',
    moduleId: 'implements',
    sceneId: 'mouldboard',
    title: 'Work to plough one hectare',
    statement: 'The two-bottom plough above (draft 420 N, working width 0.30 m) ploughs 1 ha. Find the work done.',
    answers: [{ key: 'W', label: 'W', unit: 'MJ', expected: 14.0 }],
    solve: () => ({ W: ploughWork(420, 0.3, 1) / 1e6 }),
    working: (r) => [
      { label: 'Distance travelled', tex: 's = \\dfrac{10\\,000}{w}', sub: '\\dfrac{10\\,000}{0.30}', result: '= 33\\,333\\ \\text{m}' },
      { label: 'Work', tex: 'W = D\\,s', sub: '420\\times33\\,333', result: `= ${n(r.W)}\\ \\text{MJ}`, errata: 'The 2018/19 guide gives a dimensionless 2×10⁸.' },
    ],
    cite: G1819,
    errata: 'two-bottom',
  },
  {
    id: '502-dyno-arm',
    course: 'AEE502',
    topic: 'Tractor testing',
    moduleId: 'testing',
    sceneId: 'dynamometers',
    title: 'Absorption dynamometer power',
    statement: 'A brake dynamometer has a torque arm of 0.8 m. The scale reads 200 N with the engine at 1500 rpm. Find the power.',
    answers: [{ key: 'P', label: 'P', unit: 'kW', expected: 25.13 }],
    solve: () => ({ P: armPower(0.8, 200, 1500) }),
    working: (r) => [{ label: 'Power', tex: 'P = \\dfrac{2\\pi l F n}{60\\,000}', sub: '\\dfrac{2\\pi\\times0.8\\times200\\times1500}{60\\,000}', result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.tests502('eq 3–5') }],
    cite: SRC.tests502('eq 3–5'),
  },
  {
    id: '502-tractive-eff',
    course: 'AEE502',
    topic: 'Tractor mechanics',
    moduleId: 'traction',
    sceneId: 'traction-lab',
    title: 'Tractive efficiency',
    statement: 'A tractor develops a pull of 10 kN against a rolling resistance of 1 kN with 10 % wheel slip. Find the tractive efficiency.',
    answers: [{ key: 'eta', label: '\\eta_t', unit: '', expected: 0.818 }],
    solve: () => ({ eta: tractiveEfficiency(10, 1, 0.1) }),
    working: (r) => [{ label: 'Tractive efficiency', tex: '\\eta_t = \\dfrac{P}{P + R}(1 - i)', sub: '\\dfrac{10}{11}(1-0.1)', result: `= ${n(r.eta, 3)}`, cite: SRC.mac502('eq 2.10') }],
    cite: SRC.mac502('eq 2.10'),
  },
  {
    id: '502-overall-eff',
    course: 'AEE502',
    topic: 'Tractor mechanics',
    moduleId: 'powertrain',
    sceneId: 'line-of-drive',
    title: 'Transmission and overall efficiency',
    statement: 'Power reaches the wheels through 5 gear pairs, each 98 % efficient. The engine efficiency is 0.30 and the tractive efficiency 0.75; take the transmission efficiency as 0.90. Find the gear-train efficiency and the overall efficiency.',
    answers: [
      { key: 'g', label: '\\eta_{gears}', unit: '', expected: 0.904 },
      { key: 'o', label: '\\eta_{overall}', unit: '', expected: 0.2025 },
    ],
    solve: () => ({ g: gearTrainEfficiency(5), o: overallEfficiency(0.3, 0.9, 0.75) }),
    working: (r) => [
      { label: 'Gear train', tex: '\\eta = 0.98^{5}', result: `= ${n(r.g, 3)}`, cite: SRC.mac502('Ch 2') },
      { label: 'Overall', tex: '\\eta_o = \\eta_e\\,\\eta_{tr}\\,\\eta_t', sub: '0.30\\times0.90\\times0.75', result: `= ${n(r.o)}` },
    ],
    cite: SRC.mac502('Ch 2'),
  },
  {
    id: '502-ulv-rate',
    course: 'AEE502',
    topic: 'Spraying',
    moduleId: 'implements',
    sceneId: 'sprayer',
    title: 'ULV sprayer work rate',
    statement: 'An operator with a ULV (spinning-disc) sprayer walks at 3.6 km/h and treats a 15 m swath. Find the rate of work.',
    answers: [{ key: 'C', label: 'C', unit: 'ha/h', expected: 5.4 }],
    solve: () => ({ C: ulvRateKmh(3.6, 15) }),
    working: (r) => [{ label: 'Work rate', tex: 'C = \\dfrac{S\\,W}{10}', sub: '\\dfrac{3.6\\times15}{10}', result: `= ${n(r.C)}\\ \\text{ha/h}`, cite: SRC.am502('§15.10–15.11') }],
    cite: SRC.am502('§15.10–15.11'),
  },
]
