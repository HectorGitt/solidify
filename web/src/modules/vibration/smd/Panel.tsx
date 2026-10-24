import { useMemo, useState } from 'react'
import {
  characteristicRoots,
  criticalDamping,
  dampedFrequency,
  dampingCase,
  dampingForRatio,
  forcedAmplitude,
  forcedPhase,
  logDecrement,
  logDecrementFromPeaks,
  magnification,
  positivePeaks,
  zetaFromLogDecrement,
  type DampingCase,
} from '@/physics/vibration'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { LogSlider, Note, PresetGrid, type Preset } from '../_shared/ui'
import { C, DEFAULTS, getRun, live, pick, useSmd, type InputMode, type SmdParams } from './model'

const CASE_LABEL: Record<DampingCase, string> = { undamped: 'Undamped', underdamped: 'Underdamped', critical: 'Critically damped', overdamped: 'Overdamped' }
const CASE_TONE: Record<DampingCase, 'warn' | 'accent' | 'info' | 'ink'> = { undamped: 'warn', underdamped: 'accent', critical: 'info', overdamped: 'ink' }

const set = (p: Partial<SmdParams>) => useSmd.getState().set(p)

const PRESETS: Preset[] = [
  {
    id: 'step',
    label: 'Exam · θ̈ + 10θ̇ + 16θ = 32u',
    note: 'Exam 2016/17; marking scheme 2017/18; marking guide 2018/19. a₂ = 1, a₁ = 10, a₀ = 16, unit step × 32. Expect ω_n = 4 rad/s, ζ = 1.25 (overdamped), roots −2 and −8, θ = 2 + (2/3)e^(−8t) − (8/3)e^(−2t) → 2.',
    apply: () => set({ m: 1, c: 10, k: 16, mode: 'step', F0: 32 }),
  },
  {
    id: 'logdec',
    label: 'Log decrement',
    note: 'm = 4 kg, k = 5 kN/m; the amplitude falls to ¼ in 5 cycles. Expect δ = (1/5) ln 4 = 0.277, ζ = 0.044, b = 2ζ√(mk) = 12.5 N·s/m. Count five peaks on the chart.',
    apply: () => set({ m: 4, k: 5000, c: 12.5, mode: 'free', x0: 0.02 }),
  },
  {
    id: 'cantilever',
    label: 'Machine on cantilever',
    note: 'F = 300 sin 8t on a 900 N machine at the tip of a 2 × 4 × 200 cm steel cantilever: M_e = 94.63 kg, k = 3EI/L³ = 8.28 kN/m, ω_n = 9.35 rad/s, r = 0.856 — close to resonance. Undamped, so the start-up transient beats for ever.',
    flag: 'The notes use E = 2.07×10¹³ (a unit slip) and get k_e = 8.28×10⁵ N/m and ω_n = 93.5 rad/s. With E = 207 GPa = 2.07×10¹¹ Pa: k_e = 8.28×10³ N/m and ω_n = 9.35 rad/s.',
    apply: () => set({ m: 94.63, k: 8280, c: 0, mode: 'sine', F0: 300, w: 8 }),
  },
  {
    id: 'critical',
    label: 'Critical damping',
    note: 'Same 4 kg / 5 kN/m system with c = c_c = 2√(km) = 283 N·s/m: the fastest return to rest without overshoot — the boundary between oscillating and non-oscillating response.',
    apply: () => set({ m: 4, k: 5000, c: Number(criticalDamping(5000, 4).toPrecision(4)), mode: 'step', F0: 50 }),
  },
]

function useParams() {
  const s = useSmd()
  return useMemo(() => pick(s), [s])
}

