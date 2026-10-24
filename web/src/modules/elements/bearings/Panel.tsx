import { useMemo, useState } from 'react'
import { afbmaStatic, medianOverL10, ratingLife, staticEquivalentLoad, stribeckBall, survival } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, NumberField, PresetGrid, Table, type Preset } from '../_shared/PanelBits'
import { DEFAULTS, TYPES, cageOmega, lifeResult, useBearings, type BearingParams, type BearingType } from './model'

const set = (p: Partial<BearingParams>) => useBearings.getState().set(p)
const base = (p: Partial<BearingParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'stribeck',
    label: 'Stribeck · 208, 9 × 12 mm',
    note: 'Exam 2015/16 Q4c: C₀ = KZD²/5 = 60.8×10⁶ × 9 × (0.012)²/5 = 15 760 N. SKF 6208: 16 600 N; RHP 6208: 15 613 N.',
    apply: () => base({ type: 'ball', K: 60.8e6, sZ: 9, sD: 0.012, rows: 1 }),
  },
  {
    id: 'afbma',
    label: 'AFBMA · f₀ = 12.26×10⁶',
    note: 'Exams 2016/17 Q4e and 2019/20: C₀ = f₀ i Z D² cos α = 12.26×10⁶ × 1 × 9 × 0.012² × cos 0° = 15 890 N.',
    apply: () => base({ type: 'ball', f0: 12.26e6, sZ: 9, sD: 0.012, rows: 1 }),
  },
  {
    id: 'double',
    label: 'Double row · 2 × 11 × 10 mm',
    note: 'Exam 2017/18 Q6c: a double-row bearing with 11 balls of 10 mm per row, Z = 22 → C₀ = 60.8×10⁶ × 22 × 0.01²/5 = 26 800 N.',
    apply: () => base({ type: 'ball', K: 60.8e6, sZ: 22, sD: 0.01, rows: 2 }),
  },
  {
    id: 'p0',
    label: 'Static equivalent load',
    note: 'Worked example: F_r = 13.2 kN, F_a = 4.4 kN, X₀ = 0.6, Y₀ = 0.5 → P₀ = 10.1 kN, but P₀ may not be less than F_r → 13.2 kN.',
    flag: 'The 2015/16 marking guide (Q4c) substitutes 13.3 kN and stops at 10.12 kN without applying the P₀ ≥ F_r rule.',
    apply: () => base({ type: 'ball', Fr: 13200, Fa: 4400, X0: 0.6, Y0: 0.5 }),
  },
]

function LivePanel() {
  const p = useBearings()
  const t = TYPES[p.type]
  const r = lifeResult(p)
  const w = (p.rpm * 2 * Math.PI) / 60
  if (p.type === 'journal')
    return (
      <Section title="Live">
        <div className="grid grid-cols-2 gap-1.5">
          <Readout label="Journal speed" value={fmt(p.rpm, 4)} unit="rpm" />
          <Readout label="Radial load" value={fmt(p.Fr / 1000, 3)} unit="kN" tone="warn" />
        </div>
        <Note>A journal bearing has no rated fatigue life: it lasts as long as the oil film separates the surfaces. Failure (seizure) is sudden.</Note>
      </Section>
    )
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Shaft" value={fmt(p.rpm, 4)} unit="rpm" />
        <Readout label="Cage" value={fmt((cageOmega(p, w) * 60) / (2 * Math.PI), 4)} unit="rpm" />
        <Readout label="Equiv. load P" value={fmt(r.P / 1000, 3)} unit="kN" tone="warn" />
        <Readout label="L10 life" value={fmt(r.L, 3)} unit="M rev" tone="accent" />
        <Readout label="L10 hours" value={fmt(r.hours, 3)} unit="h" tone="accent" />
        <Readout label="Takes" value={<span className="text-[11px]">{t.code}</span>} unit={t.takes.split(';')[0]} />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useBearings()
  const t = TYPES[p.type]
  return (
    <Section title="Bearing">
      <ModeTabs<BearingType>
        value={p.type}
        onChange={(type) => set({ type, C: TYPES[type].C || p.C, Fa: type === 'thrust' ? Math.max(p.Fa, 2000) : p.Fa })}
        options={(Object.keys(TYPES) as BearingType[]).map((k) => ({ value: k, label: TYPES[k].label }))}
      />
      <Note>{t.takes.charAt(0).toUpperCase() + t.takes.slice(1)}.</Note>
      <div className="h-1" />
      <Slider label="Shaft speed" value={p.rpm} min={0} max={3000} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
      {p.type !== 'thrust' ? <Slider label="Radial load Fᵣ" value={p.Fr / 1000} min={0} max={20} step={0.1} unit="kN" onChange={(v) => set({ Fr: v * 1000 })} /> : null}
      {p.type !== 'journal' ? <Slider label="Thrust load Fₐ" value={p.Fa / 1000} min={0} max={20} step={0.1} unit="kN" onChange={(v) => set({ Fa: v * 1000 })} /> : null}
      {p.type !== 'journal' && p.type !== 'thrust' ? (
        <>
          <Segmented<'inner' | 'outer'>
            label="Ring that turns relative to the load"
            value={p.ring}
            onChange={(ring) => set({ ring })}
            options={[
              { value: 'inner', label: 'Inner (V = 1.0)' },
              { value: 'outer', label: 'Inner stationary (V = 1.2)' },
            ]}
          />
          <NumberField label="Radial factor X" value={p.X} onChange={(X) => set({ X })} step={0.01} />
          <NumberField label="Thrust factor Y" value={p.Y} onChange={(Y) => set({ Y })} step={0.05} />
        </>
      ) : null}
      {p.type !== 'journal' ? <NumberField label="Basic dynamic rating C" value={p.C / 1000} onChange={(v) => set({ C: v * 1000 })} unit="kN" step={0.1} hint={`Typical catalogue value for ${t.code}: ${t.C / 1000} kN`} /> : null}
      <Toggle label="Show load arrows" checked={p.showLoads} onChange={(showLoads) => set({ showLoads })} />
    </Section>
  )
}

