import { useMemo, useState } from 'react'
import { IS_SIEVES, cumulativeOversize, screenEffectiveness, terminalVelocity } from '@/physics/processing'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { ModeTabs, Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { P504 } from './cites'
import { DEFAULTS, DEFAULT_RETAINED_RED, analyse, useSeparation, type Kind, type SeparationParams } from './model'

const set = (p: Partial<SeparationParams>) => useSeparation.getState().set(p)
const base = (p: Partial<SeparationParams>) => set({ ...DEFAULTS, ...p })

/** PQ p3 Q3b: cassava mash, % retained on IS 50/30/20/15/pan */
const Q3B = { feed: [16, 59, 18, 4, 3], over: [61.5, 34, 3.5, 1.0, 0], under: [3.0, 58, 23.2, 7.8, 8.0] }
const x = (k: number) => [Q3B.feed, Q3B.over, Q3B.under].map((p) => cumulativeOversize(p, k)) as [number, number, number]

export const EXAM: Preset[] = [
  {
    id: 'q3b-is30',
    label: '2017 Q3b · screen at IS 30',
    note: 'Cassava mash from a hammer mill. Cumulative oversize at IS 30: X_F = 0.75, X_A = 0.955, X_B = 0.61 → E ≈ 0.48.',
    apply: () => {
      const [XF, XA, XB] = x(1)
      base({ kind: 'cleaner', XF, XA, XB, cutMeshMm: 0.296 })
    },
  },
  {
    id: 'q3b-is15',
    label: '2017 Q3b · screen at IS 15',
    note: 'Same data at IS 15: X_F = 0.97, X_A = 1.00, X_B = 0.92 → E ≈ 0.64. (X_A = 1 is nudged to 0.9999 so the ratios stay finite.)',
    apply: () => {
      const [XF, , XB] = x(3)
      base({ kind: 'cleaner', XF, XA: 0.9999, XB, cutMeshMm: 0.157 })
    },
  },
  {
    id: 'pq5-oil',
    label: '2015/16 test · oil globule',
    note: '50 µm oil globule, ρ = 900 in water 1000 kg/m³, µ = 10⁻³ Pa·s: V = gD²Δρ/18µ = 1.36×10⁻⁴ m/s (rises). No radius or speed is given for the centrifuge; multiply by rω²/g. See the Stokes working below.',
    apply: () => base({ kind: 'cyclone' }),
  },
  {
    id: 'red-sieve',
    label: 'Sieve analysis · FM 3.12',
    note: 'Worked sieve analysis: % retained 1.0, 2.5, 7.0, 24.0, 35.5, 22.5, 7.5, 0 → FM = 3.12, UI 1:6:3.',
    apply: () => base({ kind: 'shaker', retainedMasses: [...DEFAULT_RETAINED_RED] }),
  },
  {
    id: 'winnow',
    label: 'Aspirator · grain vs chaff',
    note: 'Set the air speed between the terminal velocities of chaff and grain: chaff lifts, grain falls (aerodynamics questions, PQ p6).',
    apply: () => base({ kind: 'aspirator' }),
  },
]

function Live() {
  const p = useSeparation()
  const a = useMemo(() => analyse(p), [p])
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Screen E" value={fmt(a.eff.E, 3)} tone="accent" />
        <Readout label="Overflow A/F" value={fmt(a.split.AF, 3)} />
        <Readout label="Underflow B/F" value={fmt(a.split.BF, 3)} />
        <Readout label="Vt grain" value={fmt(a.vtGrain, 3)} unit="m/s" tone="info" />
        <Readout label="Vt chaff" value={fmt(a.vtChaff, 3)} unit="m/s" tone="info" />
        <Readout label="Aspirator" value={a.aspiratorStatus === 'ideal' ? 'separating' : a.aspiratorStatus === 'under' ? 'air too slow' : 'grain lost'} tone={a.aspiratorStatus === 'ideal' ? 'accent' : 'warn'} />
        <Readout label="Cyclone S" value={fmt(a.cForces.S, 3)} tone="warn" />
        <Readout label="Cut size" value={fmt(a.dCritUm, 3)} unit="µm" />
        <Readout label="FM / D" value={`${a.fm.toFixed(2)} / ${a.avgSizeMm.toFixed(3)}`} unit="mm" />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useSeparation()
  return (
    <Section title="Equipment">
      <ModeTabs<Kind>
        value={p.kind}
        onChange={(kind) => set({ kind })}
        options={[
          { value: 'all', label: 'Cleaning house' },
          { value: 'cleaner', label: 'Screen cleaner' },
          { value: 'aspirator', label: 'Aspirator' },
          { value: 'cyclone', label: 'Cyclone' },
          { value: 'shaker', label: 'Sieve shaker' },
        ]}
      />
      <div className="h-2" />
      {p.kind === 'cleaner' || p.kind === 'all' ? (
        <>
          <Slider label="Oversize in feed X_F" value={p.XF} min={0.05} max={0.98} step={0.005} onChange={(XF) => set({ XF })} />
          <Slider label="Oversize in overflow X_A" value={p.XA} min={0.3} max={0.9999} step={0.0001} onChange={(XA) => set({ XA })} />
          <Slider label="Oversize in underflow X_B" value={p.XB} min={0} max={0.95} step={0.005} onChange={(XB) => set({ XB })} />
          <Slider label="Feed rate F" value={p.feedRateKgS} min={0.2} max={5} step={0.1} unit="kg/s" onChange={(feedRateKgS) => set({ feedRateKgS })} />
          <Slider label="Screen slope" value={p.screenSlopeDeg} min={0} max={20} step={0.5} unit="°" onChange={(screenSlopeDeg) => set({ screenSlopeDeg })} />
          <Slider label="Crank speed" value={p.screenRpm} min={100} max={600} step={10} unit="rpm" onChange={(screenRpm) => set({ screenRpm })} />
        </>
      ) : null}
      {p.kind === 'aspirator' || p.kind === 'all' ? (
        <>
          <Slider label="Air velocity" value={p.airVelocity} min={0.5} max={15} step={0.1} unit="m/s" onChange={(airVelocity) => set({ airVelocity })} />
          <Slider label="Grain diameter" value={p.grainDiameterMm} min={1} max={10} step={0.1} unit="mm" onChange={(grainDiameterMm) => set({ grainDiameterMm })} />
          <Slider label="Grain density" value={p.grainDensity} min={600} max={1600} step={10} unit="kg/m³" onChange={(grainDensity) => set({ grainDensity })} />
          <Slider label="Chaff diameter" value={p.chaffDiameterMm} min={0.5} max={6} step={0.1} unit="mm" onChange={(chaffDiameterMm) => set({ chaffDiameterMm })} />
          <Slider label="Chaff density" value={p.chaffDensity} min={50} max={600} step={5} unit="kg/m³" onChange={(chaffDensity) => set({ chaffDensity })} />
        </>
      ) : null}
      {p.kind === 'cyclone' || p.kind === 'all' ? (
        <>
          <Slider label="Inlet velocity V" value={p.cycloneVelocity} min={5} max={30} step={0.5} unit="m/s" onChange={(cycloneVelocity) => set({ cycloneVelocity })} />
          <Slider label="Cyclone radius R" value={p.cycloneRadius} min={0.1} max={1} step={0.01} unit="m" onChange={(cycloneRadius) => set({ cycloneRadius })} />
          <Slider label="Inlet width b" value={p.cycloneInletWidth} min={0.02} max={0.3} step={0.005} unit="m" onChange={(cycloneInletWidth) => set({ cycloneInletWidth })} />
          <Slider label="Particle density" value={p.cycloneParticleDensity} min={300} max={3000} step={10} unit="kg/m³" onChange={(cycloneParticleDensity) => set({ cycloneParticleDensity })} />
        </>
      ) : null}
      {p.kind === 'shaker' ? (
        <>
          {IS_SIEVES.map((s, i) => (
            <Slider
              key={s.no}
              label={`IS ${s.no}${s.mm ? ` (${s.mm} mm)` : ''}`}
              value={p.retainedMasses[i]}
              min={0}
              max={150}
              step={0.1}
              unit="g"
              onChange={(g) => {
                const r = [...p.retainedMasses]
                r[i] = g
                set({ retainedMasses: r })
              }}
            />
          ))}
        </>
      ) : null}
    </Section>
  )
}

function Charts() {
  const p = useSeparation()
  const a = useMemo(() => analyse(p), [p])
  const vt = useMemo(() => {
    const xs: number[] = []
    const grain: number[] = []
    const chaff: number[] = []
    for (let d = 0.2; d <= 10; d += 0.2) {
      xs.push(d)
      grain.push(terminalVelocity(d / 1000, p.grainDensity, p.airDensity, p.airViscosity))
      chaff.push(terminalVelocity(d / 1000, p.chaffDensity, p.airDensity, p.airViscosity))
    }
    return { xs, grain, chaff }
  }, [p.grainDensity, p.chaffDensity, p.airDensity, p.airViscosity])
  const ef = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let xb = 0; xb < Math.min(p.XF, 0.99); xb += 0.01) {
      xs.push(xb)
      ys.push(screenEffectiveness(p.XF, p.XA, xb).E)
    }
    return { xs, ys }
  }, [p.XF, p.XA])
  return (
    <Section title="Charts">
      <Chart data={[vt.xs, vt.grain, vt.chaff]} series={[{ label: 'grain', color: '#d6b25e', width: 2 }, { label: 'chaff', color: '#9bd17a', width: 2 }]} xLabel="Particle diameter (mm)" yLabel="Terminal velocity (m/s)" marker={() => [p.grainDiameterMm, a.vtGrain]} height={150} />
      <Note>Set the air speed ({p.airVelocity} m/s) above the chaff curve and below the grain curve: chaff floats off, grain falls.</Note>
      <div className="h-2" />
      <Chart data={[ef.xs, ef.ys]} series={[{ label: 'E', color: '#6fb3e0', width: 2 }]} xLabel="Oversize in underflow X_B" yLabel="Effectiveness E" marker={() => [p.XB, a.eff.E]} height={140} />
      <Note>Oversize slipping through (higher X_B — worn screen, overload) lowers E; effectiveness falls as capacity rises.</Note>
      <div className="mt-2">
        <Table head={['Sieve', 'mm', '% ret.', 'cum. over']} rows={IS_SIEVES.map((s, i) => [s.no, s.mm.toFixed(3), a.pctRetained[i].toFixed(2), (a.cumOversize[i] * 100).toFixed(1)])} />
      </div>
    </Section>
  )
}

