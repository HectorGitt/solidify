import { useMemo, useState } from 'react'
import { ERRATA } from '@/content/errata'
import {
  cantileverEffectiveMass,
  cantileverStiffness,
  criticalDamping,
  dampingForRatio,
  isolationEfficiency,
  magnification,
  polyRoots,
  ratioForTransmissibility,
  rectSecondMoment,
  routhHurwitz,
  stableGainRange,
  transmissibility,
  unbalanceForce,
} from '@/physics/vibration'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { LogSlider, Note, NumberField, PresetGrid, Table, type Preset } from '../_shared/ui'
import { C, COMPRESSOR, HOPPER, analyse, live, useIso, type ForceKind, type IsoParams, type Machine } from './model'

const set = (p: Partial<IsoParams>) => useIso.getState().set(p)

const PRESETS: Preset[] = [
  {
    id: 'compressor',
    label: 'Compressor on isolators',
    note: '450 kg, 1750 rpm (183.3 rad/s), 10 kg reciprocating mass on a 100 mm crank, ζ = 0.15, wanted TR = 0.2. Expect r = 2.72, ω_n = 67.4 rad/s, k = 2042 kN/m, F_T = 6.72 kN.',
    apply: () => set(COMPRESSOR),
  },
  {
    id: 'hopper',
    label: 'Exam · hopper shaker',
    note: 'Exam 2016/17; marking guides 2016/17 and 2018/19. 400 kg hopper, k = 39.5 MN/m, b = 100 N·s/m, 75 N at 50 Hz. ω_n = √(39.5×10⁶/400) = 314.2 rad/s against ω = 314.16 rad/s: r ≈ 1.000, ζ = 4×10⁻⁴, X ≈ 1.97 mm — it runs at resonance.',
    apply: () => set(HOPPER),
  },
  {
    id: 'hopper-fixed',
    label: 'Hopper · softer mounts',
    note: 'Same hopper and force with mounts chosen for TR = 0.2 at ζ = 0.05: r = 2.48, so k = M(ω/r)² ≈ 6.42 MN/m. The amplitude drops from 1.97 mm to about 0.002 mm and 80 % of the force is isolated (a shaker is meant to shake, so in practice it is the support that is isolated).',
    apply: () => {
      const r = ratioForTransmissibility(0.2, 0.05)
      const w = 2 * Math.PI * 50
      const k = 400 * (w / r) ** 2
      set({ ...HOPPER, k: Math.round(k), c: Number(dampingForRatio(0.05, k, 400).toPrecision(4)), r })
    },
  },
  {
    id: 'resonance',
    label: 'Compressor at resonance',
    note: 'The compressor run at r = 1 (start-up passes through here). TR = √(1 + 4ζ²)/(2ζ) = 3.48 at ζ = 0.15: the mounts now amplify the force they were meant to isolate.',
    apply: () => set({ ...COMPRESSOR, r: 1 }),
  },
  {
    id: 'cantilever',
    label: 'Machine on a cantilever',
    note: '900 N machine on a 2 × 4 × 200 cm steel cantilever, F = 300 sin 8t, undamped. M_e = 900/9.81 + 0.23 m_s = 94.63 kg; with E = 207 GPa, k_e = 3EI/L³ = 8.28 kN/m and ω_n = 9.35 rad/s, so r = 8/9.35 = 0.86 and X ≈ 0.135 m — close to resonance.',
    flag: ERRATA.find((e) => e.id === 'cantilever-E')!.correct + ' The notes use E = 2.07×10¹³ N/m² and get ω_n = 93.5 rad/s.',
    apply: () => {
      const Me = cantileverEffectiveMass(900 / 9.81, 0.02 * 0.04 * 2 * 7850)
      const k = cantileverStiffness(207e9, rectSecondMoment(0.02, 0.04), 2)
      set({ ...HOPPER, machine: 'compressor', M: Number(Me.toFixed(2)), k: Math.round(k), c: 1, force: 'constant', F0: 300, r: 8 / Math.sqrt(k / Me) })
    },
  },
]