function LivePanel() {
  const p = useParams()
  const run = getRun(p)
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.t === b.t)
  const dc = dampingCase(run.zeta)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Time" value={fmt(v.t, 3)} unit={`of ${fmt(v.tEnd, 2)} s`} />
        <Readout label="Displacement x" value={fmt(v.x * 1000, 3)} unit="mm" tone="accent" />
        <Readout label="Velocity ẋ" value={fmt(v.v, 3)} unit="m/s" />
        <Readout label="Force F" value={fmt(v.F, 3)} unit="N" />
        <Readout label="ω_n" value={fmt(run.wn, 4)} unit="rad/s" />
        <Readout label="ζ" value={fmt(run.zeta, 3)} tone={CASE_TONE[dc]} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-mute">
        <span className={`font-medium ${dc === 'undamped' ? 'text-warn' : 'text-ink'}`}>{CASE_LABEL[dc]}</span> · motion drawn ×{fmt(run.gain, 2)} · the run restarts every {fmt(run.tEnd, 2)} s
      </p>
    </Section>
  )
}

function Controls() {
  const p = useParams()
  const wn = Math.sqrt(p.k / p.m)
  const z = p.c / criticalDamping(p.k, p.m)
  return (
    <Section title="System and input">
      <Segmented<InputMode>
        value={p.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'free', label: 'Free', title: 'Released from x₀ with no force' },
          { value: 'step', label: 'Step', title: 'Force F₀·u(t) switched on at t = 0' },
          { value: 'sine', label: 'Sine', title: 'Force F₀ sin ωt' },
        ]}
      />
      <LogSlider label="Mass m" value={p.m} min={0.5} max={500} unit="kg" onChange={(m) => set({ m })} />
      <LogSlider label="Stiffness k" value={p.k} min={10} max={1e6} unit="N/m" onChange={(k) => set({ k })} />
      <LogSlider label="Damping b (c)" value={Math.max(p.c, 0.01)} min={0.01} max={1e5} unit="N·s/m" onChange={(c) => set({ c })} hint="Viscous damping coefficient" />
      <div className="-mt-1 mb-2.5 flex gap-1">
        {[
          ['ζ = 0', 0],
          ['ζ = 0.1', 0.1],
          ['ζ = 1', 1],
          ['ζ = 2', 2],
        ].map(([l, zz]) => (
          <button
            key={l as string}
            onClick={() => set({ c: Number(dampingForRatio(zz as number, p.k, p.m).toPrecision(4)) })}
            className={`flex-1 rounded border px-1 py-0.5 text-[11.5px] ${Math.abs(z - (zz as number)) < 0.005 ? 'border-accent text-accent' : 'border-line-2 text-mute hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {p.mode === 'free' ? <Slider label="Released from x₀" value={p.x0 * 1000} min={1} max={50} step={1} unit="mm" onChange={(v) => set({ x0: v / 1000 })} /> : null}
      {p.mode !== 'free' ? <LogSlider label={p.mode === 'step' ? 'Step force F₀' : 'Force amplitude F₀'} value={p.F0} min={0.1} max={5000} unit="N" onChange={(F0) => set({ F0 })} /> : null}
      {p.mode === 'sine' ? (
        <Slider label="Frequency ratio r = ω/ω_n" value={p.w / wn} min={0.05} max={4} step={0.01} onChange={(r) => set({ w: Number((r * wn).toPrecision(4)) })} hint={`ω = ${fmt(p.w, 4)} rad/s`} />
      ) : null}
      {p.mode === 'sine' ? <Note>ω = {fmt(p.w, 4)} rad/s ({fmt(p.w / (2 * Math.PI), 3)} Hz)</Note> : null}
      <button className="mt-1 text-[11.5px] text-info hover:underline" onClick={() => useSmd.getState().set(DEFAULTS)}>
        Reset
      </button>
    </Section>
  )
}

function ResponseChart() {
  const p = useParams()
  const run = getRun(p)
  const data = useMemo(() => {
    const t = run.trace.t
    const x = run.trace.x.map((v) => v * 1000)
    const zeta = run.zeta
    if (p.mode === 'free' && zeta > 0 && zeta < 1) {
      const env = t.map((tt) => p.x0 * 1000 * Math.exp(-zeta * run.wn * tt))
      return { d: [t, x, env, env.map((e) => -e)], s: 3 }
    }
    if (p.mode === 'step') return { d: [t, x, t.map(() => (p.F0 / p.k) * 1000)], s: 2 }
    if (p.mode === 'sine') {
      const X = forcedAmplitude(p.F0, p.m, p.c, p.k, p.w) * 1000
      if (Number.isFinite(X) && X < 50 * run.xMax * 1000) return { d: [t, x, t.map(() => X), t.map(() => -X)], s: 3 }
    }
    return { d: [t, x], s: 1 }
  }, [run, p])
  const series = [
    { label: 'x', color: '#9bd17a', width: 2 },
    { label: p.mode === 'step' ? 'F₀/k' : p.mode === 'sine' ? '+X' : 'envelope', color: '#6fb3e0', dash: [4, 4], width: 1.25 },
    { label: '−', color: '#6fb3e0', dash: [4, 4], width: 1.25 },
  ].slice(0, data.s)
  return (
    <Section title="Response x(t)">
      <Chart key={`${p.mode}-${data.s}`} data={data.d} series={series} xLabel="Time (s)" yLabel="x (mm)" marker={() => [live.t, live.x * 1000]} height={190} />
      <Note>
        Solid: RK4 integration of mẍ + bẋ + kx = F(t) (the same integrator moves the 3D model). Dashed:{' '}
        {p.mode === 'free' ? 'envelope x₀e^(−ζω_n t)' : p.mode === 'step' ? 'final value F₀/k' : 'steady-state amplitude ±X'}.
      </Note>
    </Section>
  )
}

function FrequencyChart() {
  const p = useParams()
  const run = getRun(p)
  const data = useMemo(() => {
    const r: number[] = []
    const mf: number[] = []
    const ref: number[] = []
    for (let i = 0; i <= 300; i++) {
      const rr = (3 * i) / 300
      r.push(rr)
      mf.push(Math.min(magnification(rr, run.zeta), 12))
      ref.push(Math.min(magnification(rr, 0.1), 12))
    }
    return [r, mf, ref]
  }, [run.zeta])
  const r = p.w / run.wn
  return (
    <Section title="Magnification factor">
      <Chart
        data={data}
        series={[
          { label: `ζ = ${fmt(run.zeta, 2)}`, color: '#f5b942', width: 2 },
          { label: 'ζ = 0.1', color: '#93a59a', dash: [3, 4], width: 1 },
        ]}
        xLabel="r = ω/ω_n"
        yLabel="X/(F₀/k)"
        marker={() => [r, Math.min(magnification(r, run.zeta), 12)]}
        height={160}
        yRange={[0, 12]}
      />
      <Note>MF = 1/√((1 − r²)² + (2ζr)²). Resonance at r = 1, where only damping limits the amplitude (curve clipped at 12). Grey: ζ = 0.1 for comparison.</Note>
    </Section>
  )
}

/** s-plane with the two characteristic roots. */
function Poles() {
  const p = useParams()
  const r = characteristicRoots(p.m, p.c, p.k)
  const wn = Math.sqrt(p.k / p.m)
  const S = 70 / Math.max(wn, Math.abs(r.re2), 1e-9)
  const W = 200
  const H = 150
  const ox = 170
  const oy = H / 2
  const pt = (re: number, im: number) => [ox + re * S * 0.9, oy - im * S * 0.9]
  const pts = [pt(r.re1, r.im1), pt(r.re2, r.im2)]
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="s-plane pole plot">
        <line x1={4} y1={oy} x2={W - 4} y2={oy} stroke="#34433b" />
        <line x1={ox} y1={6} x2={ox} y2={H - 6} stroke="#34433b" />
        <circle cx={ox} cy={oy} r={wn * S * 0.9} fill="none" stroke="#27332d" strokeDasharray="2 3" />
        <text x={W - 6} y={oy - 4} fontSize={9} fill="#93a59a" textAnchor="end">
          Re
        </text>
        <text x={ox + 4} y={12} fontSize={9} fill="#93a59a">
          Im
        </text>
        {pts.map(([x, y], i) => (
          <g key={i} stroke="#f5b942" strokeWidth={2}>
            <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
            <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} />
          </g>
        ))}
      </svg>
      <div className="space-y-1 font-mono text-[11.5px] text-mute">
        <div>
          s₁ = {fmt(r.re1, 3)}
          {r.im1 ? ` + ${fmt(r.im1, 3)}j` : ''}
        </div>
        <div>
          s₂ = {fmt(r.re2, 3)}
          {r.im2 ? ` − ${fmt(-r.im2, 3)}j` : ''}
        </div>
        <p className="font-sans text-[10.5px] leading-snug text-dim">Complex pair → oscillation at ω_d; two real roots → no oscillation. Dashed circle: radius ω_n.</p>
      </div>
    </div>
  )
}

function SmdWorking() {
  const p = useParams()
  const run = getRun(p)
  const wn = run.wn
  const z = run.zeta
  const cc = criticalDamping(p.k, p.m)
  const r = characteristicRoots(p.m, p.c, p.k)
  const steps: WorkingStep[] = [
    {
      label: 'Equation of motion (free-body diagram of the mass)',
      tex: 'm\\ddot x + b\\dot x + kx = F(t)',
      sub: `${n(p.m)}\\ddot x + ${n(p.c)}\\dot x + ${n(p.k)}x = ${p.mode === 'free' ? '0' : p.mode === 'step' ? `${n(p.F0)}\\,u(t)` : `${n(p.F0)}\\sin ${n(p.w)}t`}`,
      cite: C.m12('free-body forces bv, kx, F(t)'),
    },
    {
      label: 'Undamped natural frequency',
      tex: '\\omega_n = \\sqrt{k/m} = \\sqrt{a_0/a_2}',
      sub: `= \\sqrt{${n(p.k)}/${n(p.m)}}`,
      result: `= ${n(wn)}\\ \\text{rad/s}\\;(${n(wn / (2 * Math.PI))}\\ \\text{Hz})`,
      cite: C.ln('second-order systems'),
    },
    {
      label: 'Damping ratio',
      tex: '\\zeta = \\dfrac{b}{c_c} = \\dfrac{a_1}{2\\sqrt{a_0 a_2}},\\quad c_c = 2\\sqrt{km}',
      sub: `c_c = 2\\sqrt{${n(p.k)}\\times${n(p.m)}} = ${n(cc)},\\quad \\zeta = ${n(p.c)}/${n(cc)}`,
      result: `\\zeta = ${n(z)}\\;\\Rightarrow\\;\\text{${CASE_LABEL[dampingCase(z)].toLowerCase()}}`,
      cite: C.ln('damping ratio, four cases'),
    },
    {
      label: 'Roots of the characteristic equation',
      tex: 's = -\\zeta\\omega_n \\pm \\omega_n\\sqrt{\\zeta^2-1}',
      sub: z < 1 ? `\\omega_d = \\omega_n\\sqrt{1-\\zeta^2} = ${n(dampedFrequency(wn, z))}\\ \\text{rad/s}` : undefined,
      result: z < 1 ? `s = ${n(r.re1)} \\pm ${n(r.im1)}j` : `s_1 = ${n(r.re1)},\\; s_2 = ${n(r.re2)}`,
      cite: C.ln('roots s = −ζω_n ± jω_n√(1 − ζ²)'),
    },
  ]
  if (p.mode === 'free' && z > 0 && z < 1) {
    const pk = positivePeaks(run.trace.t, run.trace.x)
    const nc = Math.min(5, pk.length)
    steps.push({
      label: 'Logarithmic decrement',
      tex: '\\delta = \\ln\\dfrac{q_j}{q_{j+1}} = \\dfrac{1}{n}\\ln\\dfrac{q_0}{q_n} = \\dfrac{2\\pi\\zeta}{\\sqrt{1-\\zeta^2}}',
      sub:
        nc > 0
          ? `\\text{from the chart: }\\tfrac{1}{${nc}}\\ln\\dfrac{${n(p.x0 * 1000)}}{${n(pk[nc - 1][1] * 1000)}} = ${n(logDecrementFromPeaks(p.x0, pk[nc - 1][1], nc))}`
          : undefined,
      result: `\\delta = ${n(logDecrement(z))}`,
      cite: C.ln('log decrement'),
    })
    steps.push({
      label: 'Back to ζ and b from δ',
      tex: '\\zeta = \\dfrac{\\delta}{\\sqrt{4\\pi^2+\\delta^2}},\\quad b = 2\\zeta\\sqrt{mk}',
      sub: `\\zeta = ${n(zetaFromLogDecrement(logDecrement(z)))}`,
      result: `b = ${n(2 * zetaFromLogDecrement(logDecrement(z)) * Math.sqrt(p.m * p.k))}\\ \\text{N·s/m}`,
      cite: C.ln('log decrement example'),
    })
  }
  if (p.mode === 'step') {
    steps.push({
      label: 'Final (steady) value of the step response',
      tex: 'x(\\infty) = F_0/k = b_0/a_0',
      sub: `= ${n(p.F0)}/${n(p.k)}`,
      result: `= ${n((p.F0 / p.k) * 1000)}\\ \\text{mm}`,
      cite: C.ms17('θ → 2'),
    })
    if (z < 1 && z > 0)
      steps.push({
        label: 'Peak overshoot',
        tex: 'M_p = e^{-\\zeta\\pi/\\sqrt{1-\\zeta^2}}',
        result: `= ${n(Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z)) * 100)}\\,\\%`,
        beyond: true,
      })
    if (z > 1)
      steps.push({
        label: 'Overdamped step response (two decaying exponentials)',
        tex: 'x = \\dfrac{F_0}{k}\\left[1 + \\dfrac{s_2 e^{s_1 t} - s_1 e^{s_2 t}}{s_1 - s_2}\\right]',
        sub: `s_1 = ${n(r.re1)},\\; s_2 = ${n(r.re2)}`,
        result: `x = ${n(p.F0 / p.k)}\\left[1 ${signed((r.re2 / (r.re1 - r.re2)))}e^{${n(r.re1)}t} ${signed(-r.re1 / (r.re1 - r.re2))}e^{${n(r.re2)}t}\\right]`,
        cite: C.mg18('θ = 2 + (2/3)e^(−8t) − (8/3)e^(−2t)'),
      })
  }
  if (p.mode === 'sine') {
    const X = forcedAmplitude(p.F0, p.m, p.c, p.k, p.w)
    const ratio = p.w / wn
    steps.push({
      label: 'Steady-state amplitude and phase',
      tex: 'X = \\dfrac{F_0}{\\sqrt{(k-m\\omega^2)^2+(b\\omega)^2}},\\quad \\phi = \\tan^{-1}\\dfrac{b\\omega}{k-m\\omega^2}',
      sub: `= \\dfrac{${n(p.F0)}}{\\sqrt{(${n(p.k)}-${n(p.m)}\\times${n(p.w)}^2)^2+(${n(p.c)}\\times${n(p.w)})^2}}`,
      result: `X = ${n(X * 1000)}\\ \\text{mm},\\quad \\phi = ${n((forcedPhase(p.m, p.c, p.k, p.w) * 180) / Math.PI)}^\\circ`,
      cite: C.ln('vibration isolation: steady amplitude'),
    })
    steps.push({
      label: 'Magnification factor',
      tex: 'MF = \\dfrac{X}{F_0/k} = \\dfrac{1}{\\sqrt{(1-r^2)^2+(2\\zeta r)^2}}',
      sub: `r = ${n(ratio)},\\ \\zeta = ${n(z)}`,
      result: `MF = ${n(magnification(ratio, z))}`,
      cite: C.ln('resonance at r = 1'),
    })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

const signed = (v: number) => (v >= 0 ? `+ ${n(v)}` : `- ${n(-v)}`)

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  const p = useParams()
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <ResponseChart />
      {p.mode === 'sine' ? <FrequencyChart /> : null}
      <Section title="Poles on the s-plane">
        <Poles />
      </Section>
      <SmdWorking />
    </div>
  )
}