function StaticCapacity() {
  const p = useBearings()
  const c0 = stribeckBall(p.K, p.sZ, p.sD)
  const af = afbmaStatic(p.f0, p.rows === 2 ? 2 : 1, p.rows === 2 ? p.sZ / 2 : p.sZ, p.sD)
  const eq = staticEquivalentLoad(p.X0, p.Y0, p.Fr, p.Fa)
  const steps: WorkingStep[] = [
    { label: 'Stribeck static capacity (balls)', tex: 'C_0=\\dfrac{KZD^2}{5}', sub: `=\\dfrac{${n(p.K, 3)}\\times${p.sZ}\\times(${n(p.sD, 3)})^2}{5}`, result: `=${n(c0, 5)}\\ \\text{N}`, cite: A503.m(7, 'slide 17, Example 1') },
    { label: 'AFBMA basic static rating', tex: 'C_0=f_0\\,i\\,Z\\,D^2\\cos\\alpha', sub: `=${n(p.f0, 4)}(${p.rows === 2 ? 2 : 1})(${p.rows === 2 ? p.sZ / 2 : p.sZ})(${n(p.sD, 3)})^2\\cos 0^\\circ`, result: `=${n(af, 5)}\\ \\text{N}`, cite: A503.m(7, 'slide 16, Example 1c') },
    { label: 'Static equivalent load', tex: 'P_0=X_0F_r+Y_0F_a\\ \\ (\\ge F_r)', sub: `=${p.X0}(${n(p.Fr / 1000, 4)})+${p.Y0}(${n(p.Fa / 1000, 4)})=${n(eq.raw / 1000, 4)}\\ \\text{kN}`, result: `P_0=${n(eq.P0 / 1000, 4)}\\ \\text{kN}${eq.governedByFr ? '\\ (=F_r)' : ''}`, cite: A503.m(7, 'slide 18, Example 2') },
  ]
  return (
    <Section title="Static capacity — working">
      <NumberField label="Stribeck K" value={p.K / 1e6} onChange={(v) => set({ K: v * 1e6 })} unit="×10⁶" step={0.1} />
      <NumberField label="AFBMA f₀" value={p.f0 / 1e6} onChange={(v) => set({ f0: v * 1e6 })} unit="×10⁶" step={0.01} />
      <NumberField label="Balls Z (all rows)" value={p.sZ} onChange={(sZ) => set({ sZ: Math.max(1, Math.round(sZ)) })} step={1} />
      <NumberField label="Ball diameter D" value={p.sD * 1000} onChange={(v) => set({ sD: v / 1000 })} unit="mm" step={0.5} />
      <NumberField label="X₀" value={p.X0} onChange={(X0) => set({ X0 })} step={0.05} />
      <NumberField label="Y₀" value={p.Y0} onChange={(Y0) => set({ Y0 })} step={0.05} />
      <Working steps={steps} />
    </Section>
  )
}

