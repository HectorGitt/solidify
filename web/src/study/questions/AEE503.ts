import { SRC } from '@/content/citations'
import { A503 } from '@/modules/elements/_shared/cites'
import { afbmaStatic, staticEquivalentLoad, stribeckBall } from '@/physics/bearings'
import { beltCapacity, beltMassPerMetre, beltSpeed, beltsRequired, crossedBeltWrap, fennerBeltLength, flatBeltWidth, governingFactor, tensionFactor } from '@/physics/belts'
import { bandTensions, heatGenerated, shoeLeverForce, shoeNormalForce } from '@/physics/brakes'
import { designPower, speedRatio, strandRating, strandsNeeded } from '@/physics/chains'
import { bevelForces, bevelMeanRadius, helicalForces, idlerTrain, pinionConeAngle, spurForces, torqueFromPower } from '@/physics/gearforces'
import { activeCoils, barWeld, bracketWeld, shearStressFactor, wireDiameter } from '@/physics/springs'
import { n } from '@/ui/Working'
import type { Question } from '../types'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const MG2122 = A503.mg21('Q4d')
const MG1920 = A503.mg19('Q3a')

export const AEE503: Question[] = [
  {
    id: '503-stribeck',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static capacity by Stribeck’s equation',
    statement: 'A 208 deep-groove ball bearing has 9 balls of 12 mm diameter. With K = 60.8×10⁶ (N/m²), find the static load capacity by Stribeck’s equation.',
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 15760 }],
    solve: () => ({ C0: stribeckBall(60.8e6, 9, 0.012) }),
    working: (r) => [{ label: 'Stribeck', tex: 'C_0 = \\dfrac{K Z D^2}{5}', sub: '\\dfrac{60.8\\times10^6\\times9\\times(0.012)^2}{5}', result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'Example 1') }],
    cite: SRC.m503(7, 'Example 1'),
    params: { preset: 'stribeck' },
  },
  {
    id: '503-afbma',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static capacity by the AFBMA formula',
    statement: 'For the same bearing (single row, i = 1, 9 balls × 12 mm, α = 0), find C₀ by the AFBMA formula with f₀ = 12.26×10⁶.',
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 15890 }],
    solve: () => ({ C0: afbmaStatic(12.26e6, 1, 9, 0.012, 0) }),
    working: (r) => [{ label: 'AFBMA', tex: 'C_0 = f_0\\,i\\,Z\\,D^2\\cos\\alpha', sub: '12.26\\times10^6\\times1\\times9\\times(0.012)^2', result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'Example 1c') }],
    cite: SRC.m503(7, 'Example 1c'),
    params: { preset: 'afbma' },
  },
  {
    id: '503-double-row',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Double-row bearing capacity',
    statement: 'A double-row ball bearing has 11 balls of 10 mm per row. With K = 60.8×10⁶, find its static capacity by Stribeck’s equation.',
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 26800 }],
    solve: () => ({ C0: stribeckBall(60.8e6, 22, 0.01) }),
    working: (r) => [{ label: 'Stribeck, Z = 2 × 11', tex: 'C_0 = \\dfrac{K Z D^2}{5}', sub: '\\dfrac{60.8\\times10^6\\times22\\times(0.01)^2}{5}', result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'static capacity') }],
    cite: SRC.m503(7, 'MG17 Q6c'),
    params: { preset: 'double' },
  },
  {
    id: '503-p0',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static equivalent load',
    statement: 'A bearing carries a radial load of 13.2 kN and an axial load of 4.4 kN. With X₀ = 0.6 and Y₀ = 0.5, find the static equivalent load.',
    answers: [{ key: 'P0', label: 'P_0', unit: 'kN', expected: 13.2 }],
    solve: () => ({ P0: staticEquivalentLoad(0.6, 0.5, 13.2e3, 4.4e3).P0 / 1000 }),
    working: (r) => [
      { label: 'Combined', tex: 'P_0 = X_0 F_r + Y_0 F_a', sub: '0.6(13.2) + 0.5(4.4)', result: '= 10.12\\ \\text{kN}', cite: SRC.m503(7, 'Example 2') },
      { label: 'Not less than the radial load', tex: 'P_0 = \\max(10.12,\\ F_r)', result: `= ${n(r.P0)}\\ \\text{kN}` },
    ],
    cite: SRC.m503(7, 'Example 2'),
    params: { preset: 'p0' },
  },
  {
    id: '503-crossed-belt',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Crossed leather belt: wrap and width',
    statement:
      'A crossed leather belt (t = 6 mm, density 970 kg/m³, allowable stress 1.7 MPa, f = 0.3) connects pulleys of 250 mm and 500 mm diameter at 1.25 m centres. It transmits 7.5 kW with the small pulley at 1000 rpm. Find the angle of contact, the belt speed and the belt width.',
    answers: [
      { key: 'wrap', label: '\\alpha', unit: '°', expected: 214.9 },
      { key: 'v', label: 'v', unit: 'm/s', expected: 13.1 },
      { key: 'b', label: 'b', unit: 'mm', expected: 92 },
    ],
    solve: () => {
      const a = crossedBeltWrap(0.25, 0.125, 1.25).wrap
      const v = beltSpeed(0.25, 1000)
      return { wrap: deg(a), v, b: flatBeltWidth(7500, v, 1.7e6, 970, tensionFactor(0.3, a), 0.006).b * 1000 }
    },
    working: (r) => [
      { label: 'Wrap (crossed)', tex: '\\alpha = 180^\\circ + 2\\sin^{-1}\\dfrac{R + r}{C}', sub: '180 + 2\\sin^{-1}\\dfrac{0.25 + 0.125}{1.25}', result: `= ${n(r.wrap)}^\\circ`, cite: SRC.m503(4, 'belt wrap') },
      { label: 'Speed', tex: 'v = \\dfrac{\\pi d N}{60}', sub: '\\dfrac{\\pi\\times0.25\\times1000}{60}', result: `= ${n(r.v)}\\ \\text{m/s}` },
      { label: 'Width', tex: '\\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\\alpha},\\quad P = (T_1 - T_2)v,\\quad b = \\dfrac{T_1}{s_1 t}', result: `b = ${n(r.b)}\\ \\text{mm}`, errata: 'The guide rounds e^(fα) to 3.10 (exact 3.08); the width is still ≈ 92 mm.' },
    ],
    cite: SRC.m503(4, 'MG15 Q2c, MG19 Q2c'),
    params: { preset: 'crossed' },
  },
  {
    id: '503-compressor-belt',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Compressor belt: power capacity',
    statement:
      'A 10 mm × 250 mm flat belt (density 970 kg/m³, allowable stress 2 MPa) drives a compressor. The 300 mm motor pulley (wrap 220°, f = 0.3) turns at 900 rpm; the 1500 mm compressor pulley has wrap 270° and f = 0.25. Find the belt speed and the power that can be transmitted.',
    answers: [
      { key: 'v', label: 'v', unit: 'm/s', expected: 14.14 },
      { key: 'P', label: 'P', unit: 'kW', expected: 43.6 },
    ],
    solve: () => {
      const g = governingFactor([{ f: 0.3, alpha: rad(220) }, { f: 0.25, alpha: rad(270) }])
      const v = beltSpeed(0.3, 900)
      return { v, P: beltCapacity(2e6 * 0.01 * 0.25, beltMassPerMetre(0.25, 0.01, 970), v, g.k).P / 1000 }
    },
    working: (r) => [
      { label: 'Governing pulley', tex: 'e^{f\\alpha}:\\ e^{0.3\\times3.84} = 3.16,\\ e^{0.25\\times4.71} = 3.25', result: '\\text{the smaller (motor) pulley governs}', cite: SRC.m503(4, 'governing pulley') },
      { label: 'Tensions', tex: 'T_1 = s\\,b\\,t = 5000\\ \\text{N},\\quad T_c = m v^2', sub: `m = 2.425\\ \\text{kg/m},\\ v = ${n(r.v)}` },
      { label: 'Power', tex: 'P = (T_1 - T_2)v,\\quad \\dfrac{T_1 - T_c}{T_2 - T_c} = 3.16', result: `= ${n(r.P)}\\ \\text{kW}` },
    ],
    cite: SRC.m503(4, 'MG16 Q2b'),
    params: { preset: 'compressor' },
  },
  {
    id: '503-v-belts',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Number of V-belts',
    statement:
      'A 26 kW drive uses V-belts (groove angle 36°, f = 0.2, wrap 140° on the 250 mm sheave turning at 1150 rpm). Each belt has mass 0.523 kg/m and allowable tension 900 N. Find the slack-side tension, the power per belt and the number of belts.',
    answers: [
      { key: 'T2', label: 'T_2', unit: 'N', expected: 279 },
      { key: 'P', label: 'P_{belt}', unit: 'kW', expected: 9.34 },
      { key: 'nb', label: 'n', unit: 'belts', expected: 3, abs: 0 },
    ],
    solve: () => {
      const v = beltSpeed(0.25, 1150)
      const c = beltCapacity(900, 0.523, v, tensionFactor(0.2, rad(140), rad(36)))
      return { T2: c.T2, P: c.P / 1000, nb: beltsRequired(26000, c.P).n }
    },
    working: (r) => [
      { label: 'Tension ratio (V-groove)', tex: '\\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\\alpha/\\sin(\\theta/2)}', sub: 'e^{0.2\\times2.443/\\sin18^\\circ}', result: '= 4.86', cite: SRC.m503(4, 'V-belts') },
      { label: 'Slack side and power', tex: 'T_c = m v^2,\\quad P = (T_1 - T_2) v', result: `T_2 = ${n(r.T2)}\\ \\text{N},\\ P = ${n(r.P)}\\ \\text{kW}`, errata: 'The 2019/20 guide drops the centrifugal term and gets 2.06 belts; correctly it is 2.78 → 3 belts.' },
      { label: 'Belts', tex: 'n = \\left\\lceil \\dfrac{26}{P} \\right\\rceil', result: `= ${n(r.nb)}` },
    ],
    cite: MG1920,
    errata: 'v-belts',
    params: { preset: 'vbelts' },
  },
  {
    id: '503-fenner-fan',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Fan drive: pulley sizes and belt length',
    statement: 'A fan is driven at a speed ratio of 3 by V-belts from a 250 mm pulley; the larger pulley is therefore 750 mm and the centre distance is 1000 mm. Find the pitch length of the belt.',
    answers: [{ key: 'L', label: 'L', unit: 'mm', expected: 3632.5 }],
    solve: () => ({ L: fennerBeltLength(750, 250, 1000) }),
    working: (r) => [{ label: 'Belt length', tex: 'L = 2C + \\tfrac{\\pi}{2}(D + d) + \\dfrac{(D - d)^2}{4C}', sub: '2000 + \\tfrac{\\pi}{2}(1000) + \\dfrac{500^2}{4000}', result: `= ${n(r.L, 5)}\\ \\text{mm}`, cite: SRC.m503(2, 'Example 1') }],
    cite: SRC.m503(2, 'Example 1'),
  },
  {
    id: '503-chain-2kw',
    course: 'AEE503',
    topic: 'Chain drives',
    moduleId: 'elements',
    sceneId: 'chains',
    title: 'Chain selection: 2 kW separator drive',
    statement: 'A 2 kW drive reduces 200 rpm to 60 rpm under moderate shock (service factor 1.3). The chosen chain is rated 2.5 kW simplex; duplex rating is 1.7 × simplex. Find the design power, the speed ratio, the duplex rating and the number of strands.',
    answers: [
      { key: 'P', label: 'P_d', unit: 'kW', expected: 2.6 },
      { key: 'i', label: 'i', unit: '', expected: 3.33 },
      { key: 'dup', label: 'P_{duplex}', unit: 'kW', expected: 4.25 },
      { key: 's', label: '\\text{strands}', unit: '', expected: 2, abs: 0 },
    ],
    solve: () => {
      const P = designPower(2, 1.3)
      return { P, i: speedRatio(200, 60), dup: strandRating(2.5, 2), s: strandsNeeded(P, 2.5) ?? NaN }
    },
    working: (r) => [
      { label: 'Design power', tex: 'P_d = SF\\times P', sub: '1.3\\times2', result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.m503(3, 'example') },
      { label: 'Ratio', tex: 'i = \\dfrac{N_1}{N_2}', sub: '\\dfrac{200}{60}', result: `= ${n(r.i, 3)}` },
      { label: 'Strands', tex: '2.5 < 2.6 \\Rightarrow \\text{duplex: } 1.7\\times2.5', result: `= ${n(r.dup)}\\ \\text{kW} \\ge 2.6` },
    ],
    cite: SRC.m503(3, 'MG17, MG21'),
    params: { preset: 'mg17' },
  },
  {
    id: '503-chain-11kw',
    course: 'AEE503',
    topic: 'Chain drives',
    moduleId: 'elements',
    sceneId: 'chains',
    title: 'Chain selection: 11 kW, 970 → 330 rpm',
    statement: 'An 11 kW drive runs 970 → 330 rpm under moderate shock (SF 1.3). The chain is rated 11.70 kW simplex (duplex 1.7×). Find the design power, ratio and duplex rating.',
    answers: [
      { key: 'P', label: 'P_d', unit: 'kW', expected: 14.3 },
      { key: 'i', label: 'i', unit: '', expected: 2.94 },
      { key: 'dup', label: 'P_{duplex}', unit: 'kW', expected: 19.89 },
    ],
    solve: () => ({ P: designPower(11, 1.3), i: speedRatio(970, 330), dup: strandRating(11.7, 2) }),
    working: (r) => [
      { label: 'Design power', tex: 'P_d = 1.3\\times11', result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.m503(3, 'selection') },
      { label: 'Ratio', tex: 'i = 970/330', result: `= ${n(r.i, 3)}` },
      { label: 'Duplex', tex: '11.70 < 14.3 \\Rightarrow 1.7\\times11.70', result: `= ${n(r.dup)}\\ \\text{kW}` },
    ],
    cite: SRC.m503(3, 'MG19'),
    params: { preset: 'mg19' },
  },
  {
    id: '503-spur-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Spur gear tooth forces',
    statement: 'A 100 mm pitch-diameter spur pinion with 20° pressure angle transmits 200 N·m. Find the tangential and radial tooth forces.',
    answers: [
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 4000 },
      { key: 'Fr', label: 'F_r', unit: 'N', expected: 1456 },
    ],
    solve: () => {
      const f = spurForces(200, 0.05, rad(20))
      return { Ft: f.Ft, Fr: f.Fr }
    },
    working: (r) => [
      { label: 'Tangential', tex: 'F_t = \\dfrac{M_t}{r}', sub: '\\dfrac{200}{0.05}', result: `= ${n(r.Ft)}\\ \\text{N}`, cite: SRC.m503(5, 'Example 1') },
      { label: 'Radial', tex: 'F_r = F_t\\tan\\phi', sub: '4000\\tan20^\\circ', result: `= ${n(r.Fr)}\\ \\text{N}` },
    ],
    cite: SRC.m503(5, 'Example 1'),
    params: { preset: 'spur' },
  },
  {
    id: '503-helical-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Helical gear tooth forces',
    statement: 'A helical gear of 250 mm pitch diameter transmits 200 N·m. The pressure angle is 27° and the helix angle 30°. Find the tangential, radial and axial forces.',
    answers: [
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 1600 },
      { key: 'Fr', label: 'F_r', unit: 'N', expected: 815 },
      { key: 'Fa', label: 'F_a', unit: 'N', expected: 924 },
    ],
    solve: () => {
      const f = helicalForces(200, 0.125, rad(27), rad(30))
      return { Ft: f.Ft, Fr: f.Fr, Fa: f.Fa }
    },
    working: (r) => [
      { label: 'Tangential', tex: 'F_t = M_t/r', sub: '200/0.125', result: `= ${n(r.Ft)}\\ \\text{N}`, cite: SRC.m503(5, 'helical forces') },
      { label: 'Radial and axial', tex: 'F_r = F_t\\tan\\phi,\\quad F_a = F_t\\tan\\alpha', result: `= ${n(r.Fr)},\\ ${n(r.Fa)}\\ \\text{N}`, errata: 'One guide prints F_a = 928 N; 1600 tan 30° = 923.8 N.' },
    ],
    cite: SRC.m503(5, 'MG16 Q3b, MG19 Q3c'),
    params: { preset: 'helical' },
  },
  {
    id: '503-bevel-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Bevel gear forces',
    statement: 'A pair of bevel gears with ratio 4/3 has a 150 mm pinion (pitch) and 50 mm face width; pressure angle 14.5°. The pinion transmits 6 kW at 240 rpm. Find the torque, the mean radius and the tangential, pinion-axial and gear-axial forces.',
    answers: [
      { key: 'Mt', label: 'M_t', unit: 'N·m', expected: 239 },
      { key: 'rm', label: 'r_m', unit: 'mm', expected: 60 },
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 3983 },
      { key: 'Fp', label: 'F_p', unit: 'N', expected: 618 },
      { key: 'Fg', label: 'F_g', unit: 'N', expected: 824 },
    ],
    solve: () => {
      const beta = pinionConeAngle(0.075, 0.1)
      const rm = bevelMeanRadius(0.075, 0.05, beta)
      const Mt = torqueFromPower(6000, 240)
      const f = bevelForces(Mt, rm, rad(14.5), beta)
      return { Mt, rm: rm * 1000, Ft: f.Ft, Fp: f.Fp, Fg: f.Fg }
    },
    working: (r) => [
      { label: 'Torque', tex: 'M_t = \\dfrac{60 P}{2\\pi N}', sub: '\\dfrac{60\\times6000}{2\\pi\\times240}', result: `= ${n(r.Mt)}\\ \\text{N·m}`, cite: SRC.m503(5, 'bevel forces') },
      { label: 'Cone angle and mean radius', tex: '\\tan\\beta = \\dfrac{r_p}{r_g} = \\tfrac{3}{4},\\quad r_m = r_p - \\tfrac{b}{2}\\sin\\beta', sub: '75 - 25\\times0.6', result: `= ${n(r.rm)}\\ \\text{mm}` },
      { label: 'Forces', tex: 'F_t = \\dfrac{M_t}{r_m},\\ F_p = F_t\\tan\\phi\\sin\\beta,\\ F_g = F_t\\tan\\phi\\cos\\beta', result: `= ${n(r.Ft)},\\ ${n(r.Fp)},\\ ${n(r.Fg)}\\ \\text{N}` },
    ],
    cite: SRC.m503(5, 'MG15 Q3c'),
    params: { preset: 'bevel' },
  },
  {
    id: '503-idler-train',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Idler gear train',
    statement: 'Gear A (35 teeth) drives gear C (45 teeth) through an idler B (65 teeth), module 6 mm. A receives 3 kW at 600 rpm. Find the torque on A, the speed of C and the torque on C (no losses).',
    answers: [
      { key: 'TA', label: 'T_A', unit: 'N·m', expected: 47.8 },
      { key: 'NC', label: 'N_C', unit: 'rpm', expected: 466.7 },
      { key: 'TC', label: 'T_C', unit: 'N·m', expected: 61.4 },
    ],
    solve: () => {
      const t = idlerTrain(3000, 600, 35, 65, 45)
      return { TA: t.TA, NC: t.rpmC, TC: t.TC }
    },
    working: (r) => [
      { label: 'Input torque', tex: 'T_A = \\dfrac{60P}{2\\pi N_A}', sub: '\\dfrac{60\\times3000}{2\\pi\\times600}', result: `= ${n(r.TA)}\\ \\text{N·m}`, cite: SRC.m503(5, 'gear trains') },
      { label: 'The idler cancels', tex: 'N_C = N_A\\dfrac{z_A}{z_C}', sub: '600\\times\\dfrac{35}{45}', result: `= ${n(r.NC)}\\ \\text{rpm}` },
      { label: 'Output torque', tex: 'T_C = T_A\\dfrac{z_C}{z_A}', result: `= ${n(r.TC)}\\ \\text{N·m}` },
    ],
    cite: SRC.m503(5, 'MG17, MG21 Q2c'),
    params: { preset: 'idler' },
  },
  {
    id: '503-bar-weld',
    course: 'AEE503',
    topic: 'Welded joints',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Fillet weld round a 50 mm bar',
    statement: 'A 50 mm diameter bar is fillet-welded all round to a plate and carries 10 kN at 200 mm from the weld. With the standard allowable weld stress, find the weld section modulus, the resultant force per unit length and the leg size.',
    answers: [
      { key: 'Zw', label: 'Z_w', unit: '×10⁻³ m²', expected: 1.964 },
      { key: 'f', label: 'f', unit: 'MN/m', expected: 1.02 },
      { key: 'w', label: 'w', unit: 'mm', expected: 15.4 },
    ],
    solve: () => {
      const r = barWeld(10e3, 0.2, 0.05)
      return { Zw: r.Zw * 1e3, f: r.f / 1e6, w: r.w * 1000 }
    },
    working: (r) => [
      { label: 'Weld as a line', tex: 'Z_w = \\dfrac{\\pi d^2}{4}', sub: '\\dfrac{\\pi(0.05)^2}{4}', result: `= ${n(r.Zw)}\\times10^{-3}\\ \\text{m}^2`, cite: SRC.m503(11, 'weld as a line') },
      { label: 'Force per unit length', tex: 'f_b = \\dfrac{M}{Z_w},\\ f_s = \\dfrac{V}{\\pi d},\\ f = \\sqrt{f_b^2 + f_s^2}', result: `= ${n(r.f)}\\ \\text{MN/m}` },
      { label: 'Leg size', tex: 'w = \\dfrac{f}{0.707\\,s}', result: `= ${n(r.w)}\\ \\text{mm}` },
    ],
    cite: SRC.m503(11, 'MG15 Q6c, MG17, MG19, MG21'),
    params: { preset: 'bar' },
  },
  {
    id: '503-bracket-weld',
    course: 'AEE503',
    topic: 'Welded joints',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Eccentrically loaded bracket weld',
    statement: 'A bracket carries 35 kN at 570 mm eccentricity. It is welded along a C-shaped line: two 120 mm horizontal welds and one 240 mm vertical weld. Find the polar modulus of the weld line, the resultant force per unit length and the leg size.',
    answers: [
      { key: 'Jw', label: 'J_w', unit: '×10⁻³ m³', expected: 5.328 },
      { key: 'f', label: 'f', unit: 'MN/m', expected: 0.609 },
      { key: 'w', label: 'w', unit: 'mm', expected: 9.2 },
    ],
    solve: () => {
      const r = bracketWeld(35e3, 0.57, 0.12, 0.24)
      return { Jw: r.Jw * 1e3, f: r.f / 1e6, w: r.w * 1000 }
    },
    working: (r) => [
      { label: 'Polar modulus of the weld line', tex: 'J_w = \\dfrac{(2b + d)^3}{12} - \\dfrac{b^2(b + d)^2}{2b + d}', result: `= ${n(r.Jw)}\\times10^{-3}\\ \\text{m}^3`, cite: SRC.m503(11, 'Example 1') },
      { label: 'Resultant', tex: 'f = \\sqrt{f_h^2 + (f_{v0} + f_{vT})^2}', result: `= ${n(r.f)}\\ \\text{MN/m}` },
      { label: 'Leg size', tex: 'w = \\dfrac{f}{0.707\\,s}', result: `= ${n(r.w)}\\ \\text{mm}` },
    ],
    cite: SRC.m503(11, 'Example 1'),
    params: { preset: 'bracket' },
  },
  {
    id: '503-helical-spring',
    course: 'AEE503',
    topic: 'Springs',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Design a helical compression spring',
    statement: 'A helical spring must deflect 25 mm under 500 N. Spring index C = 8, allowable shear stress 350 MPa, G = 84 GPa. Using Ks = 1 + 0.5/C, find the wire diameter, then (with d rounded to 6 mm) the mean coil diameter and the number of active coils.',
    answers: [
      { key: 'd', label: 'd', unit: 'mm', expected: 5.56 },
      { key: 'D', label: 'D', unit: 'mm', expected: 48 },
      { key: 'n', label: 'n', unit: 'coils', expected: 6.15 },
    ],
    solve: () => {
      const d = wireDiameter(500, 8, 350e6, shearStressFactor(8))
      return { d: d * 1000, D: 8 * 6, n: activeCoils(0.025, 500, 8, 0.006, 84e9) }
    },
    working: (r) => [
      { label: 'Wire diameter', tex: '\\tau = K_s\\dfrac{8 F C}{\\pi d^2} \\Rightarrow d = \\sqrt{\\dfrac{8 K_s F C}{\\pi\\tau}}', sub: '\\sqrt{\\dfrac{8\\times1.0625\\times500\\times8}{\\pi\\times350\\times10^6}}', result: `= ${n(r.d)}\\ \\text{mm} \\to 6\\ \\text{mm}`, cite: SRC.m503(10, 'helical springs') },
      { label: 'Coil diameter', tex: 'D = C d', sub: '8\\times6', result: `= ${n(r.D)}\\ \\text{mm}` },
      { label: 'Active coils', tex: 'y = \\dfrac{8 F C^3 n}{G d} \\Rightarrow n = \\dfrac{y G d}{8 F C^3}', result: `= ${n(r.n)}` },
    ],
    cite: MG2122,
    params: { preset: 'mg21' },
  },
  {
    id: '503-shoe-brake',
    course: 'AEE503',
    topic: 'Brakes',
    moduleId: 'elements',
    sceneId: 'clutch-brake',
    title: 'Single-shoe brake',
    statement:
      'A single-shoe brake on a 360 mm radius drum must absorb 225 N·m with f = 0.3. The shoe is at a = 360 mm from the lever pivot, the hand force acts at b = 900 mm and the line of friction is offset c = 40 mm. Find the normal force, the lever force for clockwise rotation (friction aiding), and the heat generated at 500 rpm.',
    answers: [
      { key: 'N', label: 'N', unit: 'N', expected: 2083 },
      { key: 'F', label: 'F', unit: 'N', expected: 805 },
      { key: 'H', label: 'H_g', unit: 'kW', expected: 11.8 },
    ],
    solve: () => {
      const N = shoeNormalForce(225, 0.3, 0.36)
      return { N, F: shoeLeverForce(N, 0.3, 0.36, 0.9, 0.04, 'aiding'), H: heatGenerated(0.3, N, (2 * Math.PI * 500 * 0.36) / 60) / 1000 }
    },
    working: (r) => [
      { label: 'Normal force', tex: 'N = \\dfrac{T}{f R}', sub: '\\dfrac{225}{0.3\\times0.36}', result: `= ${n(r.N)}\\ \\text{N}`, cite: SRC.m503(9, 'Example 1') },
      { label: 'Lever force (moments about the pivot)', tex: 'F b = N a - f N c', result: `F = ${n(r.F)}\\ \\text{N}` },
      { label: 'Heat', tex: 'H_g = f N V', sub: '0.3\\times2083\\times18.85', result: `= ${n(r.H)}\\ \\text{kW}` },
    ],
    cite: SRC.m503(9, 'Example 1'),
    params: { preset: 'shoe' },
  },
  {
    id: '503-band-brake',
    course: 'AEE503',
    topic: 'Brakes',
    moduleId: 'elements',
    sceneId: 'clutch-brake',
    title: 'Band brake tensions',
    statement: 'A band brake wraps 280° round a 450 mm drum and must hold 170 N·m with f = 0.2. Find the tight- and slack-side tensions.',
    answers: [
      { key: 'F1', label: 'F_1', unit: 'N', expected: 1210 },
      { key: 'F2', label: 'F_2', unit: 'N', expected: 455 },
    ],
    solve: () => {
      const r = bandTensions(170, 0.225, 0.2, rad(280))
      return { F1: r.F1, F2: r.F2 }
    },
    working: (r) => [
      { label: 'Tension ratio', tex: '\\dfrac{F_1}{F_2} = e^{f\\alpha}', sub: 'e^{0.2\\times4.887}', result: '= 2.66', cite: SRC.m503(9, 'Example 2') },
      { label: 'Torque', tex: 'T = (F_1 - F_2) r', result: `F_1 = ${n(r.F1)},\\ F_2 = ${n(r.F2)}\\ \\text{N}` },
    ],
    cite: SRC.m503(9, 'Example 2'),
    params: { preset: 'band' },
  },
]

