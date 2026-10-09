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

export const AEE518: Question[] = [
  {
    id: '518-step-response',
    course: 'AEE518',
    topic: 'Second-order systems',
    moduleId: 'vibration',
    sceneId: 'smd',
    title: 'Second-order step response',
    statement: 'A system obeys θ̈ + 10θ̇ + 16θ = 32u(t). Find the undamped natural frequency, the damping ratio, the two roots of the characteristic equation and the final value of θ.',
    answers: [
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 4 },
      { key: 'zeta', label: '\\zeta', unit: '', expected: 1.25 },
      { key: 'r1', label: 's_1', unit: '1/s', expected: -2 },
      { key: 'r2', label: 's_2', unit: '1/s', expected: -8 },
      { key: 'final', label: '\\theta(\\infty)', unit: '', expected: 2 },
    ],
    solve: () => {
      const r = characteristicRoots(1, 10, 16)
      return { wn: naturalFrequency(16, 1), zeta: dampingRatio(10, 16, 1), r1: r.re1, r2: r.re2, final: 32 / 16 }
    },
    working: (r) => [
      { label: 'Natural frequency and damping ratio', tex: '\\omega_n = \\sqrt{a_0/a_2},\\quad \\zeta = \\dfrac{a_1}{2\\sqrt{a_0 a_2}}', sub: '\\sqrt{16},\\ \\dfrac{10}{2\\times4}', result: `= ${n(r.wn)}\\ \\text{rad/s},\\ ${n(r.zeta)}\\ (\\text{overdamped})`, cite: SRC.ln518('second-order systems') },
      { label: 'Roots', tex: 's = -\\zeta\\omega_n \\pm \\omega_n\\sqrt{\\zeta^2 - 1}', sub: '-5 \\pm 3', result: `= ${n(r.r1)},\\ ${n(r.r2)}` },
      { label: 'Response', tex: '\\theta = 2 + \\tfrac{2}{3}e^{-8t} - \\tfrac{8}{3}e^{-2t}', result: `\\theta(\\infty) = ${n(r.final)}` },
    ],
    cite: SRC.ln518('exam 2016/17; marking guides 2017/18, 2018/19'),
    params: { m: 1, c: 10, k: 16, mode: 'step', F0: 32 },
  },
  {
    id: '518-log-decrement',
    course: 'AEE518',
    topic: 'Damping',
    moduleId: 'vibration',
    sceneId: 'smd',
    title: 'Damping from the logarithmic decrement',
    statement: 'A 4 kg mass on a 5 kN/m spring is released; its amplitude falls to ¼ of the starting value in 5 cycles. Find the logarithmic decrement, the damping ratio and the damping coefficient.',
    answers: [
      { key: 'd', label: '\\delta', unit: '', expected: 0.277 },
      { key: 'z', label: '\\zeta', unit: '', expected: 0.044 },
      { key: 'b', label: 'b', unit: 'N·s/m', expected: 12.5 },
    ],
    solve: () => {
      const d = logDecrementFromPeaks(1, 0.25, 5)
      const z = zetaFromLogDecrement(d)
      return { d, z, b: dampingForRatio(z, 5000, 4) }
    },
    working: (r) => [
      { label: 'Log decrement', tex: '\\delta = \\dfrac{1}{n}\\ln\\dfrac{x_0}{x_n}', sub: '\\tfrac{1}{5}\\ln4', result: `= ${n(r.d, 3)}`, cite: SRC.ln518('log decrement') },
      { label: 'Damping ratio', tex: '\\zeta = \\dfrac{\\delta}{\\sqrt{4\\pi^2 + \\delta^2}}', result: `= ${n(r.z, 3)}` },
      { label: 'Damping coefficient', tex: 'b = 2\\zeta\\sqrt{m k}', sub: `2\\times${n(r.z, 3)}\\sqrt{4\\times5000}`, result: `= ${n(r.b)}\\ \\text{N·s/m}` },
    ],
    cite: SRC.ln518('log decrement example'),
    params: { m: 4, k: 5000, c: 12.5, mode: 'free', x0: 0.02 },
  },
  {
    id: '518-compressor-isolation',
    course: 'AEE518',
    topic: 'Vibration isolation',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Isolating a compressor',
    statement:
      'A 450 kg compressor runs at 1750 rpm; its 10 kg reciprocating mass moves on a 100 mm crank. The mounts have ζ = 0.15 and only 20 % of the shaking force may be transmitted. Find the frequency ratio, the natural frequency, the mount stiffness, the transmitted force and the isolation efficiency.',
    answers: [
      { key: 'r', label: 'r', unit: '', expected: 2.72 },
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 67.4 },
      { key: 'k', label: 'k', unit: 'kN/m', expected: 2042 },
      { key: 'FT', label: 'F_T', unit: 'kN', expected: 6.72 },
      { key: 'eff', label: '\\eta_{iso}', unit: '%', expected: 80 },
    ],
    solve: () => {
      const w = (1750 * 2 * Math.PI) / 60
      const r = ratioForTransmissibility(0.2, 0.15)
      const wn = w / r
      return { r, wn, k: (450 * wn * wn) / 1000, FT: (0.2 * unbalanceForce(10, 0.1, w)) / 1000, eff: isolationEfficiency(0.2) }
    },
    working: (r) => [
      { label: 'Frequency ratio for TR = 0.2', tex: 'TR = \\sqrt{\\dfrac{1 + (2\\zeta r)^2}{(1 - r^2)^2 + (2\\zeta r)^2}} = 0.2', result: `r = ${n(r.r, 3)}`, cite: SRC.ln518('transmissibility') },
      { label: 'Natural frequency and stiffness', tex: '\\omega_n = \\omega/r,\\quad k = m\\omega_n^2', sub: `183.3/${n(r.r, 3)},\\ 450\\times${n(r.wn, 3)}^2`, result: `= ${n(r.wn, 3)}\\ \\text{rad/s},\\ ${n(r.k)}\\ \\text{kN/m}` },
      { label: 'Transmitted force', tex: 'F_T = TR\\cdot m e\\omega^2', sub: '0.2\\times10\\times0.1\\times183.3^2', result: `= ${n(r.FT)}\\ \\text{kN}` },
      { label: 'Isolation efficiency', tex: '(1 - TR)\\times100', result: `= ${n(r.eff)}\\,\\%` },
    ],
    cite: SRC.ln518('compressor isolation example'),
  },
  {
    id: '518-hopper',
    course: 'AEE518',
    topic: 'Forced vibration',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Hopper shaker at resonance',
    statement: 'A 400 kg hopper on springs of total stiffness 39.5 MN/m with damping 100 N·s/m is shaken by 75 N at 50 Hz. Find the natural frequency, the damping ratio and the steady amplitude.',
    answers: [
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 314.2 },
      { key: 'z', label: '\\zeta', unit: '×10⁻⁴', expected: 3.98 },
      { key: 'X', label: 'X', unit: 'mm', expected: 1.97 },
    ],
    solve: () => ({
      wn: naturalFrequency(39.5e6, 400),
      z: dampingRatio(100, 39.5e6, 400) * 1e4,
      X: forcedAmplitude(75, 400, 100, 39.5e6, 2 * Math.PI * 50) * 1000,
    }),
    working: (r) => [
      { label: 'Natural frequency', tex: '\\omega_n = \\sqrt{k/m}', sub: '\\sqrt{39.5\\times10^6/400}', result: `= ${n(r.wn)}\\ \\text{rad/s} \\approx \\omega = 314.16`, cite: SRC.ln518('forced vibration') },
      { label: 'Damping ratio', tex: '\\zeta = \\dfrac{b}{2\\sqrt{km}}', result: `= ${n(r.z, 3)}\\times10^{-4}` },
      { label: 'Amplitude (r ≈ 1)', tex: 'X = \\dfrac{F_0/k}{\\sqrt{(1-r^2)^2 + (2\\zeta r)^2}} \\approx \\dfrac{F_0}{b\\,\\omega}', result: `= ${n(r.X, 3)}\\ \\text{mm}` },
    ],
    cite: SRC.ln518('exam 2016/17; marking guide 2018/19'),
  },
  {
    id: '518-cantilever',
    course: 'AEE518',
    topic: 'Equivalent systems',
    moduleId: 'vibration',
    sceneId: 'isolation',
    title: 'Machine on a cantilever',
    statement:
      'A 900 N machine sits at the free end of a steel cantilever 2 m long, 20 mm wide and 40 mm deep (E = 207 GPa, ρ = 7850 kg/m³). Using an effective mass M + 0.23 m_beam, find the stiffness, the effective mass and the natural frequency.',
    answers: [
      { key: 'k', label: 'k_e', unit: 'N/m', expected: 8280 },
      { key: 'Me', label: 'M_e', unit: 'kg', expected: 94.63 },
      { key: 'wn', label: '\\omega_n', unit: 'rad/s', expected: 9.35 },
    ],
    solve: () => {
      const k = cantileverStiffness(207e9, rectSecondMoment(0.02, 0.04), 2)
      const Me = cantileverEffectiveMass(900 / 9.81, 0.02 * 0.04 * 2 * 7850)
      return { k, Me, wn: naturalFrequency(k, Me) }
    },
    working: (r) => [
      { label: 'Stiffness', tex: 'k_e = \\dfrac{3EI}{L^3},\\quad I = \\dfrac{bh^3}{12}', sub: '\\dfrac{3\\times207\\times10^9\\times1.067\\times10^{-7}}{8}', result: `= ${n(r.k)}\\ \\text{N/m}`, cite: SRC.ln518('equivalent systems'), errata: 'The notes use E = 2.07×10¹³ and get ωₙ = 93.5 rad/s.' },
      { label: 'Effective mass', tex: 'M_e = \\dfrac{W}{g} + 0.23\\,m_{beam}', sub: '\\dfrac{900}{9.81} + 0.23\\times12.56', result: `= ${n(r.Me)}\\ \\text{kg}` },
      { label: 'Natural frequency', tex: '\\omega_n = \\sqrt{k_e/M_e}', result: `= ${n(r.wn)}\\ \\text{rad/s}` },
    ],
    cite: SRC.ln518('equivalent systems example'),
    errata: 'cantilever-E',
  },
]