function LifeWorking() {
  const p = useBearings()
  if (p.type === 'journal') return null
  const r = lifeResult(p)
  const steps: WorkingStep[] = []
  if (p.type === 'thrust') steps.push({ label: 'Equivalent load (pure thrust bearing)', tex: 'P=F_a', result: `=${n(r.P, 4)}\\ \\text{N}`, cite: A503.beyond('thrust bearing equivalent load') , beyond: true })
  else steps.push({ label: 'Dynamic equivalent load', tex: 'P=XVF_r+YF_a', sub: `=${p.X}(${r.V})(${n(p.Fr, 4)})+${p.Y}(${n(p.Fa, 4)})`, result: `=${n(r.P, 4)}\\ \\text{N}`, cite: A503.m(7, 'slide 22') })
  steps.push({
    label: 'Rating (L10) life',
    tex: r.exponent === 3 ? 'L=\\left(\\dfrac{C}{P}\\right)^3\\ \\text{million rev}' : 'L=\\left(\\dfrac{C}{P}\\right)^{10/3}\\ \\text{million rev}',
    sub: `=\\left(\\dfrac{${n(p.C, 4)}}{${n(r.P, 4)}}\\right)^{${r.exponent === 3 ? 3 : '10/3'}}`,
    result: `=${n(r.L, 4)}\\times10^6\\ \\text{rev}`,
    cite: r.exponent === 3 ? A503.m(7, 'slides 18, 21') : A503.beyond('roller life exponent 10/3'),
    beyond: r.exponent !== 3,
  })
  steps.push({ label: 'In hours at constant speed', tex: 'L_h=\\dfrac{L\\times10^6}{60N}', sub: `=\\dfrac{${n(r.L, 4)}\\times10^6}{60\\times${p.rpm}}`, result: `=${n(r.hours, 4)}\\ \\text{h}`, cite: A503.m(7, 'slide 19 — life in hours at a given speed') })
  return (
    <Section title="Dynamic capacity & life — working">
      <Working steps={steps} />
      <Note>Rating (minimum) life: 90 % of a group of identical bearings reach or exceed it. Median life: 50 % have failed. The dynamic rating C = f_c(i cos α)^0.7 Z^(2/3) D^1.8 needs f_c from tables, so C is entered from a catalogue here.</Note>
    </Section>
  )
}

function Charts() {
  const p = useBearings()
  const r = lifeResult(p)
  const life = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 60; i++) {
      const P = p.C * (0.05 + (i / 60) * 0.95)
      xs.push(P / 1000)
      ys.push(ratingLife(p.C, P, r.exponent))
    }
    return [xs, ys]
  }, [p.C, r.exponent])
  const surv = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 80; i++) {
      const x = (i / 80) * 8
      xs.push(x)
      ys.push(survival(x, 1) * 100)
    }
    return [xs, ys]
  }, [])
  if (p.type === 'journal') return null
  return (
    <Section title="Life charts">
      <Chart data={life} series={[{ label: 'L', color: '#9bd17a', width: 2 }]} xLabel="Equivalent load P (kN)" yLabel="L10 (million rev)" logY marker={() => [r.P / 1000, r.L]} height={150} />
      <Note>Halve the load and the life grows 2³ = 8 times.</Note>
      <div className="h-2" />
      <Chart data={surv} series={[{ label: 'surviving', color: '#6fb3e0', width: 2 }]} xLabel="Life / L10" yLabel="Bearings still running (%)" marker={() => [1, 90]} height={130} />
      <Note>Fatigue lives scatter (Weibull, slope 1.5). 90 % survive to L10; the median life is about {fmt(medianOverL10(), 3)} × L10.</Note>
    </Section>
  )
}

function Comparison() {
  return (
    <Section title="Rolling vs journal bearings">
      <Table
        head={['', 'Rolling', 'Journal']}
        rows={[
          ['Starting torque', 'low — preferred', 'high'],
          ['Noise at speed', 'noisier', 'quiet'],
          ['Space', 'short axially', 'small radially'],
          ['Failure', 'warns (noisy)', 'sudden'],
          ['Loads', 'radial + thrust*', 'radial'],
          ['Other', 'preload; prepacked grease; short overloads', 'needs reliable oil supply'],
        ]}
      />
      <Note>* except the straight roller bearing. Deep groove: small/medium loads; tapered: heavy loads; self-aligning: misalignment; angular contact: heavy thrust.</Note>
    </Section>
  )
}

export function BearingsPanel() {
  const [preset, setPreset] = useState<string | null>('stribeck')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <StaticCapacity />
      <LifeWorking />
      <Charts />
      <Comparison />
    </div>
  )
}