function CalcWorking() {
  const p = useSeparation()
  const a = useMemo(() => analyse(p), [p])
  const S = (w: string) => P504.sep(w)
  const steps: WorkingStep[] = [
    { label: 'Mass split (eqs 3–4)', tex: '\\dfrac{A}{F}=\\dfrac{X_F-X_B}{X_A-X_B},\\ \\dfrac{B}{F}=\\dfrac{X_A-X_F}{X_A-X_B}', sub: `=\\dfrac{${n(p.XF, 4)}-${n(p.XB, 4)}}{${n(p.XA, 4)}-${n(p.XB, 4)}}`, result: `A/F=${n(a.split.AF, 4)},\\ B/F=${n(a.split.BF, 4)}`, cite: S('Screen mass balance eqs 1–4'), errata: 'The extracted text of eq 3 shows X_A − X_B in the numerator of B/F; it must be X_A − X_F.' },
    { label: 'Screen effectiveness (eqs 5–9)', tex: 'E=E_AE_B=\\dfrac{(X_F-X_B)(X_A-X_F)X_A(1-X_B)}{(X_A-X_B)^2(1-X_F)X_F}', sub: `E_A=${n(a.eff.EA, 4)},\\ E_B=${n(a.eff.EB, 4)}`, result: `E=${n(a.eff.E, 4)}`, cite: S('Screen effectiveness eqs 5–9') },
    { label: 'Stokes terminal velocity (eqs 11–12)', tex: 'V=\\dfrac{gD^2(\\rho_p-\\rho_a)}{18\\mu}', sub: `\\text{grain: }=\\dfrac{9.81(${n(a.dGrainM, 3)})^2(${p.grainDensity}-${p.airDensity})}{18(${n(p.airViscosity, 3)})}`, result: `=${n(a.vtGrainStokes, 4)}\\ \\text{m/s (valid only for Re<0.1)}`, cite: S('Aerodynamics of small particles eqs 11–12') },
    { label: 'Terminal velocity with C(Re), iterated (eqs 8–10)', tex: 'V=\\sqrt{\\dfrac{2mg(\\rho_p-\\rho_a)}{C\\rho_p\\rho_aA}},\\ Re=\\dfrac{DV\\rho_a}{\\mu}', sub: `Re_{grain}=${n(a.reGrain, 4)},\\ Re_{chaff}=${n(a.reChaff, 4)}`, result: `V_{grain}=${n(a.vtGrain, 4)},\\ V_{chaff}=${n(a.vtChaff, 4)}\\ \\text{m/s}`, cite: S('eqs 8–10'), beyond: true },
    { label: 'PQ p5: oil globule under gravity', tex: 'V=\\dfrac{gD^2(\\rho_p-\\rho_f)}{18\\mu}', sub: '=\\dfrac{9.81(50\\times10^{-6})^2(900-1000)}{18(10^{-3})}', result: '=-1.36\\times10^{-4}\\ \\text{m/s (rises)}', cite: P504.pq('p5 Q v') },
    { label: 'Cyclone separation factor (eqs 13–17)', tex: 'S=\\dfrac{C_f}{W}=\\dfrac{V^2}{gR},\\ F=W\\sqrt{S^2+1}', sub: `=\\dfrac{${n(p.cycloneVelocity, 3)}^2}{9.81(${n(p.cycloneRadius, 3)})}`, result: `S=${n(a.cForces.S, 4)},\\ F/W=${n(a.cForces.F / p.cycloneParticleWeight, 4)}`, cite: S('Cyclone separator eqs 13–17') },
    { label: 'Smallest particle reaching the wall', tex: 'd=\\sqrt{\\dfrac{9\\mu b}{\\pi N_tV\\Delta\\rho}}', sub: `N_t=${p.cycloneTurns},\\ b=${p.cycloneInletWidth}\\ \\text{m}`, result: `d=${n(a.dCritUm, 3)}\\ \\mu\\text{m}`, beyond: true },
    { label: 'Fineness modulus and average size', tex: 'FM=\\tfrac{1}{100}\\sum(\\%\\times7\\ldots0),\\ D=0.135(1.366)^{FM}', sub: `FM=${n(a.fm, 4)}`, result: `D=${n(a.avgSizeMm, 4)}\\ \\text{mm},\\ UI=${a.ui.ratio.join(':')}`, cite: P504.red('fineness modulus method') },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function SeparationPanel() {
  const [exam, setExam] = useState<string | null>(null)
  return (
    <div>
      <Live />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={EXAM} active={exam} onPick={setExam} />
      </Section>
      <Charts />
      <CalcWorking />
    </div>
  )
}
