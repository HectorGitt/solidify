import { cite } from '@/content/citations'
import { reactions, moment, type Beam } from '@/physics/beam'
import { AMMONIA } from '@/physics/fluidtables'
import { areaFor } from '@/physics/heatexchanger'
import { energyFluctuation, equivalentMasses, flywheelInertia, hartnell, porter, porterAlphaAfterLift, radToRpm, rpmToRad, sensitivity, staticBalance } from '@/physics/machinedynamics'
import { refrigeration } from '@/physics/plantcycles'
import { circleArea, compositeBar, eulerLimitSlenderness, eulerLoad, extension, polarTube, railGapAt, railStressAt, railsTouchAt, secondMomentCircle, shaftStress, shaftTorque, solidShaftForStress, tubeArea, twist } from '@/physics/strength'
import { n } from '@/ui/Working'
import type { Question } from '../types'
import { num, parametric, tnum } from '../variants'

const CVE = (where: string) => cite('CVE202', 'CVE PQ.pdf', where)
const MD = (file: string, where: string) => cite('MEE306', file, where)
const HX = (where: string) => cite('AEE306', 'heat exchanger tutorials.docx', where)
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Strength of materials */
export const STRENGTH: Question[] = [
  parametric({
    id: 'mat-rod-extension',
    course: 'CVE202',
    topic: 'Direct stress',
    moduleId: 'materials',
    sceneId: 'tensile',
    title: 'Extension of a round rod',
    inputs: [
      { key: 'P', value: 100, min: 20, max: 200, step: 5 },
      { key: 'L', value: 100, min: 50, max: 500, step: 10 },
      { key: 'd', value: 15, min: 10, max: 40, step: 1 },
      { key: 'E', value: 200, min: 70, max: 210, step: 5 },
    ],
    statement: (v) => `A rod ${num(v.L)} mm long and ${num(v.d)} mm in diameter carries a pull of ${num(v.P)} kN. With E = ${num(v.E)} GPa, find its extension.`,
    answers: [{ key: 'dL', label: '\\delta', unit: 'mm', expected: 0.283 }],
    solve: (v) => ({ dL: extension(v.P * 1e3, v.L / 1e3, circleArea(v.d / 1e3), v.E * 1e9) * 1e3 }),
    working: (v, r) => [{ label: 'Extension', tex: '\\delta = \\dfrac{PL}{AE}', sub: `\\dfrac{(${tnum(v.P)}\\times 10^3)(${tnum(v.L)})}{(\\pi\\,${tnum(v.d)}^2/4)(${tnum(v.E)}\\times 10^3)}`, result: `${n(r.dL, 3)}\\ \\text{mm}` }],
    cite: CVE('direct stress'),
  }),
  parametric({
    id: 'mat-hollow-column',
    course: 'CVE202',
    topic: 'Direct stress',
    moduleId: 'materials',
    sceneId: 'tensile',
    title: 'Short hollow column in compression',
    inputs: [
      { key: 'L', value: 4, min: 1, max: 8, step: 0.5 },
      { key: 'D', value: 300, min: 150, max: 500, step: 10 },
      { key: 't', value: 50, min: 20, max: 60, step: 5 },
      { key: 's', value: 75, min: 30, max: 120, step: 5 },
      { key: 'E', value: 150, min: 100, max: 200, step: 10 },
    ],
    statement: (v) => `A hollow cast-iron cylinder ${num(v.L)} m long, ${num(v.D)} mm outside diameter with a ${num(v.t)} mm wall, may carry ${num(v.s)} MPa in compression. With E = ${num(v.E)} GPa, find the load, the strain and the shortening.`,
    answers: [
      { key: 'P', label: 'P', unit: 'kN', expected: 2945 },
      { key: 'e', label: '\\varepsilon', unit: '\\mu\\varepsilon', expected: 500 },
      { key: 'dL', label: '\\delta', unit: 'mm', expected: 2 },
    ],
    solve: (v) => {
      const e = v.s / (v.E * 1e3)
      return { P: (v.s * 1e6 * tubeArea(v.D / 1e3, (v.D - 2 * v.t) / 1e3)) / 1e3, e: e * 1e6, dL: e * v.L * 1e3 }
    },
    working: (_v, r) => [
      { label: 'Load', tex: 'P = \\sigma A = \\sigma\\dfrac{\\pi}{4}(D^2 - d^2)', result: `${n(r.P, 4)}\\ \\text{kN}` },
      { label: 'Strain', tex: '\\varepsilon = \\sigma/E', result: `${n(r.e, 3)}\\ \\mu\\varepsilon` },
      { label: 'Shortening', tex: '\\delta = \\varepsilon L', result: `${n(r.dL, 3)}\\ \\text{mm}` },
    ],
    follow: (v, g) => ('e' in g ? { dL: g.e * 1e-6 * v.L * 1e3 } : {}),
    cite: CVE('direct stress'),
  }),
  parametric({
    id: 'mat-crane-rails',
    course: 'CVE202',
    topic: 'Thermal stress',
    moduleId: 'materials',
    sceneId: 'axial',
    title: 'Crane rails and their gaps',
    inputs: [
      { key: 'L', value: 18, min: 6, max: 30, step: 1 },
      { key: 'gap', value: 3.2, min: 2, max: 8, step: 0.2 },
      { key: 'T0', value: 15, min: 5, max: 25, step: 1 },
    ],
    statement: (v) => `Crane rails ${num(v.L)} m long are laid at ${num(v.T0)} °C with ${num(v.gap)} mm gaps. α = 11.7×10⁻⁶ /°C and E = 207 GPa. Find the temperature at which they touch, the gap at −10 °C, and the stress at 45 °C.`,
    answers: [
      { key: 'touch', label: 'T', unit: '°C', expected: 30.2 },
      { key: 'g', label: '\\text{gap}', unit: 'mm', expected: 8.47 },
      { key: 's', label: '\\sigma', unit: 'MPa', expected: 35.9 },
    ],
    solve: (v) => {
      const r = { alpha: 11.7e-6, L: v.L, gap: v.gap / 1e3, T0: v.T0, E: 207e9 }
      return { touch: railsTouchAt(r), g: railGapAt(r, -10) * 1e3, s: railStressAt(r, 45) / 1e6 }
    },
    valid: (_v, r) => r.touch < 45,
    working: (_v, r) => [
      { label: 'They touch when expansion uses up the gap', tex: '\\alpha L\\,\\Delta T = \\text{gap}', result: `T = ${n(r.touch, 3)}\\ ^\\circ\\text{C}` },
      { label: 'At −10 °C the rails shorten, and the gap opens', tex: '\\text{gap}_2 = \\text{gap} + \\alpha L (T_0 - T)', result: `${n(r.g, 3)}\\ \\text{mm}` },
      { label: 'Beyond touching, expansion is stopped', tex: '\\sigma = E\\alpha (T - T_{\\text{touch}})', result: `${n(r.s, 3)}\\ \\text{MPa}` },
    ],
    params: (v) => ({ mode: 'rails', railL: v.L, gap: v.gap, T0: v.T0, T: 45 }),
    cite: CVE('thermal stress'),
  }),
  parametric({
    id: 'mat-composite-bar',
    course: 'CVE202',
    topic: 'Composite bars',
    moduleId: 'materials',
    sceneId: 'axial',
    title: 'Steel rod inside a brass tube',
    inputs: [
      { key: 'P', value: 300, min: 100, max: 600, step: 10 },
      { key: 'L', value: 254, min: 100, max: 500, step: 2 },
    ],
    statement: (v) => `A 50 mm steel rod (E = 200 GPa) fits inside a brass tube of 50 mm bore and 75 mm outside diameter (E = 97 GPa). Together, ${num(v.L)} mm long, they carry ${num(v.P)} kN. Find the stress in each and the stretch.`,
    answers: [
      { key: 's1', label: '\\sigma_{\\text{steel}}', unit: 'MPa', expected: 95.1 },
      { key: 's2', label: '\\sigma_{\\text{brass}}', unit: 'MPa', expected: 46.1 },
      { key: 'd', label: '\\delta', unit: 'mm', expected: 0.121 },
    ],
    solve: (v) => {
      const c = compositeBar({ A1: circleArea(0.05), E1: 200e9, A2: tubeArea(0.075, 0.05), E2: 97e9 }, v.P * 1e3, v.L / 1e3)
      return { s1: c.s1 / 1e6, s2: c.s2 / 1e6, d: c.delta * 1e3 }
    },
    working: (_v, r) => [
      { label: 'Same strain in both', tex: '\\dfrac{\\sigma_1}{E_1} = \\dfrac{\\sigma_2}{E_2}', result: `\\sigma_1/\\sigma_2 = ${n(200 / 97, 3)}` },
      { label: 'The two share the load', tex: 'P = \\sigma_1 A_1 + \\sigma_2 A_2', result: `\\sigma_1 = ${n(r.s1, 3)},\\ \\sigma_2 = ${n(r.s2, 3)}\\ \\text{MPa}` },
      { label: 'Stretch', tex: '\\delta = \\sigma_1 L / E_1', result: `${n(r.d, 3)}\\ \\text{mm}` },
    ],
    params: (v) => ({ mode: 'composite', P: v.P, L: v.L }),
    cite: CVE('composite bars'),
  }),
  parametric({
    id: 'mat-hollow-shaft',
    course: 'CVE202',
    topic: 'Torsion',
    moduleId: 'materials',
    sceneId: 'torsion',
    title: 'Twist of a hollow shaft',
    inputs: [
      { key: 'T', value: 25, min: 5, max: 50, step: 1 },
      { key: 'L', value: 3, min: 1, max: 6, step: 0.5 },
      { key: 'G', value: 85, min: 40, max: 85, step: 5 },
    ],
    statement: (v) => `A hollow shaft, 146 mm outside and 125 mm inside diameter and ${num(v.L)} m long, carries ${num(v.T)} kN·m. With G = ${num(v.G)} GPa, find the angle of twist and the largest shear stress.`,
    answers: [
      { key: 'th', label: '\\theta', unit: '°', expected: 2.45 },
      { key: 'tau', label: '\\tau', unit: 'MPa', expected: 88.4 },
    ],
    solve: (v) => {
      const J = polarTube(0.146, 0.125)
      return { th: deg(twist(v.T * 1e3, v.L, v.G * 1e9, J)), tau: shaftStress(v.T * 1e3, 0.073, J) / 1e6 }
    },
    working: (_v, r) => [
      { label: 'Polar second moment', tex: 'J = \\dfrac{\\pi}{32}(D^4 - d^4)', result: `${n(polarTube(0.146, 0.125) * 1e6, 3)}\\times 10^{-6}\\ \\text{m}^4` },
      { label: 'Twist', tex: '\\theta = \\dfrac{TL}{GJ}', result: `${n(r.th, 3)}^\\circ` },
      { label: 'Shear stress, at the outside', tex: '\\tau = \\dfrac{T r}{J}', result: `${n(r.tau, 3)}\\ \\text{MPa}` },
    ],
    cite: CVE('torsion'),
  }),
  parametric({
    id: 'mat-shaft-power',
    course: 'CVE202',
    topic: 'Torsion',
    moduleId: 'materials',
    sceneId: 'torsion',
    title: 'Sizing a shaft for power',
    inputs: [
      { key: 'P', value: 80, min: 20, max: 200, step: 5 },
      { key: 'f', value: 3, min: 1, max: 10, step: 0.5 },
      { key: 'tau', value: 70, min: 40, max: 100, step: 5 },
    ],
    statement: (v) => `A solid shaft transmits ${num(v.P)} kW at ${num(v.f)} rev/s. The peak torque is 4 % above the mean, and the shear stress must stay under ${num(v.tau)} MPa. Find the diameter.`,
    answers: [{ key: 'd', label: 'd', unit: 'mm', expected: 68.5 }],
    solve: (v) => ({ d: solidShaftForStress(shaftTorque(v.P * 1e3, v.f) * 1.04, v.tau * 1e6) * 1e3 }),
    working: (v, r) => [
      { label: 'Peak torque', tex: 'T = 1.04\\dfrac{P}{2\\pi f}', result: `${n(shaftTorque(v.P * 1e3, v.f) * 1.04, 4)}\\ \\text{N m}` },
      { label: 'Diameter', tex: 'd = \\left(\\dfrac{16 T}{\\pi\\tau}\\right)^{1/3}', result: `${n(r.d, 3)}\\ \\text{mm}` },
    ],
    cite: CVE('torsion'),
  }),
  parametric({
    id: 'mat-euler-limit',
    course: 'CVE202',
    topic: 'Columns',
    moduleId: 'materials',
    sceneId: 'buckling',
    title: 'Shortest length for Euler’s formula',
    inputs: [
      { key: 'd', value: 50, min: 25, max: 100, step: 5 },
      { key: 'sp', value: 210, min: 150, max: 350, step: 10 },
    ],
    statement: (v) => `A ${num(v.d)} mm steel column is fixed at both ends, with E = 200 GPa and a proportional limit of ${num(v.sp)} MPa. Find the shortest length for which Euler’s formula applies, and the critical load at that length.`,
    answers: [
      { key: 'L', label: 'L', unit: 'm', expected: 2.42 },
      { key: 'P', label: 'P_{cr}', unit: 'kN', expected: 412 },
    ],
    solve: (v) => {
      const d = v.d / 1e3
      const L = 2 * eulerLimitSlenderness(200e9, v.sp * 1e6) * (d / 4)
      return { L, P: eulerLoad(200e9, secondMomentCircle(d), L, 'fixed-fixed') / 1e3 }
    },
    working: (v, r) => [
      { label: 'Limiting slenderness', tex: '\\dfrac{L_e}{k} = \\pi\\sqrt{E/\\sigma_p}', result: `${n(eulerLimitSlenderness(200e9, v.sp * 1e6), 4)}` },
      { label: 'Fixed both ends, and k = d/4', tex: 'L = 2 L_e', result: `${n(r.L, 3)}\\ \\text{m}` },
      { label: 'Critical load', tex: 'P_{cr} = \\dfrac{4\\pi^2 E I}{L^2}', result: `${n(r.P, 4)}\\ \\text{kN}` },
    ],
    cite: CVE('columns'),
  }),
  parametric({
    id: 'mat-beam-third-points',
    course: 'CVE202',
    topic: 'Beams',
    moduleId: 'materials',
    sceneId: 'beam',
    title: 'Two loads on a simple beam',
    inputs: [
      { key: 'A', value: 20, min: 5, max: 60, step: 5 },
      { key: 'B', value: 40, min: 5, max: 80, step: 5 },
    ],
    statement: (v) => `A simply supported beam spans 6 m, with ${num(v.A)} kN at 2 m and ${num(v.B)} kN at 4 m from the left. Find both reactions and the bending moment under each load.`,
    answers: [
      { key: 'Ra', label: 'R_A', unit: 'kN', expected: 26.67 },
      { key: 'Rb', label: 'R_B', unit: 'kN', expected: 33.33 },
      { key: 'M1', label: 'M_{2\\,\\text{m}}', unit: 'kN m', expected: 53.33 },
      { key: 'M2', label: 'M_{4\\,\\text{m}}', unit: 'kN m', expected: 66.67 },
    ],
    solve: (v) => {
      const b: Beam = { L: 6, support: { kind: 'simple', a: 0, b: 6 }, loads: [{ kind: 'point', x: 2, P: v.A * 1e3 }, { kind: 'point', x: 4, P: v.B * 1e3 }] }
      const r = reactions(b)
      return { Ra: r.Ra / 1e3, Rb: r.Rb / 1e3, M1: moment(b, 2) / 1e3, M2: moment(b, 4) / 1e3 }
    },
    working: (v, r) => [
      { label: 'Moments about the left support', tex: '6R_B = 2P_1 + 4P_2', sub: `2(${tnum(v.A)}) + 4(${tnum(v.B)})`, result: `R_B = ${n(r.Rb, 4)}\\ \\text{kN}` },
      { label: 'Vertical balance', tex: 'R_A = P_1 + P_2 - R_B', result: `${n(r.Ra, 4)}\\ \\text{kN}` },
      { label: 'Moments', tex: 'M_2 = 2R_A,\\quad M_4 = 2R_B', result: `${n(r.M1, 4)},\\ ${n(r.M2, 4)}\\ \\text{kN m}` },
    ],
    follow: (_v, g) => ({ ...('Ra' in g ? { M1: 2 * g.Ra } : {}), ...('Rb' in g ? { M2: 2 * g.Rb } : {}) }),
    cite: CVE('shear force and bending moment'),
  }),
]