const ROUTH_CASES: { label: string; desc: number[]; note: string; flag?: string }[] = [
  { label: 'D³ + 4D² + 8D + 12', desc: [1, 4, 8, 12], note: 'All Rᵢ > 0: stable.' },
  { label: '2D³ + 4D² + 4D + 12', desc: [2, 4, 4, 12], note: 'R₂ = 4·4 − 2·12 = −8, unstable.' },
  { label: '7D⁴ + 3D³ + 8D² + 5D + 9', desc: [7, 3, 8, 5, 9], note: 'R₃ < 0, unstable.', flag: '5(24 − 35) = −55, so R₃ = −55 − 81 = −136. Still unstable.' },
  { label: 'D⁴ + 6D³ + 11D² + 6D + K', desc: [1, 6, 11, 6, 5], note: 'R₃ = 360 − 36K > 0 and K > 0, so stable for 0 < K < 10.' },
]

/** Routh–Hurwitz checker with the notes' determinants and the roots on the s-plane. */
function Routh() {
  const [desc, setDesc] = useState<number[]>(ROUTH_CASES[0].desc)
  const [which, setWhich] = useState(0)
  const r = routhHurwitz(desc)
  const roots = polyRoots(desc)
  const isK = which === 3
  const kRange = isK ? stableGainRange([1, 6, 11, 6], -2, 15, 1700) : null
  const W = 220
  const H = 150
  const span = Math.max(2, ...roots.map((z) => Math.max(Math.abs(z.re), Math.abs(z.im)))) * 1.25
  const sx = (v: number) => W / 2 + (v / span) * (W / 2 - 10)
  const sy = (v: number) => H / 2 - (v / span) * (H / 2 - 10)
  const powers = desc.map((_, i) => desc.length - 1 - i)
  return (
    <Section title="Stability: Routh’s criterion">
      <div className="grid grid-cols-2 gap-1.5">
        {ROUTH_CASES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => {
              setWhich(i)
              setDesc(c.desc)
            }}
            className={`rounded-md border px-2 py-1 text-left font-mono text-[11px] ${which === i ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {desc.map((c, i) => (
          <NumberField
            key={`${which}-${i}`}
            label={`a${powers[i]} (D${powers[i] > 1 ? superscript(powers[i]) : powers[i] === 1 ? '' : '⁰'})`}
            value={c}
            step={isK && i === desc.length - 1 ? 0.5 : 1}
            onChange={(v) => setDesc(desc.map((d, j) => (j === i ? v : d)))}
          />
        ))}
      </div>
      <Table
        head={['Test', 'Value', '']}
        rows={[
          ['All coefficients same sign', r.sameSign ? 'yes' : 'no', r.sameSign ? '✓' : '✗'],
          ...r.R.map((v, i) => [`R${i + 1}`, fmt(v, 4), v > 0 ? '✓' : '✗']),
        ]}
      />
      <p className={`mt-1 text-[12px] ${r.stable ? 'text-accent' : 'text-warn'}`}>{r.stable ? 'Stable — every root has a negative real part.' : 'Unstable — a root lies on or right of the imaginary axis.'}</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-1" role="img" aria-label="s-plane">
        <rect x={0} y={0} width={W / 2} height={H} fill="rgba(155,209,122,0.07)" />
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#34433b" />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#34433b" />
        <text x={W - 4} y={H / 2 - 4} fontSize={9} fill="#93a59a" textAnchor="end">
          Re
        </text>
        <text x={W / 2 + 4} y={10} fontSize={9} fill="#93a59a">
          Im
        </text>
        {roots.map((z, i) => (
          <g key={i} stroke={z.re < 0 ? '#9bd17a' : '#f08a3c'} strokeWidth={2}>
            <line x1={sx(z.re) - 4} y1={sy(z.im) - 4} x2={sx(z.re) + 4} y2={sy(z.im) + 4} />
            <line x1={sx(z.re) - 4} y1={sy(z.im) + 4} x2={sx(z.re) + 4} y2={sy(z.im) - 4} />
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-dim">Roots: {roots.map((z) => `${fmt(z.re, 3)}${Math.abs(z.im) > 1e-9 ? ` ${z.im < 0 ? '−' : '+'} ${fmt(Math.abs(z.im), 3)}j` : ''}`).join(', ')} (shaded: stable half-plane).</p>
      <Note>{ROUTH_CASES[which].note}</Note>
      {kRange ? <Note tone="info">Scanning K: stable from K ≈ {fmt(kRange.from, 2)} to {fmt(kRange.to, 3)}.</Note> : null}
      {ROUTH_CASES[which].flag ? <Note tone="warn">Check: {ROUTH_CASES[which].flag}</Note> : null}
      <Note>R₁ = a₁, R₂ = |a₁ a₀; a₃ a₂|, R₃ = |a₁ a₀ 0; a₃ a₂ a₁; a₅ a₄ a₃| (Hurwitz determinants).</Note>
    </Section>
  )
}

const superscript = (k: number) => String(k).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])

function useP() {
  const s = useIso()
  return useMemo(() => ({ machine: s.machine, M: s.M, k: s.k, c: s.c, force: s.force, mu: s.mu, e: s.e, F0: s.F0, r: s.r, targetTR: s.targetTR }), [s])
}

function LivePanel() {
  const p = useP()
  const a = analyse(p)
  const v = useLive(() => ({ ...live }), 15, (x, y) => x.theta === y.theta)
  const good = a.TR < 1
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Speed" value={fmt(a.rpm, 4)} unit="rpm" />
        <Readout label="r = ω/ω_n" value={fmt(p.r, 3)} tone={Math.abs(p.r - 1) < 0.15 ? 'warn' : 'ink'} />
        <Readout label="ζ" value={fmt(a.zeta, 2)} />
        <Readout label="Exciting force F₀" value={fmt(a.F0 / 1000, 3)} unit="kN" />
        <Readout label="Transmitted F_T" value={fmt(a.FT / 1000, 3)} unit="kN" tone={good ? 'accent' : 'warn'} />
        <Readout label="Amplitude X" value={fmt(a.X * 1000, 3)} unit="mm" tone={a.X > 0.01 ? 'warn' : 'ink'} />
        <Readout label="TR" value={fmt(a.TR, 3)} tone={good ? 'accent' : 'warn'} />
        <Readout label="Isolation" value={fmt(a.eff, 3)} unit="%" tone={good ? 'accent' : 'warn'} />
        <Readout label="Floor force now" value={fmt(v.FT / 1000, 2)} unit="kN" />
      </div>
      <Note>
        Orange arrow: exciting force F(t) on the machine. Blue arrows: force through the mounts into the foundation (same scale). Motion drawn ×8.
        {Math.abs(p.r - 1) < 0.05 ? ' Running at resonance!' : ''}
      </Note>
    </Section>
  )
}

function Controls() {
  const p = useP()
  const a = analyse(p)
  return (
    <Section title="Machine and mounts">
      <Segmented<Machine>
        value={p.machine}
        onChange={(machine) => set(machine === 'compressor' ? COMPRESSOR : HOPPER)}
        options={[
          { value: 'compressor', label: 'Compressor' },
          { value: 'hopper', label: 'Hopper shaker' },
        ]}
      />
      <Slider label="Frequency ratio r = ω/ω_n" value={p.r} min={0.05} max={5} step={0.005} onChange={(r) => set({ r })} hint="Changes the running speed; the mounts stay the same" />
      <Slider label="Damping ratio ζ" value={a.zeta} min={0} max={1} step={0.005} onChange={(z) => set({ c: Number(dampingForRatio(z, p.k, p.M).toPrecision(4)) })} />
      <LogSlider label="Mass M" value={p.M} min={10} max={5000} unit="kg" onChange={(M) => set({ M })} />
      <LogSlider label="Mount stiffness k (total)" value={p.k} min={1e4} max={1e8} unit="N/m" onChange={(k) => set({ k })} />
      <Segmented<ForceKind>
        label="Excitation"
        size="sm"
        value={p.force}
        onChange={(force) => set({ force })}
        options={[
          { value: 'unbalance', label: 'Unbalance m e ω²' },
          { value: 'constant', label: 'Fixed amplitude F₀' },
        ]}
      />
      {p.force === 'unbalance' ? (
        <>
          <LogSlider label="Unbalanced mass m" value={p.mu} min={0.05} max={50} unit="kg" onChange={(mu) => set({ mu })} />
          <Slider label="Eccentricity e (crank radius)" value={p.e * 1000} min={1} max={200} step={1} unit="mm" onChange={(v) => set({ e: v / 1000 })} />
        </>
      ) : (
        <LogSlider label="Force amplitude F₀" value={p.F0} min={1} max={1e5} unit="N" onChange={(F0) => set({ F0 })} />
      )}
      <Note>
        ω_n = {fmt(a.wn, 4)} rad/s ({fmt(a.wn / (2 * Math.PI), 3)} Hz), ω = {fmt(a.w, 4)} rad/s, c = {fmt(p.c, 4)} N·s/m.
      </Note>
    </Section>
  )
}

const ZETAS = [0, 0.15, 0.25, 0.5, 1]
const ZCOL = ['#e8794f', '#f5b942', '#9bd17a', '#6fb3e0', '#b48ce0']

function Charts() {
  const p = useP()
  const a = analyse(p)
  const tr = useMemo(() => {
    const xs: number[] = []
    const ys: number[][] = ZETAS.map(() => [])
    const cur: number[] = []
    for (let i = 0; i <= 400; i++) {
      const r = (4 * i) / 400
      xs.push(r)
      ZETAS.forEach((z, j) => ys[j].push(Math.min(transmissibility(r, z), 6)))
      cur.push(Math.min(transmissibility(r, a.zeta), 6))
    }
    return [xs, ...ys, cur]
  }, [a.zeta])
  const mf = useMemo(() => {
    const xs: number[] = []
    const m1: number[] = []
    const m2: number[] = []
    for (let i = 0; i <= 400; i++) {
      const r = (4 * i) / 400
      xs.push(r)
      m1.push(Math.min(magnification(r, a.zeta), 8))
      m2.push(Math.min(r * r * magnification(r, a.zeta), 8))
    }
    return [xs, m1, m2]
  }, [a.zeta])
  return (
    <Section title="Transmissibility and magnification">
      <Chart
        data={tr}
        series={[...ZETAS.map((z, i) => ({ label: `ζ = ${z}`, color: ZCOL[i], width: 1, dash: [3, 3] })), { label: 'current ζ', color: '#ece9e1', width: 2.25 }]}
        xLabel="Frequency ratio r = ω/ω_n"
        yLabel="TR = F_T/F₀ = X/Y"
        marker={() => [p.r, Math.min(a.TR, 6)]}
        yRange={[0, 6]}
        height={190}
      />
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-mute">
        {ZETAS.map((z, i) => (
          <span key={z}>
            <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: ZCOL[i] }} />ζ = {z}
          </span>
        ))}
        <span>
          <span className="mr-1 inline-block h-0.5 w-3 bg-ink align-middle" />ζ = {fmt(a.zeta, 2)} (current)
        </span>
      </div>
      <Note>All curves pass through TR = 1 at r = √2. Below √2 mounts amplify the force; above it they isolate, and more damping makes isolation worse.</Note>
      <div className="h-2" />
      <Chart
        data={mf}
        series={[
          { label: 'X/(F₀/k)', color: '#f5b942', width: 2 },
          { label: 'MX/(me)', color: '#6fb3e0', width: 2, dash: [5, 3] },
        ]}
        xLabel="r"
        yLabel="Magnification"
        marker={() => [p.r, Math.min(p.force === 'unbalance' ? p.r * p.r * a.MF : a.MF, 8)]}
        yRange={[0, 8]}
        height={150}
      />
      <Note>Gold: fixed-amplitude force, MF = 1/√((1 − r²)² + (2ζr)²). Blue: rotating unbalance, whose force grows as ω², so MX/(me) = r²·MF → 1 at high speed.</Note>
    </Section>
  )
}

function Design() {
  const p = useP()
  const a = analyse(p)
  const rReq = ratioForTransmissibility(p.targetTR, Math.max(a.zeta, 0))
  const wnReq = a.w / rReq
  const kReq = p.M * wnReq * wnReq
  return (
    <Section title="Select isolators">
      <Slider label="Wanted transmissibility" value={p.targetTR} min={0.02} max={0.9} step={0.01} onChange={(targetTR) => set({ targetTR })} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Needed r" value={fmt(rReq, 3)} />
        <Readout label="ω_n" value={fmt(wnReq, 3)} unit="rad/s" />
        <Readout label="k (total)" value={fmt(kReq / 1000, 4)} unit="kN/m" tone="accent" />
      </div>
      <button
        className="mt-2 rounded-md border border-line-2 px-2 py-1 text-[12px] text-ink/85 hover:border-accent/60"
        onClick={() => {
          const c = dampingForRatio(a.zeta, kReq, p.M)
          set({ k: Number(kReq.toPrecision(5)), c: Number(c.toPrecision(5)), r: rReq })
        }}
      >
        Fit these mounts (same speed, same ζ)
      </button>
      <Note>Static deflection of the mounts δ = Mg/k = {fmt(((p.M * 9.81) / kReq) * 1000, 3)} mm for this design.</Note>
    </Section>
  )
}

function IsoWorking() {
  const p = useP()
  const a = analyse(p)
  const steps: WorkingStep[] = [
    {
      label: 'Natural frequency and damping ratio of the mounted machine',
      tex: '\\omega_n = \\sqrt{k/M},\\quad \\zeta = \\dfrac{c}{2\\sqrt{kM}}',
      sub: `\\omega_n = \\sqrt{${n(p.k)}/${n(p.M)}},\\quad \\zeta = \\dfrac{${n(p.c)}}{${n(criticalDamping(p.k, p.M))}}`,
      result: `\\omega_n = ${n(a.wn)}\\ \\text{rad/s},\\quad \\zeta = ${n(a.zeta, 3)}`,
      cite: C.ln('vibration isolation'),
    },
    {
      label: 'Operating speed and frequency ratio',
      tex: '\\omega = \\dfrac{2\\pi N}{60},\\quad r = \\omega/\\omega_n',
      sub: `\\omega = \\dfrac{2\\pi\\times${n(a.rpm)}}{60}`,
      result: `\\omega = ${n(a.w)}\\ \\text{rad/s},\\quad r = ${n(p.r)}`,
      cite: C.ln('compressor example'),
    },
  ]
  if (p.force === 'unbalance')
    steps.push({
      label: 'Exciting force from the unbalance',
      tex: 'F_0 = m\\,e\\,\\omega^2',
      sub: `= ${n(p.mu)}\\times${n(p.e)}\\times${n(a.w)}^2`,
      result: `= ${n(unbalanceForce(p.mu, p.e, a.w))}\\ \\text{N}`,
      cite: C.ln('compressor: 10 kg on a 100 mm crank'),
    })
  steps.push(
    {
      label: 'Steady amplitude of the machine',
      tex: 'X = \\dfrac{F_0}{\\sqrt{(k-M\\omega^2)^2+(c\\omega)^2}}',
      sub: `= \\dfrac{${n(a.F0)}}{\\sqrt{(${n(p.k)}-${n(p.M)}\\times${n(a.w)}^2)^2+(${n(p.c)}\\times${n(a.w)})^2}}`,
      result: `= ${n(a.X * 1000)}\\ \\text{mm}`,
      cite: p.machine === 'hopper' ? C.mg18('X ≈ 1.97 mm') : C.ln('steady amplitude'),
    },
    {
      label: 'Transmissibility',
      tex: 'TR = \\dfrac{F_T}{F_0} = \\dfrac{\\sqrt{1+(2\\zeta r)^2}}{\\sqrt{(1-r^2)^2+(2\\zeta r)^2}}',
      sub: `= \\dfrac{\\sqrt{1+(2\\times${n(a.zeta, 3)}\\times${n(p.r)})^2}}{\\sqrt{(1-${n(p.r)}^2)^2+(2\\times${n(a.zeta, 3)}\\times${n(p.r)})^2}}`,
      result: `TR = ${n(a.TR)}`,
      cite: C.ln('TR, rigid support or base motion'),
    },
    {
      label: 'Transmitted force and isolation efficiency',
      tex: 'F_T = TR\\cdot F_0,\\quad \\eta_{iso} = (1-TR)\\times100\\,\\%',
      sub: `F_T = ${n(a.TR)}\\times${n(a.F0)}`,
      result: `F_T = ${n(a.FT)}\\ \\text{N},\\quad \\eta_{iso} = ${n(isolationEfficiency(a.TR), 3)}\\,\\%`,
      cite: C.ln('isolation efficiency'),
    },
  )
  if (p.machine === 'compressor')
    steps.push({
      label: 'Design: mounts for a wanted TR (solve eq for r, then k = Mω_n²)',
      tex: 'TR^2\\left[(1-r^2)^2+4\\zeta^2r^2\\right] = 1+4\\zeta^2r^2',
      sub: `TR = ${n(p.targetTR)},\\ \\zeta = ${n(a.zeta, 3)}\\Rightarrow r = ${n(ratioForTransmissibility(p.targetTR, a.zeta))}`,
      result: `k = ${n(p.M)}\\left(\\dfrac{${n(a.w)}}{${n(ratioForTransmissibility(p.targetTR, a.zeta))}}\\right)^2 = ${n((p.M * (a.w / ratioForTransmissibility(p.targetTR, a.zeta)) ** 2) / 1000)}\\ \\text{kN/m}`,
      cite: C.ln('compressor example: k = 2042 kN/m'),
    })
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <Design />
      <IsoWorking />
      <Routh />
    </div>
  )
}
