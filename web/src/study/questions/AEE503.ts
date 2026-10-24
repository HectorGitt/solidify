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
import { num, parametric, tnum } from '../variants'

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const MG2122 = A503.mg21('Q4d')
const MG1920 = A503.mg19('Q3a')

/** Wire diameter rounded up to the next whole millimetre (the past paper rounds 5.56 → 6 mm). */
const roundedWire = (dmm: number) => Math.ceil(dmm - 1e-9)

const springWire = (v: Record<string, number>) => wireDiameter(v.F, v.C, v.tau * 1e6, shearStressFactor(v.C)) * 1000

export const AEE503: Question[] = [
  parametric({
    id: '503-stribeck',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static capacity by Stribeck’s equation',
    inputs: [
      { key: 'Z', value: 9, min: 7, max: 16, step: 1 },
      { key: 'D', value: 12, min: 6, max: 20, step: 1 },
      { key: 'K', value: 60.8, min: 50, max: 70, step: 0.1 },
    ],
    statement: (v) => `A deep-groove ball bearing has ${num(v.Z)} balls of ${num(v.D)} mm diameter. With K = ${num(v.K)}×10⁶ (N/m²), find the static load capacity by Stribeck’s equation.`,
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 15760 }],
    solve: (v) => ({ C0: stribeckBall(v.K * 1e6, v.Z, v.D / 1000) }),
    working: (v, r) => [{ label: 'Stribeck', tex: 'C_0 = \\dfrac{K Z D^2}{5}', sub: `\\dfrac{${tnum(v.K)}\\times10^6\\times${tnum(v.Z)}\\times(${tnum(v.D / 1000)})^2}{5}`, result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'Example 1') }],
    cite: SRC.m503(7, 'Example 1'),
    params: () => ({ preset: 'stribeck' }),
  }),
  parametric({
    id: '503-afbma',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static capacity by the AFBMA formula',
    // i = 1 and α = 0 define the bearing type (single-row radial), so they stay fixed
    inputs: [
      { key: 'i', value: 1, min: 1, max: 1, step: 1 },
      { key: 'Z', value: 9, min: 7, max: 16, step: 1 },
      { key: 'D', value: 12, min: 6, max: 20, step: 1 },
      { key: 'alpha', value: 0, min: 0, max: 0, step: 1 },
      { key: 'f0', value: 12.26, min: 10, max: 14, step: 0.01 },
    ],
    statement: (v) => `A single-row ball bearing (i = ${num(v.i)}, ${num(v.Z)} balls × ${num(v.D)} mm, α = ${num(v.alpha)}): find C₀ by the AFBMA formula with f₀ = ${num(v.f0)}×10⁶.`,
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 15890 }],
    solve: (v) => ({ C0: afbmaStatic(v.f0 * 1e6, v.i, v.Z, v.D / 1000, rad(v.alpha)) }),
    working: (v, r) => [{ label: 'AFBMA', tex: 'C_0 = f_0\\,i\\,Z\\,D^2\\cos\\alpha', sub: `${tnum(v.f0)}\\times10^6\\times${tnum(v.i)}\\times${tnum(v.Z)}\\times(${tnum(v.D / 1000)})^2`, result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'Example 1c') }],
    cite: SRC.m503(7, 'Example 1c'),
    params: () => ({ preset: 'afbma' }),
  }),
  parametric({
    id: '503-double-row',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Double-row bearing capacity',
    inputs: [
      { key: 'Z', value: 11, min: 7, max: 16, step: 1 },
      { key: 'D', value: 10, min: 6, max: 20, step: 1 },
      { key: 'K', value: 60.8, min: 50, max: 70, step: 0.1 },
    ],
    statement: (v) => `A double-row ball bearing has ${num(v.Z)} balls of ${num(v.D)} mm per row. With K = ${num(v.K)}×10⁶, find its static capacity by Stribeck’s equation.`,
    answers: [{ key: 'C0', label: 'C_0', unit: 'N', expected: 26800 }],
    solve: (v) => ({ C0: stribeckBall(v.K * 1e6, 2 * v.Z, v.D / 1000) }),
    working: (v, r) => [{ label: `Stribeck, Z = 2 × ${num(v.Z)}`, tex: 'C_0 = \\dfrac{K Z D^2}{5}', sub: `\\dfrac{${tnum(v.K)}\\times10^6\\times${tnum(2 * v.Z)}\\times(${tnum(v.D / 1000)})^2}{5}`, result: `= ${n(r.C0, 5)}\\ \\text{N}`, cite: SRC.m503(7, 'static capacity') }],
    cite: SRC.m503(7, 'MG17 Q6c'),
    params: () => ({ preset: 'double' }),
  }),
  parametric({
    id: '503-p0',
    course: 'AEE503',
    topic: 'Bearings',
    moduleId: 'elements',
    sceneId: 'bearings',
    title: 'Static equivalent load',
    // X₀ and Y₀ are table factors for the bearing type, so they stay fixed
    inputs: [
      { key: 'Fr', value: 13.2, min: 2, max: 30, step: 0.2 },
      { key: 'Fa', value: 4.4, min: 0.5, max: 20, step: 0.1 },
      { key: 'X0', value: 0.6, min: 0.6, max: 0.6, step: 0.1 },
      { key: 'Y0', value: 0.5, min: 0.5, max: 0.5, step: 0.1 },
    ],
    statement: (v) => `A bearing carries a radial load of ${num(v.Fr)} kN and an axial load of ${num(v.Fa)} kN. With X₀ = ${num(v.X0)} and Y₀ = ${num(v.Y0)}, find the static equivalent load.`,
    answers: [{ key: 'P0', label: 'P_0', unit: 'kN', expected: 13.2 }],
    solve: (v) => ({ P0: staticEquivalentLoad(v.X0, v.Y0, v.Fr * 1e3, v.Fa * 1e3).P0 / 1000 }),
    // a radial bearing: the axial load stays below the radial load
    valid: (v) => v.Fa < v.Fr,
    working: (v, r) => {
      const raw = staticEquivalentLoad(v.X0, v.Y0, v.Fr, v.Fa).raw
      return [
        { label: 'Combined', tex: 'P_0 = X_0 F_r + Y_0 F_a', sub: `${tnum(v.X0)}(${tnum(v.Fr)}) + ${tnum(v.Y0)}(${tnum(v.Fa)})`, result: `= ${n(raw)}\\ \\text{kN}`, cite: SRC.m503(7, 'Example 2') },
        { label: 'Not less than the radial load', tex: `P_0 = \\max(${n(raw)},\\ F_r)`, result: `= ${n(r.P0)}\\ \\text{kN}` },
      ]
    },
    cite: SRC.m503(7, 'Example 2'),
    params: () => ({ preset: 'p0' }),
  }),
  parametric({
    id: '503-crossed-belt',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Crossed leather belt: wrap and width',
    inputs: [
      { key: 't', value: 6, min: 5, max: 10, step: 1 },
      { key: 'rho', value: 970, min: 950, max: 1000, step: 10 },
      { key: 's', value: 1.7, min: 1.5, max: 2.5, step: 0.1 },
      { key: 'f', value: 0.3, min: 0.25, max: 0.4, step: 0.05 },
      { key: 'd', value: 250, min: 150, max: 400, step: 25 },
      { key: 'D', value: 500, min: 300, max: 900, step: 50 },
      { key: 'C', value: 1.25, min: 1, max: 3, step: 0.05 },
      { key: 'P', value: 7.5, min: 3, max: 20, step: 0.5 },
      { key: 'N', value: 1000, min: 500, max: 1500, step: 50 },
    ],
    statement: (v) =>
      `A crossed leather belt (t = ${num(v.t)} mm, density ${num(v.rho)} kg/m³, allowable stress ${num(v.s)} MPa, f = ${num(v.f)}) connects pulleys of ${num(v.d)} mm and ${num(v.D)} mm diameter at ${num(v.C)} m centres. It transmits ${num(v.P)} kW with the small pulley at ${num(v.N)} rpm. Find the angle of contact, the belt speed and the belt width.`,
    answers: [
      { key: 'wrap', label: '\\alpha', unit: '°', expected: 214.9 },
      { key: 'v', label: 'v', unit: 'm/s', expected: 13.1 },
      { key: 'b', label: 'b', unit: 'mm', expected: 92 },
    ],
    solve: (v) => {
      const a = crossedBeltWrap(v.D / 2000, v.d / 2000, v.C).wrap
      const sp = beltSpeed(v.d / 1000, v.N)
      return { wrap: deg(a), v: sp, b: flatBeltWidth(v.P * 1000, sp, v.s * 1e6, v.rho, tensionFactor(v.f, a), v.t / 1000).b * 1000 }
    },
    // driven pulley larger; centres well clear of the pulleys; belt speed ≤ 30 m/s; a sensible width
    valid: (v, r) => v.D >= 1.25 * v.d && (v.D + v.d) / 2000 <= 0.5 * v.C && r.v <= 30 && r.b > 20 && r.b < 400,
    working: (v, r, original) => [
      { label: 'Wrap (crossed)', tex: '\\alpha = 180^\\circ + 2\\sin^{-1}\\dfrac{R + r}{C}', sub: `180 + 2\\sin^{-1}\\dfrac{${tnum(v.D / 2000)} + ${tnum(v.d / 2000)}}{${tnum(v.C)}}`, result: `= ${n(r.wrap)}^\\circ`, cite: SRC.m503(4, 'belt wrap') },
      { label: 'Speed', tex: 'v = \\dfrac{\\pi d N}{60}', sub: `\\dfrac{\\pi\\times${tnum(v.d / 1000)}\\times${tnum(v.N)}}{60}`, result: `= ${n(r.v)}\\ \\text{m/s}` },
      { label: 'Width', tex: '\\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\\alpha},\\quad P = (T_1 - T_2)v,\\quad b = \\dfrac{T_1}{s_1 t}', result: `b = ${n(r.b)}\\ \\text{mm}`, ...(original ? { errata: 'The guide rounds e^(fα) to 3.10 (exact 3.08); the width is still ≈ 92 mm.' } : {}) },
    ],
    cite: SRC.m503(4, 'MG15 Q2c, MG19 Q2c'),
    params: () => ({ preset: 'crossed' }),
  }),
  parametric({
    id: '503-compressor-belt',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Compressor belt: power capacity',
    inputs: [
      { key: 't', value: 10, min: 6, max: 12, step: 1 },
      { key: 'b', value: 250, min: 100, max: 300, step: 10 },
      { key: 'rho', value: 970, min: 950, max: 1000, step: 10 },
      { key: 's', value: 2, min: 1.5, max: 2.5, step: 0.1 },
      { key: 'd', value: 300, min: 200, max: 400, step: 25 },
      { key: 'a1', value: 220, min: 180, max: 240, step: 5 },
      { key: 'f1', value: 0.3, min: 0.25, max: 0.35, step: 0.05 },
      { key: 'N', value: 900, min: 600, max: 1200, step: 50 },
      { key: 'D', value: 1500, min: 900, max: 2000, step: 50 },
      { key: 'a2', value: 270, min: 200, max: 300, step: 5 },
      { key: 'f2', value: 0.25, min: 0.2, max: 0.3, step: 0.05 },
    ],
    statement: (v) =>
      `A ${num(v.t)} mm × ${num(v.b)} mm flat belt (density ${num(v.rho)} kg/m³, allowable stress ${num(v.s)} MPa) drives a compressor. The ${num(v.d)} mm motor pulley (wrap ${num(v.a1)}°, f = ${num(v.f1)}) turns at ${num(v.N)} rpm; the ${num(v.D)} mm compressor pulley has wrap ${num(v.a2)}° and f = ${num(v.f2)}. Find the belt speed and the power that can be transmitted.`,
    answers: [
      { key: 'v', label: 'v', unit: 'm/s', expected: 14.14 },
      { key: 'P', label: 'P', unit: 'kW', expected: 43.6 },
    ],
    solve: (v) => {
      const g = governingFactor([{ f: v.f1, alpha: rad(v.a1) }, { f: v.f2, alpha: rad(v.a2) }])
      const sp = beltSpeed(v.d / 1000, v.N)
      return { v: sp, P: beltCapacity(v.s * 1e6 * (v.t / 1000) * (v.b / 1000), beltMassPerMetre(v.b / 1000, v.t / 1000, v.rho), sp, g.k).P / 1000 }
    },
    // compressor pulley clearly larger; centrifugal tension below a third of T₁ (below the max-power speed)
    valid: (v, r) => {
      const T1 = v.s * 1e6 * (v.t / 1000) * (v.b / 1000)
      const m = beltMassPerMetre(v.b / 1000, v.t / 1000, v.rho)
      return v.D >= 3 * v.d && m * r.v ** 2 < T1 / 3 && r.P > 0
    },
    working: (v, r) => {
      const g = governingFactor([{ f: v.f1, alpha: rad(v.a1) }, { f: v.f2, alpha: rad(v.a2) }])
      const T1 = v.s * 1e6 * (v.t / 1000) * (v.b / 1000)
      const m = beltMassPerMetre(v.b / 1000, v.t / 1000, v.rho)
      return [
        {
          label: 'Governing pulley',
          tex: `e^{f\\alpha}:\\ e^{${tnum(v.f1)}\\times${n(rad(v.a1), 3)}} = ${n(g.all[0], 3)},\\ e^{${tnum(v.f2)}\\times${n(rad(v.a2), 3)}} = ${n(g.all[1], 3)}`,
          result: g.index === 0 ? '\\text{the smaller (motor) pulley governs}' : '\\text{the compressor pulley governs}',
          cite: SRC.m503(4, 'governing pulley'),
        },
        { label: 'Tensions', tex: `T_1 = s\\,b\\,t = ${n(T1)}\\ \\text{N},\\quad T_c = m v^2`, sub: `m = ${n(m)}\\ \\text{kg/m},\\ v = ${n(r.v)}` },
        { label: 'Power', tex: `P = (T_1 - T_2)v,\\quad \\dfrac{T_1 - T_c}{T_2 - T_c} = ${n(g.k, 3)}`, result: `= ${n(r.P)}\\ \\text{kW}` },
      ]
    },
    cite: SRC.m503(4, 'MG16 Q2b'),
    params: () => ({ preset: 'compressor' }),
  }),
  parametric({
    id: '503-v-belts',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Number of V-belts',
    inputs: [
      { key: 'P', value: 26, min: 10, max: 60, step: 1 },
      { key: 'th', value: 36, min: 34, max: 40, step: 2 },
      { key: 'f', value: 0.2, min: 0.15, max: 0.3, step: 0.05 },
      { key: 'wrap', value: 140, min: 120, max: 180, step: 5 },
      { key: 'd', value: 250, min: 150, max: 350, step: 10 },
      { key: 'N', value: 1150, min: 700, max: 1500, step: 50 },
      { key: 'm', value: 0.523, min: 0.3, max: 0.6, step: 0.001 },
      { key: 'T', value: 900, min: 500, max: 1200, step: 50 },
    ],
    statement: (v) =>
      `A ${num(v.P)} kW drive uses V-belts (groove angle ${num(v.th)}°, f = ${num(v.f)}, wrap ${num(v.wrap)}° on the ${num(v.d)} mm sheave turning at ${num(v.N)} rpm). Each belt has mass ${num(v.m)} kg/m and allowable tension ${num(v.T)} N. Find the slack-side tension, the power per belt and the number of belts.`,
    answers: [
      { key: 'T2', label: 'T_2', unit: 'N', expected: 279 },
      { key: 'P', label: 'P_{belt}', unit: 'kW', expected: 9.34 },
      { key: 'nb', label: 'n', unit: 'belts', expected: 3, abs: 0 },
    ],
    solve: (v) => {
      const sp = beltSpeed(v.d / 1000, v.N)
      const c = beltCapacity(v.T, v.m, sp, tensionFactor(v.f, rad(v.wrap), rad(v.th)))
      return { T2: c.T2, P: c.P / 1000, nb: beltsRequired(v.P * 1000, c.P).n }
    },
    // centrifugal tension below a third of the allowable (below the max-power speed); 2–8 belts
    valid: (v, r) => v.m * beltSpeed(v.d / 1000, v.N) ** 2 < v.T / 3 && r.P > 0 && r.nb >= 2 && r.nb <= 8,
    working: (v, r, original) => {
      const k = tensionFactor(v.f, rad(v.wrap), rad(v.th))
      return [
        { label: 'Tension ratio (V-groove)', tex: '\\dfrac{T_1 - T_c}{T_2 - T_c} = e^{f\\alpha/\\sin(\\theta/2)}', sub: `e^{${tnum(v.f)}\\times${n(rad(v.wrap))}/\\sin${tnum(v.th / 2)}^\\circ}`, result: `= ${n(k, 3)}`, cite: SRC.m503(4, 'V-belts') },
        { label: 'Slack side and power', tex: 'T_c = m v^2,\\quad P = (T_1 - T_2) v', result: `T_2 = ${n(r.T2)}\\ \\text{N},\\ P = ${n(r.P)}\\ \\text{kW}`, ...(original ? { errata: 'The 2019/20 guide drops the centrifugal term and gets 2.06 belts; correctly it is 2.78 → 3 belts.' } : {}) },
        { label: 'Belts', tex: `n = \\left\\lceil \\dfrac{${tnum(v.P)}}{P} \\right\\rceil`, result: `= ${n(r.nb)}` },
      ]
    },
    cite: MG1920,
    errata: 'v-belts',
    params: () => ({ preset: 'vbelts' }),
  }),
  parametric({
    id: '503-fenner-fan',
    course: 'AEE503',
    topic: 'Belt drives',
    moduleId: 'elements',
    sceneId: 'belts',
    title: 'Fan drive: pulley sizes and belt length',
    inputs: [
      { key: 'i', value: 3, min: 1.5, max: 4, step: 0.5 },
      { key: 'd', value: 250, min: 100, max: 400, step: 25 },
      { key: 'C', value: 1000, min: 500, max: 2500, step: 50 },
    ],
    statement: (v) => `A fan is driven at a speed ratio of ${num(v.i)} by V-belts from a ${num(v.d)} mm pulley; the larger pulley is therefore ${num(v.i * v.d)} mm and the centre distance is ${num(v.C)} mm. Find the pitch length of the belt.`,
    answers: [{ key: 'L', label: 'L', unit: 'mm', expected: 3632.5 }],
    solve: (v) => ({ L: fennerBeltLength(v.i * v.d, v.d, v.C) }),
    // pulleys must clear each other, and the centres not be absurdly long
    valid: (v) => v.C >= (v.i * v.d + v.d) / 2 + v.d && v.C <= 2 * (v.i * v.d + v.d),
    working: (v, r) => {
      const D = v.i * v.d
      return [{ label: 'Belt length', tex: 'L = 2C + \\tfrac{\\pi}{2}(D + d) + \\dfrac{(D - d)^2}{4C}', sub: `${tnum(2 * v.C)} + \\tfrac{\\pi}{2}(${tnum(D + v.d)}) + \\dfrac{${tnum(D - v.d)}^2}{${tnum(4 * v.C)}}`, result: `= ${n(r.L, 5)}\\ \\text{mm}`, cite: SRC.m503(2, 'Example 1') }]
    },
    cite: SRC.m503(2, 'Example 1'),
  }),
  parametric({
    id: '503-chain-2kw',
    course: 'AEE503',
    topic: 'Chain drives',
    moduleId: 'elements',
    sceneId: 'chains',
    title: 'Chain selection: separator drive',
    // the duplex factor 1.7 is the catalogue value built into strandRating, so it stays fixed
    inputs: [
      { key: 'P', value: 2, min: 1, max: 6, step: 0.5 },
      { key: 'N1', value: 200, min: 100, max: 400, step: 10 },
      { key: 'N2', value: 60, min: 30, max: 150, step: 5 },
      { key: 'SF', value: 1.3, min: 1, max: 1.5, step: 0.1 },
      { key: 'Ps', value: 2.5, min: 1, max: 8, step: 0.1 },
      { key: 'k', value: 1.7, min: 1.7, max: 1.7, step: 0.1 },
    ],
    statement: (v) =>
      `A ${num(v.P)} kW drive reduces ${num(v.N1)} rpm to ${num(v.N2)} rpm under moderate shock (service factor ${num(v.SF)}). The chosen chain is rated ${num(v.Ps)} kW simplex; duplex rating is ${num(v.k)} × simplex. Find the design power, the speed ratio, the duplex rating and the number of strands.`,
    answers: [
      { key: 'P', label: 'P_d', unit: 'kW', expected: 2.6 },
      { key: 'i', label: 'i', unit: '', expected: 3.33 },
      { key: 'dup', label: 'P_{duplex}', unit: 'kW', expected: 4.25 },
      { key: 's', label: '\\text{strands}', unit: '', expected: 2, abs: 0 },
    ],
    solve: (v) => {
      const P = designPower(v.P, v.SF)
      return { P, i: speedRatio(v.N1, v.N2), dup: strandRating(v.Ps, 2), s: strandsNeeded(P, v.Ps) ?? NaN }
    },
    // simplex too weak but duplex enough (the point of the question); a chain-drive ratio of 1.5–6
    valid: (_v, r) => r.s === 2 && r.i >= 1.5 && r.i <= 6,
    working: (v, r) => [
      { label: 'Design power', tex: 'P_d = SF\\times P', sub: `${tnum(v.SF)}\\times${tnum(v.P)}`, result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.m503(3, 'example') },
      { label: 'Ratio', tex: 'i = \\dfrac{N_1}{N_2}', sub: `\\dfrac{${tnum(v.N1)}}{${tnum(v.N2)}}`, result: `= ${n(r.i, 3)}` },
      { label: 'Strands', tex: `${tnum(v.Ps)} < ${n(r.P)} \\Rightarrow \\text{duplex: } ${tnum(v.k)}\\times${tnum(v.Ps)}`, result: `= ${n(r.dup)}\\ \\text{kW} \\ge ${n(r.P)}` },
    ],
    cite: SRC.m503(3, 'MG17, MG21'),
    params: () => ({ preset: 'mg17' }),
  }),
  parametric({
    id: '503-chain-11kw',
    course: 'AEE503',
    topic: 'Chain drives',
    moduleId: 'elements',
    sceneId: 'chains',
    title: 'Chain selection: design power and duplex rating',
    inputs: [
      { key: 'P', value: 11, min: 5, max: 20, step: 0.5 },
      { key: 'N1', value: 970, min: 700, max: 1500, step: 10 },
      { key: 'N2', value: 330, min: 200, max: 600, step: 10 },
      { key: 'SF', value: 1.3, min: 1, max: 1.5, step: 0.1 },
      { key: 'Ps', value: 11.7, min: 4, max: 25, step: 0.1 },
      { key: 'k', value: 1.7, min: 1.7, max: 1.7, step: 0.1 },
    ],
    statement: (v) =>
      `A ${num(v.P)} kW drive runs ${num(v.N1)} → ${num(v.N2)} rpm under moderate shock (SF ${num(v.SF)}). The chain is rated ${num(v.Ps)} kW simplex (duplex ${num(v.k)}×). Find the design power, ratio and duplex rating.`,
    answers: [
      { key: 'P', label: 'P_d', unit: 'kW', expected: 14.3 },
      { key: 'i', label: 'i', unit: '', expected: 2.94 },
      { key: 'dup', label: 'P_{duplex}', unit: 'kW', expected: 19.89 },
    ],
    solve: (v) => ({ P: designPower(v.P, v.SF), i: speedRatio(v.N1, v.N2), dup: strandRating(v.Ps, 2) }),
    // simplex too weak but duplex enough (the working assumes it); a chain-drive ratio of 1.5–6
    valid: (v, r) => strandsNeeded(r.P, v.Ps) === 2 && r.i >= 1.5 && r.i <= 6,
    working: (v, r) => [
      { label: 'Design power', tex: `P_d = ${tnum(v.SF)}\\times${tnum(v.P)}`, result: `= ${n(r.P)}\\ \\text{kW}`, cite: SRC.m503(3, 'selection') },
      { label: 'Ratio', tex: `i = ${tnum(v.N1)}/${tnum(v.N2)}`, result: `= ${n(r.i, 3)}` },
      { label: 'Duplex', tex: `${tnum(v.Ps)} < ${n(r.P)} \\Rightarrow ${tnum(v.k)}\\times${tnum(v.Ps)}`, result: `= ${n(r.dup)}\\ \\text{kW}` },
    ],
    cite: SRC.m503(3, 'MG19'),
    params: () => ({ preset: 'mg19' }),
  }),
  parametric({
    id: '503-spur-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Spur gear tooth forces',
    // standard pressure angles 20° and 25°
    inputs: [
      { key: 'd', value: 100, min: 50, max: 300, step: 10 },
      { key: 'phi', value: 20, min: 20, max: 25, step: 5 },
      { key: 'Mt', value: 200, min: 50, max: 1000, step: 10 },
    ],
    statement: (v) => `A ${num(v.d)} mm pitch-diameter spur pinion with ${num(v.phi)}° pressure angle transmits ${num(v.Mt)} N·m. Find the tangential and radial tooth forces.`,
    answers: [
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 4000 },
      { key: 'Fr', label: 'F_r', unit: 'N', expected: 1456 },
    ],
    solve: (v) => {
      const f = spurForces(v.Mt, v.d / 2000, rad(v.phi))
      return { Ft: f.Ft, Fr: f.Fr }
    },
    working: (v, r) => [
      { label: 'Tangential', tex: 'F_t = \\dfrac{M_t}{r}', sub: `\\dfrac{${tnum(v.Mt)}}{${tnum(v.d / 2000)}}`, result: `= ${n(r.Ft)}\\ \\text{N}`, cite: SRC.m503(5, 'Example 1') },
      { label: 'Radial', tex: 'F_r = F_t\\tan\\phi', sub: `${n(r.Ft)}\\tan${tnum(v.phi)}^\\circ`, result: `= ${n(r.Fr)}\\ \\text{N}` },
    ],
    cite: SRC.m503(5, 'Example 1'),
    params: () => ({ preset: 'spur' }),
  }),
  parametric({
    id: '503-helical-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Helical gear tooth forces',
    inputs: [
      { key: 'd', value: 250, min: 100, max: 400, step: 10 },
      { key: 'Mt', value: 200, min: 50, max: 1000, step: 10 },
      { key: 'phi', value: 27, min: 14.5, max: 30, step: 0.5 },
      { key: 'helix', value: 30, min: 15, max: 45, step: 1 },
    ],
    statement: (v) => `A helical gear of ${num(v.d)} mm pitch diameter transmits ${num(v.Mt)} N·m. The pressure angle is ${num(v.phi)}° and the helix angle ${num(v.helix)}°. Find the tangential, radial and axial forces.`,
    answers: [
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 1600 },
      { key: 'Fr', label: 'F_r', unit: 'N', expected: 815 },
      { key: 'Fa', label: 'F_a', unit: 'N', expected: 924 },
    ],
    solve: (v) => {
      const f = helicalForces(v.Mt, v.d / 2000, rad(v.phi), rad(v.helix))
      return { Ft: f.Ft, Fr: f.Fr, Fa: f.Fa }
    },
    working: (v, r, original) => [
      { label: 'Tangential', tex: 'F_t = M_t/r', sub: `${tnum(v.Mt)}/${tnum(v.d / 2000)}`, result: `= ${n(r.Ft)}\\ \\text{N}`, cite: SRC.m503(5, 'helical forces') },
      { label: 'Radial and axial', tex: 'F_r = F_t\\tan\\phi,\\quad F_a = F_t\\tan\\alpha', sub: `${n(r.Ft)}\\tan${tnum(v.phi)}^\\circ,\\ ${n(r.Ft)}\\tan${tnum(v.helix)}^\\circ`, result: `= ${n(r.Fr)},\\ ${n(r.Fa)}\\ \\text{N}`, ...(original ? { errata: 'One guide prints F_a = 928 N; 1600 tan 30° = 923.8 N.' } : {}) },
    ],
    cite: SRC.m503(5, 'MG16 Q3b, MG19 Q3c'),
    params: () => ({ preset: 'helical' }),
  }),
  parametric({
    id: '503-bevel-forces',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Bevel gear forces',
    inputs: [
      { key: 'gn', value: 4, min: 3, max: 7, step: 1 },
      { key: 'gd', value: 3, min: 2, max: 5, step: 1 },
      { key: 'dp', value: 150, min: 100, max: 300, step: 10 },
      { key: 'b', value: 50, min: 20, max: 80, step: 5 },
      { key: 'phi', value: 14.5, min: 14.5, max: 25, step: 0.5 },
      { key: 'P', value: 6, min: 2, max: 20, step: 0.5 },
      { key: 'N', value: 240, min: 100, max: 1000, step: 10 },
    ],
    statement: (v) =>
      `A pair of bevel gears with ratio ${num(v.gn)}/${num(v.gd)} has a ${num(v.dp)} mm pinion (pitch) and ${num(v.b)} mm face width; pressure angle ${num(v.phi)}°. The pinion transmits ${num(v.P)} kW at ${num(v.N)} rpm. Find the torque, the mean radius and the tangential, pinion-axial and gear-axial forces.`,
    answers: [
      { key: 'Mt', label: 'M_t', unit: 'N·m', expected: 239 },
      { key: 'rm', label: 'r_m', unit: 'mm', expected: 60 },
      { key: 'Ft', label: 'F_t', unit: 'N', expected: 3983 },
      { key: 'Fp', label: 'F_p', unit: 'N', expected: 618 },
      { key: 'Fg', label: 'F_g', unit: 'N', expected: 824 },
    ],
    solve: (v) => {
      const rp = v.dp / 2000
      const beta = pinionConeAngle(rp, (rp * v.gn) / v.gd)
      const rm = bevelMeanRadius(rp, v.b / 1000, beta)
      const Mt = torqueFromPower(v.P * 1000, v.N)
      const f = bevelForces(Mt, rm, rad(v.phi), beta)
      return { Mt, rm: rm * 1000, Ft: f.Ft, Fp: f.Fp, Fg: f.Fg }
    },
    // a reduction in lowest terms; face width 20–42 % of the cone distance r_p / sin β
    valid: (v) => {
      if (v.gn <= v.gd || gcd(v.gn, v.gd) !== 1 || v.gn / v.gd > 3) return false
      const rp = v.dp / 2
      const A = rp / Math.sin(pinionConeAngle(rp, (rp * v.gn) / v.gd))
      return v.b >= 0.2 * A && v.b <= 0.42 * A
    },
    working: (v, r) => {
      const beta = pinionConeAngle(v.gd, v.gn)
      return [
        { label: 'Torque', tex: 'M_t = \\dfrac{60 P}{2\\pi N}', sub: `\\dfrac{60\\times${tnum(v.P * 1000)}}{2\\pi\\times${tnum(v.N)}}`, result: `= ${n(r.Mt)}\\ \\text{N·m}`, cite: SRC.m503(5, 'bevel forces') },
        { label: 'Cone angle and mean radius', tex: `\\tan\\beta = \\dfrac{r_p}{r_g} = \\tfrac{${tnum(v.gd)}}{${tnum(v.gn)}},\\quad r_m = r_p - \\tfrac{b}{2}\\sin\\beta`, sub: `${tnum(v.dp / 2)} - ${tnum(v.b / 2)}\\times${n(Math.sin(beta), 3)}`, result: `= ${n(r.rm)}\\ \\text{mm}` },
        { label: 'Forces', tex: 'F_t = \\dfrac{M_t}{r_m},\\ F_p = F_t\\tan\\phi\\sin\\beta,\\ F_g = F_t\\tan\\phi\\cos\\beta', result: `= ${n(r.Ft)},\\ ${n(r.Fp)},\\ ${n(r.Fg)}\\ \\text{N}` },
      ]
    },
    cite: SRC.m503(5, 'MG15 Q3c'),
    params: () => ({ preset: 'bevel' }),
  }),
  parametric({
    id: '503-idler-train',
    course: 'AEE503',
    topic: 'Gears',
    moduleId: 'elements',
    sceneId: 'gears',
    title: 'Idler gear train',
    inputs: [
      { key: 'zA', value: 35, min: 18, max: 60, step: 1 },
      { key: 'zC', value: 45, min: 18, max: 80, step: 1 },
      { key: 'zB', value: 65, min: 18, max: 80, step: 1 },
      { key: 'm', value: 6, min: 2, max: 10, step: 1 },
      { key: 'P', value: 3, min: 1, max: 15, step: 0.5 },
      { key: 'N', value: 600, min: 200, max: 1500, step: 50 },
    ],
    statement: (v) =>
      `Gear A (${num(v.zA)} teeth) drives gear C (${num(v.zC)} teeth) through an idler B (${num(v.zB)} teeth), module ${num(v.m)} mm. A receives ${num(v.P)} kW at ${num(v.N)} rpm. Find the torque on A, the speed of C and the torque on C (no losses).`,
    answers: [
      { key: 'TA', label: 'T_A', unit: 'N·m', expected: 47.8 },
      { key: 'NC', label: 'N_C', unit: 'rpm', expected: 466.7 },
      { key: 'TC', label: 'T_C', unit: 'N·m', expected: 61.4 },
    ],
    solve: (v) => {
      const t = idlerTrain(v.P * 1000, v.N, v.zA, v.zB, v.zC)
      return { TA: t.TA, NC: t.rpmC, TC: t.TC }
    },
    // A and C differ, so the train really changes speed
    valid: (v) => v.zA !== v.zC,
    working: (v, r) => [
      { label: 'Input torque', tex: 'T_A = \\dfrac{60P}{2\\pi N_A}', sub: `\\dfrac{60\\times${tnum(v.P * 1000)}}{2\\pi\\times${tnum(v.N)}}`, result: `= ${n(r.TA)}\\ \\text{N·m}`, cite: SRC.m503(5, 'gear trains') },
      { label: 'The idler cancels', tex: 'N_C = N_A\\dfrac{z_A}{z_C}', sub: `${tnum(v.N)}\\times\\dfrac{${tnum(v.zA)}}{${tnum(v.zC)}}`, result: `= ${n(r.NC)}\\ \\text{rpm}` },
      { label: 'Output torque', tex: 'T_C = T_A\\dfrac{z_C}{z_A}', sub: `${n(r.TA)}\\times\\dfrac{${tnum(v.zC)}}{${tnum(v.zA)}}`, result: `= ${n(r.TC)}\\ \\text{N·m}` },
    ],
    cite: SRC.m503(5, 'MG17, MG21 Q2c'),
    params: () => ({ preset: 'idler' }),
  }),
  parametric({
    id: '503-bar-weld',
    course: 'AEE503',
    topic: 'Welded joints',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Fillet weld round a bar',
    inputs: [
      { key: 'd', value: 50, min: 25, max: 100, step: 5 },
      { key: 'V', value: 10, min: 2, max: 30, step: 0.5 },
      { key: 'e', value: 200, min: 50, max: 500, step: 10 },
    ],
    statement: (v) => `A ${num(v.d)} mm diameter bar is fillet-welded all round to a plate and carries ${num(v.V)} kN at ${num(v.e)} mm from the weld. With the standard allowable weld stress, find the weld section modulus, the resultant force per unit length and the leg size.`,
    answers: [
      { key: 'Zw', label: 'Z_w', unit: '×10⁻³ m²', expected: 1.964 },
      { key: 'f', label: 'f', unit: 'MN/m', expected: 1.02 },
      { key: 'w', label: 'w', unit: 'mm', expected: 15.4 },
    ],
    solve: (v) => {
      const r = barWeld(v.V * 1e3, v.e / 1000, v.d / 1000)
      return { Zw: r.Zw * 1e3, f: r.f / 1e6, w: r.w * 1000 }
    },
    // a practical fillet: 3–25 mm leg, and smaller than the bar radius
    valid: (v, r) => r.w >= 3 && r.w <= 25 && r.w < v.d / 2,
    working: (v, r) => [
      { label: 'Weld as a line', tex: 'Z_w = \\dfrac{\\pi d^2}{4}', sub: `\\dfrac{\\pi(${tnum(v.d / 1000)})^2}{4}`, result: `= ${n(r.Zw)}\\times10^{-3}\\ \\text{m}^2`, cite: SRC.m503(11, 'weld as a line') },
      { label: 'Force per unit length', tex: 'f_b = \\dfrac{M}{Z_w},\\ f_s = \\dfrac{V}{\\pi d},\\ f = \\sqrt{f_b^2 + f_s^2}', sub: `M = ${tnum(v.V * 1000)}\\times${tnum(v.e / 1000)}`, result: `= ${n(r.f)}\\ \\text{MN/m}` },
      { label: 'Leg size', tex: 'w = \\dfrac{f}{0.707\\,s}', result: `= ${n(r.w)}\\ \\text{mm}` },
    ],
    cite: SRC.m503(11, 'MG15 Q6c, MG17, MG19, MG21'),
    params: () => ({ preset: 'bar' }),
  }),
  parametric({
    id: '503-bracket-weld',
    course: 'AEE503',
    topic: 'Welded joints',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Eccentrically loaded bracket weld',
    inputs: [
      { key: 'V', value: 35, min: 10, max: 60, step: 1 },
      { key: 'e', value: 570, min: 200, max: 800, step: 10 },
      { key: 'b', value: 120, min: 50, max: 200, step: 10 },
      { key: 'd', value: 240, min: 100, max: 400, step: 10 },
    ],
    statement: (v) =>
      `A bracket carries ${num(v.V)} kN at ${num(v.e)} mm eccentricity. It is welded along a C-shaped line: two ${num(v.b)} mm horizontal welds and one ${num(v.d)} mm vertical weld. Find the polar modulus of the weld line, the resultant force per unit length and the leg size.`,
    answers: [
      { key: 'Jw', label: 'J_w', unit: '×10⁻³ m³', expected: 5.328 },
      { key: 'f', label: 'f', unit: 'MN/m', expected: 0.609 },
      { key: 'w', label: 'w', unit: 'mm', expected: 9.2 },
    ],
    solve: (v) => {
      const r = bracketWeld(v.V * 1e3, v.e / 1000, v.b / 1000, v.d / 1000)
      return { Jw: r.Jw * 1e3, f: r.f / 1e6, w: r.w * 1000 }
    },
    // flanges no longer than the web, and a practical 3–25 mm leg
    valid: (v, r) => v.b <= v.d && r.w >= 3 && r.w <= 25,
    working: (v, r) => [
      { label: 'Polar modulus of the weld line', tex: 'J_w = \\dfrac{(2b + d)^3}{12} - \\dfrac{b^2(b + d)^2}{2b + d}', sub: `b = ${tnum(v.b / 1000)},\\ d = ${tnum(v.d / 1000)}\\ \\text{m}`, result: `= ${n(r.Jw)}\\times10^{-3}\\ \\text{m}^3`, cite: SRC.m503(11, 'Example 1') },
      { label: 'Resultant', tex: 'f = \\sqrt{f_h^2 + (f_{v0} + f_{vT})^2}', sub: `T = ${tnum(v.V * 1000)}\\times${tnum(v.e / 1000)}`, result: `= ${n(r.f)}\\ \\text{MN/m}` },
      { label: 'Leg size', tex: 'w = \\dfrac{f}{0.707\\,s}', result: `= ${n(r.w)}\\ \\text{mm}` },
    ],
    cite: SRC.m503(11, 'Example 1'),
    params: () => ({ preset: 'bracket' }),
  }),
  parametric({
    id: '503-helical-spring',
    course: 'AEE503',
    topic: 'Springs',
    moduleId: 'elements',
    sceneId: 'springs-welds',
    title: 'Design a helical compression spring',
    inputs: [
      { key: 'y', value: 25, min: 10, max: 60, step: 1 },
      { key: 'F', value: 500, min: 100, max: 2000, step: 50 },
      { key: 'C', value: 8, min: 5, max: 12, step: 0.5 },
      { key: 'tau', value: 350, min: 250, max: 600, step: 10 },
      { key: 'G', value: 84, min: 78, max: 84, step: 1 },
    ],
    statement: (v) =>
      `A helical spring must deflect ${num(v.y)} mm under ${num(v.F)} N. Spring index C = ${num(v.C)}, allowable shear stress ${num(v.tau)} MPa, G = ${num(v.G)} GPa. Using Ks = 1 + 0.5/C, find the wire diameter, then (with d rounded to ${num(roundedWire(springWire(v)))} mm) the mean coil diameter and the number of active coils.`,
    answers: [
      { key: 'd', label: 'd', unit: 'mm', expected: 5.56 },
      { key: 'D', label: 'D', unit: 'mm', expected: 48 },
      { key: 'n', label: 'n', unit: 'coils', expected: 6.15 },
    ],
    solve: (v) => {
      const d = springWire(v)
      const ds = roundedWire(d)
      return { d, D: v.C * ds, n: activeCoils(v.y / 1000, v.F, v.C, ds / 1000, v.G * 1e9) }
    },
    // a buildable spring: 3–30 active coils
    valid: (_v, r) => r.n >= 3 && r.n <= 30,
    working: (v, r) => {
      const ds = roundedWire(r.d)
      return [
        { label: 'Wire diameter', tex: '\\tau = K_s\\dfrac{8 F C}{\\pi d^2} \\Rightarrow d = \\sqrt{\\dfrac{8 K_s F C}{\\pi\\tau}}', sub: `\\sqrt{\\dfrac{8\\times${n(shearStressFactor(v.C), 5)}\\times${tnum(v.F)}\\times${tnum(v.C)}}{\\pi\\times${tnum(v.tau)}\\times10^6}}`, result: `= ${n(r.d)}\\ \\text{mm} \\to ${tnum(ds)}\\ \\text{mm}`, cite: SRC.m503(10, 'helical springs') },
        { label: 'Coil diameter', tex: 'D = C d', sub: `${tnum(v.C)}\\times${tnum(ds)}`, result: `= ${n(r.D)}\\ \\text{mm}` },
        { label: 'Active coils', tex: 'y = \\dfrac{8 F C^3 n}{G d} \\Rightarrow n = \\dfrac{y G d}{8 F C^3}', sub: `\\dfrac{${tnum(v.y / 1000)}\\times${tnum(v.G)}\\times10^9\\times${tnum(ds / 1000)}}{8\\times${tnum(v.F)}\\times${tnum(v.C)}^3}`, result: `= ${n(r.n)}` },
      ]
    },
    cite: MG2122,
    params: () => ({ preset: 'mg21' }),
  }),
  parametric({
    id: '503-shoe-brake',
    course: 'AEE503',
    topic: 'Brakes',
    moduleId: 'elements',
    sceneId: 'clutch-brake',
    title: 'Single-shoe brake',
    inputs: [
      { key: 'R', value: 360, min: 150, max: 500, step: 10 },
      { key: 'T', value: 225, min: 100, max: 1000, step: 5 },
      { key: 'f', value: 0.3, min: 0.2, max: 0.45, step: 0.05 },
      { key: 'a', value: 360, min: 150, max: 600, step: 10 },
      { key: 'b', value: 900, min: 500, max: 1500, step: 50 },
      { key: 'c', value: 40, min: 10, max: 100, step: 5 },
      { key: 'N', value: 500, min: 200, max: 1500, step: 50 },
    ],
    statement: (v) =>
      `A single-shoe brake on a ${num(v.R)} mm radius drum must absorb ${num(v.T)} N·m with f = ${num(v.f)}. The shoe is at a = ${num(v.a)} mm from the lever pivot, the hand force acts at b = ${num(v.b)} mm and the line of friction is offset c = ${num(v.c)} mm. Find the normal force, the lever force for clockwise rotation (friction aiding), and the heat generated at ${num(v.N)} rpm.`,
    answers: [
      { key: 'N', label: 'N', unit: 'N', expected: 2083 },
      { key: 'F', label: 'F', unit: 'N', expected: 805 },
      { key: 'H', label: 'H_g', unit: 'kW', expected: 11.8 },
    ],
    solve: (v) => {
      const N = shoeNormalForce(v.T, v.f, v.R / 1000)
      return { N, F: shoeLeverForce(N, v.f, v.a / 1000, v.b / 1000, v.c / 1000, 'aiding'), H: heatGenerated(v.f, N, (2 * Math.PI * v.N * (v.R / 1000)) / 60) / 1000 }
    },
    // the hand lever is longer than the shoe arm, and the brake is not self-locking (F > 0)
    valid: (v, r) => v.b > v.a && r.F > 0,
    working: (v, r) => [
      { label: 'Normal force', tex: 'N = \\dfrac{T}{f R}', sub: `\\dfrac{${tnum(v.T)}}{${tnum(v.f)}\\times${tnum(v.R / 1000)}}`, result: `= ${n(r.N)}\\ \\text{N}`, cite: SRC.m503(9, 'Example 1') },
      { label: 'Lever force (moments about the pivot)', tex: 'F b = N a - f N c', sub: `F\\times${tnum(v.b / 1000)} = ${n(r.N)}\\times${tnum(v.a / 1000)} - ${tnum(v.f)}\\times${n(r.N)}\\times${tnum(v.c / 1000)}`, result: `F = ${n(r.F)}\\ \\text{N}` },
      { label: 'Heat', tex: 'H_g = f N V', sub: `${tnum(v.f)}\\times${n(r.N)}\\times${n((2 * Math.PI * v.N * (v.R / 1000)) / 60)}`, result: `= ${n(r.H)}\\ \\text{kW}` },
    ],
    cite: SRC.m503(9, 'Example 1'),
    params: () => ({ preset: 'shoe' }),
  }),
  parametric({
    id: '503-band-brake',
    course: 'AEE503',
    topic: 'Brakes',
    moduleId: 'elements',
    sceneId: 'clutch-brake',
    title: 'Band brake tensions',
    inputs: [
      { key: 'wrap', value: 280, min: 180, max: 300, step: 5 },
      { key: 'D', value: 450, min: 200, max: 800, step: 10 },
      { key: 'T', value: 170, min: 50, max: 1000, step: 5 },
      { key: 'f', value: 0.2, min: 0.15, max: 0.4, step: 0.05 },
    ],
    statement: (v) => `A band brake wraps ${num(v.wrap)}° round a ${num(v.D)} mm drum and must hold ${num(v.T)} N·m with f = ${num(v.f)}. Find the tight- and slack-side tensions.`,
    answers: [
      { key: 'F1', label: 'F_1', unit: 'N', expected: 1210 },
      { key: 'F2', label: 'F_2', unit: 'N', expected: 455 },
    ],
    solve: (v) => {
      const r = bandTensions(v.T, v.D / 2000, v.f, rad(v.wrap))
      return { F1: r.F1, F2: r.F2 }
    },
    working: (v, r) => [
      { label: 'Tension ratio', tex: '\\dfrac{F_1}{F_2} = e^{f\\alpha}', sub: `e^{${tnum(v.f)}\\times${n(rad(v.wrap))}}`, result: `= ${n(Math.exp(v.f * rad(v.wrap)), 3)}`, cite: SRC.m503(9, 'Example 2') },
      { label: 'Torque', tex: 'T = (F_1 - F_2) r', sub: `${tnum(v.T)} = (F_1 - F_2)\\times${tnum(v.D / 2000)}`, result: `F_1 = ${n(r.F1)},\\ F_2 = ${n(r.F2)}\\ \\text{N}` },
    ],
    cite: SRC.m503(9, 'Example 2'),
    params: () => ({ preset: 'band' }),
  }),
]