/** Mechanisms and machine dynamics */
export const MACHINES: Question[] = [
  parametric({
    id: 'mach-porter',
    course: 'MEE306',
    topic: 'Governors',
    moduleId: 'mechanisms',
    sceneId: 'governors',
    title: 'Speed range of a Porter governor',
    inputs: [
      { key: 'm', value: 3, min: 1, max: 6, step: 0.5 },
      { key: 'M', value: 20, min: 5, max: 40, step: 1 },
      { key: 'lift', value: 36, min: 20, max: 50, step: 2 },
    ],
    statement: (v) => `A Porter governor has equal 200 mm arms pivoted 36 mm off the axis, balls of ${num(v.m)} kg and a ${num(v.M)} kg central load. The arms start at 30° to the vertical, and the sleeve lifts ${num(v.lift)} mm. Find the speeds at both ends of the range, and the sensitivity.`,
    answers: [
      { key: 'n1', label: 'N_1', unit: 'rpm', expected: 170.6 },
      { key: 'n2', label: 'N_2', unit: 'rpm', expected: 185.5 },
      { key: 'sens', label: 'S', unit: '', expected: 0.084, tol: 0.02 },
    ],
    solve: (v) => {
      const n1 = radToRpm(porter(v.m, v.M, 0.2, 0.036, rad(30)).w)
      const n2 = radToRpm(porter(v.m, v.M, 0.2, 0.036, porterAlphaAfterLift(0.2, rad(30), v.lift / 1e3)).w)
      return { n1, n2, sens: sensitivity(n1, n2) }
    },
    working: (v, r) => [
      { label: 'Controlling force equals the centrifugal force', tex: '(m + M) g\\tan\\alpha = m\\omega^2 r', result: `N_1 = ${n(r.n1, 4)}\\ \\text{rpm}` },
      { label: 'New angle after the lift', tex: '\\cos\\alpha_2 = \\cos\\alpha_1 - \\dfrac{\\text{lift}}{2l}', result: `\\alpha_2 = ${n(deg(porterAlphaAfterLift(0.2, rad(30), v.lift / 1e3)), 3)}^\\circ` },
      { label: 'Same balance, at the new angle', tex: 'r_2 = c + l\\sin\\alpha_2', result: `N_2 = ${n(r.n2, 4)}\\ \\text{rpm}` },
      { label: 'Sensitivity', tex: 'S = \\dfrac{N_2 - N_1}{\\bar N}', result: `${n(r.sens, 3)}` },
    ],
    follow: (_v, g) => ('n1' in g && 'n2' in g ? { sens: sensitivity(g.n1, g.n2) } : {}),
    params: (v) => ({ kind: 'porter', m: v.m, M: v.M, arm: 200, offset: 36 }),
    cite: MD('Chapter 6 - Governors.pdf', 'Porter governor example'),
  }),
  parametric({
    id: 'mach-hartnell',
    course: 'MEE306',
    topic: 'Governors',
    moduleId: 'mechanisms',
    sceneId: 'governors',
    title: 'Spring for a Hartnell governor',
    inputs: [
      { key: 'm', value: 2.5, min: 1, max: 5, step: 0.5 },
      { key: 'N', value: 300, min: 200, max: 500, step: 10 },
    ],
    statement: (v) => `A Hartnell governor has ${num(v.m)} kg balls, with bell-crank arms of 150 mm (ball) and 90 mm (sleeve). At ${num(v.N)} rpm the balls run at 120 mm radius. An 8 % rise in speed must move the sleeve 12 mm. Find the initial spring load and the stiffness.`,
    answers: [
      { key: 'S1', label: 'S_1', unit: 'N', expected: 987 },
      { key: 'k', label: 'k', unit: 'N/mm', expected: 29.7 },
    ],
    solve: (v) => {
      const h = hartnell(v.m, 0.15, 0.09, 0.12, v.N, 0.08, 0.012)
      return { S1: h.S1, k: h.k / 1000 }
    },
    working: (_v, r) => [
      { label: 'Moments about the bell-crank pivot', tex: 'S_1 = 2 m\\omega^2 r_0\\dfrac{a}{b}', result: `${n(r.S1, 4)}\\ \\text{N}` },
      { label: 'New radius', tex: 'r_2 = r_0 + x\\dfrac{a}{b}', result: '140\\ \\text{mm}' },
      { label: 'Stiffness', tex: 'k = \\dfrac{S_2 - S_1}{x}', result: `${n(r.k, 3)}\\ \\text{N/mm}` },
    ],
    params: (v) => ({ kind: 'hartnell', m: v.m, n0: v.N }),
    cite: MD('Chapter 6 - Governors.pdf', 'Hartnell governor example'),
  }),
  {
    id: 'mach-static-balance',
    course: 'MEE306',
    topic: 'Balancing',
    moduleId: 'mechanisms',
    sceneId: 'balancing',
    title: 'Balancing three masses in one plane',
    statement: 'Masses of 5, 7 and 12 kg rotate in one plane at radii of 30, 45 and 25 mm, at 0°, 52° and 220°. Find the out-of-balance mr, and the mass needed at 40 mm radius to balance it.',
    answers: [
      { key: 'mr', label: 'm_b r_b', unit: 'kg m', expected: 0.1266, tol: 0.02 },
      { key: 'mb', label: 'm_b', unit: 'kg', expected: 3.16, tol: 0.02 },
    ],
    solve: () => {
      const b = staticBalance([{ m: 5, r: 0.03, angle: 0 }, { m: 7, r: 0.045, angle: rad(52) }, { m: 12, r: 0.025, angle: rad(220) }], 0.04)
      return { mr: b.mbrb, mb: b.mb }
    },
    working: (r) => [
      { label: 'Resolve the mr vectors', tex: '\\Sigma H = \\Sigma m r\\cos\\theta,\\quad \\Sigma V = \\Sigma m r\\sin\\theta', result: '' },
      { label: 'Resultant', tex: 'm_b r_b = \\sqrt{\\Sigma H^2 + \\Sigma V^2}', result: `${n(r.mr, 4)}\\ \\text{kg m}` },
      { label: 'Balance mass, opposite the resultant', tex: 'm_b = \\dfrac{m_b r_b}{r_b}', result: `${n(r.mb, 3)}\\ \\text{kg}` },
    ],
    cite: MD('Chapter 3 - Balancing Rotors.pdf', 'Example 1'),
  },
  parametric({
    id: 'mach-flywheel',
    course: 'MEE306',
    topic: 'Flywheels',
    moduleId: 'mechanisms',
    sceneId: 'flywheel',
    title: 'Energy given up by a flywheel',
    inputs: [
      { key: 'm', value: 6500, min: 1000, max: 10000, step: 100 },
      { key: 'k', value: 1.8, min: 0.6, max: 2.4, step: 0.1 },
      { key: 'n1', value: 120, min: 90, max: 300, step: 5 },
      { key: 'n2', value: 118, min: 80, max: 295, step: 1 },
    ],
    statement: (v) => `A ${num(v.m)} kg flywheel with a radius of gyration of ${num(v.k)} m slows from ${num(v.n1)} to ${num(v.n2)} rpm. Find the energy it gives up.`,
    answers: [{ key: 'E', label: '\\Delta E', unit: 'kJ', expected: 54.9 }],
    solve: (v) => ({ E: energyFluctuation(flywheelInertia(v.m, v.k), rpmToRad(v.n1), rpmToRad(v.n2)) / 1e3 }),
    valid: (v) => v.n2 < v.n1,
    working: (v, r) => [
      { label: 'Inertia', tex: 'I = m k^2', result: `${n(flywheelInertia(v.m, v.k), 4)}\\ \\text{kg m}^2` },
      { label: 'Energy', tex: '\\Delta E = \\tfrac{1}{2} I(\\omega_1^2 - \\omega_2^2)', result: `${n(r.E, 3)}\\ \\text{kJ}` },
    ],
    cite: MD('Chapter 5 - Flywheel.pdf', 'practice problem 1'),
  }),
  parametric({
    id: 'mach-equivalent-rod',
    course: 'MEE306',
    topic: 'Dynamic equivalence',
    moduleId: 'mechanisms',
    sceneId: 'reciprocating',
    title: 'Two masses equivalent to a rod',
    inputs: [
      { key: 'm', value: 16, min: 5, max: 40, step: 1 },
      { key: 'I', value: 320000, min: 100000, max: 800000, step: 10000 },
      { key: 'a', value: 200, min: 100, max: 300, step: 10 },
    ],
    statement: (v) => `A rod of ${num(v.m)} kg has I = ${num(v.I)} kg·mm² about its centre of gravity. One equivalent mass is to sit ${num(v.a)} mm from G. Find where the other goes, and both masses.`,
    answers: [
      { key: 'b', label: 'b', unit: 'mm', expected: 100 },
      { key: 'm1', label: 'm_1', unit: 'kg', expected: 5.333 },
      { key: 'm2', label: 'm_2', unit: 'kg', expected: 10.667 },
    ],
    solve: (v) => {
      const e = equivalentMasses(v.m, v.I, v.a)
      return { b: e.b, m1: e.m1, m2: e.m2 }
    },
    working: (_v, r) => [
      { label: 'Same inertia: k² = ab', tex: 'b = \\dfrac{I/m}{a}', result: `${n(r.b, 4)}\\ \\text{mm}` },
      { label: 'Same mass and same centre of gravity', tex: 'm_1 = \\dfrac{m b}{a + b},\\quad m_2 = \\dfrac{m a}{a + b}', result: `${n(r.m1, 4)},\\ ${n(r.m2, 4)}\\ \\text{kg}` },
    ],
    cite: MD('Chapter 2 - Dynamic Equivalence.pdf', 'worked example'),
  }),
]

