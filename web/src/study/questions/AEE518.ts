import { SRC } from '@/content/citations'
import {
  cantileverEffectiveMass,
  cantileverStiffness,
  characteristicRoots,
  dampingForRatio,
  dampingRatio,
  forcedAmplitude,
  isolationEfficiency,
  logDecrementFromPeaks,
  naturalFrequency,
  ratioForTransmissibility,
  rectSecondMoment,
  unbalanceForce,
  zetaFromLogDecrement,
} from '@/physics/vibration'
import { n } from '@/ui/Working'
import type { Question } from '../types'
import { num, parametric, tnum, type Vals } from '../variants'

const rpmToRad = (N: number) => (N * 2 * Math.PI) / 60

/** Log decrement, damping ratio and damping coefficient for the free-decay question. */
const decay = (v: Vals) => {
  const d = logDecrementFromPeaks(100, v.pct, v.cyc)
  const z = zetaFromLogDecrement(d)
  return { d, z, b: dampingForRatio(z, v.k * 1000, v.m) }
}

export const AEE518: Question[] = [
  parametric({
    id: '518-step-response',
    course: 'AEE518',
    topic: 'Second-order systems',
    moduleId: 'vibration',
    sceneId: 'smd',
    title: 'Second-order step response',
    inputs: [
      { key: 'c', value: 10, min: 6, max: 20, step: 1 },
      { key: 'k', value: 16, min: 4, max: 60, step: 1 },
      { key: 'F', value: 32, min: 8, max: 100, step: 2 },
    ],
    statement: (v) =>
      `A system obeys θ̈ + ${num(v.c)}θ̇ + ${num(v.k)}θ = ${num(v.F)}u(t). Find the undamped natural frequency, the damping ratio, the two roots of the characteristic equation and the final value of θ.`,
    answers: [
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 4 },
      { key: 'zeta', label: '\\zeta', unit: '', expected: 1.25 },
      { key: 'r1', label: 's_1', unit: '1/s', expected: -2 },
      { key: 'r2', label: 's_2', unit: '1/s', expected: -8 },
      { key: 'final', label: '\\theta(\\infty)', unit: '', expected: 2 },
    ],
    solve: (v) => {
      const r = characteristicRoots(1, v.c, v.k)
      return { wn: naturalFrequency(v.k, 1), zeta: dampingRatio(v.c, v.k, 1), r1: r.re1, r2: r.re2, final: v.F / v.k }
    },
    // keep it clearly overdamped (two distinct real roots), as in the original
    valid: (_v, r) => r.zeta >= 1.05,
    working: (v, r, original) => {
      // θ = θ∞[1 + (s₂e^{s₁t} − s₁e^{s₂t})/(s₁ − s₂)]
      const A = (r.final * r.r2) / (r.r1 - r.r2)
      const B = (-r.final * r.r1) / (r.r1 - r.r2)
      const resp = original
        ? '\\theta = 2 + \\tfrac{2}{3}e^{-8t} - \\tfrac{8}{3}e^{-2t}'
        : `\\theta = ${n(r.final)} + ${n(B)}e^{${n(r.r2)}t} - ${n(-A)}e^{${n(r.r1)}t}`
      return [
        { label: 'Natural frequency and damping ratio', tex: '\\omega_n = \\sqrt{a_0/a_2},\\quad \\zeta = \\dfrac{a_1}{2\\sqrt{a_0 a_2}}', sub: `\\sqrt{${tnum(v.k)}},\\ \\dfrac{${tnum(v.c)}}{2\\times${n(r.wn)}}`, result: `= ${n(r.wn)}\\ \\text{rad/s},\\ ${n(r.zeta)}\\ (\\text{overdamped})`, cite: SRC.ln518('second-order systems') },
        { label: 'Roots', tex: 's = -\\zeta\\omega_n \\pm \\omega_n\\sqrt{\\zeta^2 - 1}', sub: `-${n(r.zeta * r.wn)} \\pm ${n(r.wn * Math.sqrt(r.zeta * r.zeta - 1))}`, result: `= ${n(r.r1)},\\ ${n(r.r2)}` },
        { label: 'Response', tex: resp, result: `\\theta(\\infty) = ${n(r.final)}` },
      ]
    },
    cite: SRC.ln518('exam 2016/17; marking guides 2017/18, 2018/19'),
    params: (v) => ({ m: 1, c: v.c, k: v.k, mode: 'step', F0: v.F }),
  }),
  parametric({
    id: '518-log-decrement',
    course: 'AEE518',
    topic: 'Damping',
    moduleId: 'vibration',
    sceneId: 'smd',
    title: 'Damping from the logarithmic decrement',
    inputs: [
      { key: 'm', value: 4, min: 2, max: 20, step: 1 },
      { key: 'k', value: 5, min: 1, max: 20, step: 0.5 },
      { key: 'pct', value: 25, min: 10, max: 80, step: 5 },
      { key: 'cyc', value: 5, min: 2, max: 10, step: 1 },
    ],
    statement: (v) =>
      `A ${num(v.m)} kg mass on a ${num(v.k)} kN/m spring is released; its amplitude falls to ${num(v.pct)} % of the starting value in ${num(v.cyc)} cycles. Find the logarithmic decrement, the damping ratio and the damping coefficient.`,
    answers: [
      { key: 'd', label: '\\delta', unit: '', expected: 0.277 },
      { key: 'z', label: '\\zeta', unit: '', expected: 0.044 },
      { key: 'b', label: 'b', unit: 'N·s/m', expected: 12.5 },
    ],
    solve: (v) => decay(v),
    // lightly damped, so there are several clear peaks to count
    valid: (_v, r) => r.z > 0.005 && r.z < 0.2,
    working: (v, r) => [
      { label: 'Log decrement', tex: '\\delta = \\dfrac{1}{n}\\ln\\dfrac{x_0}{x_n}', sub: `\\tfrac{1}{${tnum(v.cyc)}}\\ln${tnum(100 / v.pct)}`, result: `= ${n(r.d, 3)}`, cite: SRC.ln518('log decrement') },
      { label: 'Damping ratio', tex: '\\zeta = \\dfrac{\\delta}{\\sqrt{4\\pi^2 + \\delta^2}}', result: `= ${n(r.z, 3)}` },
      { label: 'Damping coefficient', tex: 'b = 2\\zeta\\sqrt{m k}', sub: `2\\times${n(r.z, 3)}\\sqrt{${tnum(v.m)}\\times${tnum(v.k * 1000)}}`, result: `= ${n(r.b)}\\ \\text{N·s/m}` },
    ],
    cite: SRC.ln518('log decrement example'),
    params: (v) => ({ m: v.m, k: v.k * 1000, c: Math.round(decay(v).b * 10) / 10, mode: 'free', x0: 0.02 }),
  }),
  parametric({
    id: '518-compressor-isolation',
    course: 'AEE518',
    topic: 'Vibration isolation',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Isolating a compressor',
    inputs: [
      { key: 'M', value: 450, min: 200, max: 1000, step: 10 },
      { key: 'N', value: 1750, min: 600, max: 3000, step: 50 },
      { key: 'mu', value: 10, min: 2, max: 30, step: 1 },
      { key: 'e', value: 100, min: 50, max: 200, step: 5 },
      { key: 'zeta', value: 0.15, min: 0.05, max: 0.3, step: 0.01 },
      { key: 'TR', value: 20, min: 10, max: 40, step: 5 },
    ],
    statement: (v) =>
      `A ${num(v.M)} kg compressor runs at ${num(v.N)} rpm; its ${num(v.mu)} kg reciprocating mass moves on a ${num(v.e)} mm crank. The mounts have ζ = ${num(v.zeta)} and only ${num(v.TR)} % of the shaking force may be transmitted. Find the frequency ratio, the natural frequency, the mount stiffness, the transmitted force and the isolation efficiency.`,
    answers: [
      { key: 'r', label: 'r', unit: '', expected: 2.72 },
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 67.4 },
      { key: 'k', label: 'k', unit: 'kN/m', expected: 2042 },
      { key: 'FT', label: 'F_T', unit: 'kN', expected: 6.72 },
      { key: 'eff', label: '\\eta_{iso}', unit: '%', expected: 80 },
    ],
    solve: (v) => {
      const w = rpmToRad(v.N)
      const TR = v.TR / 100
      const r = ratioForTransmissibility(TR, v.zeta)
      const wn = w / r
      return { r, wn, k: (v.M * wn * wn) / 1000, FT: (TR * unbalanceForce(v.mu, v.e / 1000, w)) / 1000, eff: isolationEfficiency(TR) }
    },
    // isolation only happens above r = √2
    valid: (_v, r) => r.r > Math.SQRT2,
    working: (v, r) => {
      const w = rpmToRad(v.N)
      const TR = tnum(v.TR / 100)
      return [
        { label: `Frequency ratio for TR = ${TR}`, tex: `TR = \\sqrt{\\dfrac{1 + (2\\zeta r)^2}{(1 - r^2)^2 + (2\\zeta r)^2}} = ${TR}`, result: `r = ${n(r.r, 3)}`, cite: SRC.ln518('transmissibility') },
        { label: 'Natural frequency and stiffness', tex: '\\omega_n = \\omega/r,\\quad k = m\\omega_n^2', sub: `${n(w)}/${n(r.r, 3)},\\ ${tnum(v.M)}\\times${n(r.wn, 3)}^2`, result: `= ${n(r.wn, 3)}\\ \\text{rad/s},\\ ${n(r.k)}\\ \\text{kN/m}` },
        { label: 'Transmitted force', tex: 'F_T = TR\\cdot m e\\omega^2', sub: `${TR}\\times${tnum(v.mu)}\\times${tnum(v.e / 1000)}\\times${n(w)}^2`, result: `= ${n(r.FT)}\\ \\text{kN}` },
        { label: 'Isolation efficiency', tex: '(1 - TR)\\times100', result: `= ${n(r.eff)}\\,\\%` },
      ]
    },
    cite: SRC.ln518('compressor isolation example'),
  }),
  parametric({
    id: '518-hopper',
    course: 'AEE518',
    topic: 'Forced vibration',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Hopper shaker near resonance',
    inputs: [
      { key: 'm', value: 400, min: 300, max: 500, step: 10 },
      { key: 'k', value: 39.5, min: 25, max: 60, step: 0.5 },
      { key: 'b', value: 100, min: 50, max: 500, step: 10 },
      { key: 'F', value: 75, min: 25, max: 200, step: 5 },
      { key: 'f', value: 50, min: 45, max: 55, step: 1 },
    ],
    statement: (v) =>
      `A ${num(v.m)} kg hopper on springs of total stiffness ${num(v.k)} MN/m with damping ${num(v.b)} N·s/m is shaken by ${num(v.F)} N at ${num(v.f)} Hz. Find the natural frequency, the damping ratio and the steady amplitude.`,
    answers: [
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 314.2 },
      { key: 'z', label: '\\zeta', unit: '×10⁻⁴', expected: 3.98 },
      { key: 'X', label: 'X', unit: 'mm', expected: 1.97 },
    ],
    solve: (v) => ({
      wn: naturalFrequency(v.k * 1e6, v.m),
      z: dampingRatio(v.b, v.k * 1e6, v.m) * 1e4,
      X: forcedAmplitude(v.F, v.m, v.b, v.k * 1e6, 2 * Math.PI * v.f) * 1000,
    }),
    // stay near resonance (forcing within 5 % of the natural frequency), as in the original
    valid: (v, r) => Math.abs((2 * Math.PI * v.f) / r.wn - 1) <= 0.05,
    working: (v, r, original) => {
      const w = 2 * Math.PI * v.f
      const ratio = w / r.wn
      return [
        { label: 'Natural frequency', tex: '\\omega_n = \\sqrt{k/m}', sub: `\\sqrt{${tnum(v.k)}\\times10^6/${tnum(v.m)}}`, result: original ? `= ${n(r.wn)}\\ \\text{rad/s} \\approx \\omega = 314.16` : `= ${n(r.wn)}\\ \\text{rad/s};\\ \\omega = 2\\pi\\times${tnum(v.f)} = ${n(w, 5)},\\ r = ${n(ratio)}`, cite: SRC.ln518('forced vibration') },
        { label: 'Damping ratio', tex: '\\zeta = \\dfrac{b}{2\\sqrt{km}}', sub: `\\dfrac{${tnum(v.b)}}{2\\sqrt{${tnum(v.k)}\\times10^6\\times${tnum(v.m)}}}`, result: `= ${n(r.z, 3)}\\times10^{-4}` },
        original
          ? { label: 'Amplitude (r ≈ 1)', tex: 'X = \\dfrac{F_0/k}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}} \\approx \\dfrac{F_0}{b\\,\\omega}', sub: `\\dfrac{${tnum(v.F)}}{${tnum(v.b)}\\times${n(w, 5)}}`, result: `= ${n(r.X, 3)}\\ \\text{mm}` }
          : { label: 'Amplitude', tex: 'X = \\dfrac{F_0/k}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}}', sub: `\\dfrac{${tnum(v.F)}/(${tnum(v.k)}\\times10^6)}{\\sqrt{(1-${n(ratio)}^2)^2 + (2\\times${n(r.z, 3)}\\times10^{-4}\\times${n(ratio)})^2}}`, result: `= ${n(r.X, 3)}\\ \\text{mm}` },
      ]
    },
    cite: SRC.ln518('exam 2016/17; marking guide 2018/19'),
  }),
  parametric({
    id: '518-cantilever',
    course: 'AEE518',
    topic: 'Equivalent systems',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Machine on a cantilever',
    inputs: [
      { key: 'W', value: 900, min: 300, max: 3000, step: 50 },
      { key: 'L', value: 2, min: 1, max: 3, step: 0.1 },
      { key: 'b', value: 20, min: 15, max: 60, step: 5 },
      { key: 'h', value: 40, min: 25, max: 100, step: 5 },
      { key: 'E', value: 207, min: 195, max: 215, step: 1 },
      { key: 'rho', value: 7850, min: 7750, max: 7900, step: 10 },
    ],
    statement: (v) =>
      `A ${num(v.W)} N machine sits at the free end of a steel cantilever ${num(v.L)} m long, ${num(v.b)} mm wide and ${num(v.h)} mm deep (E = ${num(v.E)} GPa, ρ = ${num(v.rho)} kg/m³). Using an effective mass M + 0.23 m_beam, find the stiffness, the effective mass and the natural frequency.`,
    answers: [
      { key: 'k', label: 'k_e', unit: 'N/m', expected: 8280 },
      { key: 'Me', label: 'M_e', unit: 'kg', expected: 94.63 },
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 9.35 },
    ],
    solve: (v) => {
      const b = v.b / 1000
      const h = v.h / 1000
      const k = cantileverStiffness(v.E * 1e9, rectSecondMoment(b, h), v.L)
      const Me = cantileverEffectiveMass(v.W / 9.81, b * h * v.L * v.rho)
      return { k, Me, wn: naturalFrequency(k, Me) }
    },
    // a beam deeper than it is wide, and light next to the machine so the lumped-mass model holds
    valid: (v) => v.h > v.b && (v.b / 1000) * (v.h / 1000) * v.L * v.rho <= 0.3 * (v.W / 9.81),
    working: (v, r, original) => {
      const I = rectSecondMoment(v.b / 1000, v.h / 1000)
      const mBeam = (v.b / 1000) * (v.h / 1000) * v.L * v.rho
      return [
        { label: 'Stiffness', tex: 'k_e = \\dfrac{3EI}{L^3},\\quad I = \\dfrac{bh^3}{12}', sub: `\\dfrac{3\\times${tnum(v.E)}\\times10^9\\times${n(I)}}{${n(v.L ** 3)}}`, result: `= ${n(r.k)}\\ \\text{N/m}`, cite: SRC.ln518('equivalent systems'), ...(original ? { errata: 'The notes use E = 2.07×10¹³ and get ωₙ = 93.5 rad/s.' } : {}) },
        { label: 'Effective mass', tex: 'M_e = \\dfrac{W}{g} + 0.23\\,m_{beam}', sub: `\\dfrac{${tnum(v.W)}}{9.81} + 0.23\\times${n(mBeam)}`, result: `= ${n(r.Me)}\\ \\text{kg}` },
        { label: 'Natural frequency', tex: '\\omega_n = \\sqrt{k_e/M_e}', result: `= ${n(r.wn)}\\ \\text{rad/s}` },
      ]
    },
    cite: SRC.ln518('equivalent systems example'),
    errata: 'cantilever-E',
  }),
]