/** Thermal plant */
export const THERMAL: Question[] = [
  parametric({
    id: 'th-hot-oil',
    course: 'AEE306',
    topic: 'Heat exchangers',
    moduleId: 'thermal',
    sceneId: 'heat-exchanger',
    title: 'Area in parallel and counter flow',
    inputs: [
      { key: 'C', value: 2500, min: 1000, max: 5000, step: 100 },
      { key: 'U', value: 800, min: 300, max: 1200, step: 50 },
    ],
    statement: (v) => `Hot oil of capacity ${num(v.C)} W/K enters a double-pipe exchanger at 360 °C and leaves at 300 °C. A cold fluid enters at 30 °C and leaves at 200 °C. With U = ${num(v.U)} W/m²K, find the area for parallel and for counter flow.`,
    answers: [
      { key: 'par', label: 'A_{\\text{parallel}}', unit: 'm²', expected: 0.971 },
      { key: 'ctr', label: 'A_{\\text{counter}}', unit: 'm²', expected: 0.892 },
    ],
    solve: (v) => {
      const Q = v.C * 60
      return { par: areaFor('parallel', Q, v.U, 360, 300, 30, 200) ?? NaN, ctr: areaFor('counter', Q, v.U, 360, 300, 30, 200) ?? NaN }
    },
    working: (v, r) => [
      { label: 'Duty', tex: 'Q = C(T_{h,i} - T_{h,o})', result: `${n((v.C * 60) / 1000, 4)}\\ \\text{kW}` },
      { label: 'Parallel: ends differ by 330 and 100 K', tex: '\\Delta T_m = \\dfrac{330 - 100}{\\ln(330/100)}', result: `A = ${n(r.par, 3)}\\ \\text{m}^2` },
      { label: 'Counter: ends differ by 160 and 270 K', tex: '\\Delta T_m = \\dfrac{270 - 160}{\\ln(270/160)}', result: `A = ${n(r.ctr, 3)}\\ \\text{m}^2` },
    ],
    params: (v) => ({ Thi: 360, Tci: 30, mh: v.C / 2500, cph: 2.5, mc: (v.C * 60) / 170 / 4180, cpc: 4.18, U: v.U, A: 0.892, want: 200 }),
    cite: HX('question 4'),
  }),
  parametric({
    id: 'th-oil-cooler-flow',
    course: 'AEE306',
    topic: 'Heat exchangers',
    moduleId: 'thermal',
    sceneId: 'heat-exchanger',
    title: 'Cooling water for an oil cooler',
    inputs: [
      { key: 'm', value: 0.17, min: 0.05, max: 0.5, step: 0.01 },
      { key: 'T1', value: 80, min: 60, max: 110, step: 5 },
    ],
    statement: (v) => `Oil (cp = 2.2 kJ/kg K) flows at ${num(v.m)} kg/s through a cooler, from ${num(v.T1)} °C to 30 °C. Cooling water (cp = 4.2 kJ/kg K) warms from 12 to 18 °C. Find the water flow.`,
    answers: [{ key: 'w', label: '\\dot m_w', unit: 'kg/s', expected: 0.742 }],
    solve: (v) => ({ w: (v.m * 2.2 * (v.T1 - 30)) / (4.2 * 6) }),
    working: (v, r) => [{ label: 'Heat lost by the oil is gained by the water', tex: '\\dot m_o c_o \\Delta T_o = \\dot m_w c_w \\Delta T_w', sub: `(${tnum(v.m)})(2.2)(${tnum(v.T1 - 30)}) = \\dot m_w (4.2)(6)`, result: `${n(r.w, 3)}\\ \\text{kg/s}` }],
    cite: HX('question 3'),
  }),
  {
    id: 'th-ammonia-cycle',
    course: 'AEE306',
    topic: 'Refrigeration',
    moduleId: 'thermal',
    sceneId: 'refrigeration',
    title: 'Ammonia plant between 30 °C and −15 °C',
    statement: 'An ideal ammonia cycle works between 30 °C and −15 °C. Compression ends as dry saturated vapour, and liquid leaves the condenser saturated. Using your tables, find the dryness at the compressor inlet, the refrigerating effect, the work and the COP.',
    answers: [
      { key: 'x', label: 'x_1', unit: '', expected: 0.889, tol: 0.02 },
      { key: 'q', label: 'q_e', unit: 'kJ/kg', expected: 957.6 },
      { key: 'w', label: 'w', unit: 'kJ/kg', expected: 188.2 },
      { key: 'cop', label: '\\text{COP}', unit: '', expected: 5.09 },
    ],
    solve: () => {
      const c = refrigeration(AMMONIA, -15, 30, true)
      return { x: c.x1, q: c.effect, w: c.work, cop: c.cop }
    },
    working: (r) => [
      { label: 'Same entropy as state 2', tex: 's_{g,30} = s_{f,-15} + x_1 s_{fg,-15}', result: `x_1 = ${n(r.x, 3)}` },
      { label: 'Effect, with h₄ = h_f at 30 °C', tex: 'q_e = h_1 - h_4', result: `${n(r.q, 4)}\\ \\text{kJ/kg}` },
      { label: 'Work', tex: 'w = h_2 - h_1', result: `${n(r.w, 4)}\\ \\text{kJ/kg}` },
      { label: 'COP', tex: '\\text{COP} = q_e / w', result: `${n(r.cop, 3)}` },
    ],
    follow: (g) => ('q' in g && 'w' in g ? { cop: g.q / g.w } : {}),
    params: { fluid: 'ammonia', Te: -15, Tc: 30, wet: true },
    cite: cite('AEE306', 'refrigeration and air conditioning note.docx', 'worked example 1'),
  },
]
