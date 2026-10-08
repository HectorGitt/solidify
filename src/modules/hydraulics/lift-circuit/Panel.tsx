import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { KGCM2_TO_MPA, hydraulicPower, reliefSplit } from '@/physics/hydraulics'
import { solveLinkage } from '@/tractor/linkage'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { MG1617, PHI_HIGH, PHI_LOW, RAM_MAX, RAM_MIN, analyse, live, useLift, type Mode, type Valve } from './model'

const MODE: Record<Mode, string> = { lifting: 'Lifting', holding: 'Holding', lowering: 'Lowering', relief: 'Overload — relief blowing', raised: 'Fully raised — relief blowing', down: 'Down' }
const TONE: Record<Mode, 'accent' | 'info' | 'warn' | 'ink'> = { lifting: 'accent', holding: 'ink', lowering: 'info', relief: 'warn', raised: 'warn', down: 'ink' }

const PRESETS = [
  {
    id: 'notes',
    label: '45 kW tractor',
    note: 'Pump 27 L/min (6 gal/min); relief blows off at 150 kg/cm² ≈ 14.7 MPa (≈ 2000 psi; exactly 2134 psi).',
    apply: () => useLift.getState().set({ Q: 27, relief: 150 * KGCM2_TO_MPA, load: 6, valve: 'lift' }),
  },
  {
    id: 'culpin',
    label: '275 bar relief',
    note: 'A normal working pressure of 160 bar with the relief valve set at 275 bar.',
    apply: () => useLift.getState().set({ relief: 27.5, load: 12, valve: 'lift' }),
  },
  {
    id: 'overload',
    label: 'Overload',
    note: 'A load heavier than the lift capacity: the pressure reaches the relief setting, the poppet lifts (knocking) and all the pump flow goes back to the reservoir. The implement does not move.',
    apply: () => useLift.getState().set({ Q: 27, relief: 150 * KGCM2_TO_MPA, load: 25, valve: 'lift' }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.phi === b.phi && a.mode === b.mode && a.p === b.p)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="State" value={MODE[v.mode]} tone={TONE[v.mode]} />
        <Readout label="Hitch height" value={fmt(v.hitchY * 1000, 3)} unit="mm" />
        <Readout label="Ram pressure" value={fmt(v.p, 3)} unit="MPa" tone={v.mode === 'relief' || v.mode === 'raised' ? 'warn' : 'accent'} />
        <Readout label="To ram" value={fmt(v.toRam, 3)} unit="L/min" />
        <Readout label="Over relief" value={fmt(v.toRelief, 3)} unit="L/min" tone={v.toRelief > 0 ? 'warn' : 'ink'} />
        <Readout label="Valve → tank" value={fmt(v.toTank, 3)} unit="L/min" />
      </div>
    </Section>
  )
}

function useAnalysis() {
  const st = useLift()
  const phiMid = (PHI_LOW + PHI_HIGH) / 2
  return { st, a: analyse(st, phiMid), phiMid }
}

function PressureChart() {
  const { st } = useAnalysis()
  const data = useMemo(() => {
    const xs: number[] = []
    const need: number[] = []
    const rel: number[] = []
    for (let i = 0; i <= 40; i++) {
      const phi = PHI_LOW + ((PHI_HIGH - PHI_LOW) * i) / 40
      xs.push(solveLinkage(phi).L.y * 1000)
      need.push(analyse(st, phi).pNeed)
      rel.push(st.relief)
    }
    return { xs, need, rel }
  }, [st])
  return (
    <Section title="Ram pressure through the lift">
      <Chart
        data={[data.xs, data.need, data.rel]}
        series={[
          { label: 'Needed', color: '#e8794f', width: 2 },
          { label: 'Relief setting', color: '#f5b942', width: 1.5, dash: [5, 4] },
        ]}
        xLabel="Hitch height (mm)"
        yLabel="Pressure (MPa)"
        marker={() => [live.hitchY * 1000, Math.min(live.p, st.relief)]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Where the orange line crosses the relief setting the ram stalls and the relief valve opens.</p>
    </Section>
  )
}

function LiftWorking() {
  const { st, a } = useAnalysis()
  const V = a.area * (RAM_MAX - RAM_MIN)
  const t = (V * 60000) / st.Q
  const split = reliefSplit(st.Q, a.pNeed, st.relief)
  const steps: WorkingStep[] = [
    {
      label: 'Relief setting in SI',
      tex: 'p_{relief} = 150\\ \\text{kg/cm}^2\\times0.0981',
      sub: '= 14.7\\ \\text{MPa}\\ (\\approx 2000\\ \\text{psi})',
      result: `\\text{set here: } ${n(st.relief, 4)}\\ \\text{MPa} = ${n(st.relief / KGCM2_TO_MPA, 4)}\\ \\text{kg/cm}^2`,
      cite: SRC.hy510('p3'),
    },
    {
      label: 'Lever ratio of the linkage at mid-lift (hitch rise per mm of ram stroke)',
      tex: 'i = \\dfrac{dy_{hitch}}{dL_{ram}}',
      sub: '\\text{from the linkage geometry (lift arm, rod, lower link, crank)}',
      result: `i = ${n(a.ratio, 4)}`,
      cite: SRC.beyond('virtual work on the linkage'),
      beyond: true,
    },
    {
      label: 'Ram force and pressure for the implement weight',
      tex: 'F = W\\,i,\\quad p = \\dfrac{F}{A},\\quad A = \\tfrac{\\pi}{4}D^2',
      sub: `F = ${n(st.load, 3)}\\,\\text{kN}\\times${n(a.ratio, 4)},\\quad A = \\tfrac{\\pi}{4}(${n(st.bore * 1000, 3)}\\,\\text{mm})^2 = ${n(a.area * 1e4, 4)}\\,\\text{cm}^2`,
      result: `F = ${n(a.ramForce / 1000, 4)}\\ \\text{kN},\\quad p = ${n(a.pNeed, 4)}\\ \\text{MPa}`,
      cite: SRC.top510('p11: p = F/A'),
    },
    {
      label: 'Relief valve split',
      tex: 'p < p_{relief}\\Rightarrow Q_{ram} = Q;\\quad p \\ge p_{relief}\\Rightarrow Q_{tank} = Q',
      sub: `${n(a.pNeed, 4)}\\ ${a.overload ? '\\ge' : '<'}\\ ${n(st.relief, 4)}\\ \\text{MPa}`,
      result: `Q_{ram} = ${n(split.toLoad, 3)},\\ Q_{relief} = ${n(split.toTank, 3)}\\ \\text{L/min}`,
      cite: SRC.hy510('p2: relief returns oil on overload'),
    },
    {
      label: 'Lift capacity at the relief setting',
      tex: 'W_{max} = \\dfrac{p_{relief}A}{i}',
      sub: `= \\dfrac{${n(st.relief, 4)}\\times10^6\\times${n(a.area, 4)}}{${n(a.ratio, 4)}}`,
      result: `= ${n(a.capacity, 4)}\\ \\text{kN}`,
      cite: SRC.beyond('lever rule'),
      beyond: true,
    },
    {
      label: 'Oil and time for a full lift',
      tex: 'V = A\\,\\Delta L,\\quad t = V/Q',
      sub: `V = ${n(a.area * 1e4, 4)}\\,\\text{cm}^2\\times${n((RAM_MAX - RAM_MIN) * 100, 4)}\\,\\text{cm},\\quad t = ${n(V * 1000, 4)}\\,\\text{L}/${n(st.Q, 3)}\\,\\text{L/min}`,
      result: `V = ${n(V * 1000, 4)}\\ \\text{L},\\quad t = ${n(t, 3)}\\ \\text{s}`,
      cite: SRC.top510('p11: V = AL, Q = V/t'),
    },
    {
      label: 'Hydraulic power while lifting',
      tex: 'P_h = \\dfrac{Q\\,p}{60}',
      sub: `= \\dfrac{${n(st.Q, 3)}\\times${n(Math.min(a.pNeed, st.relief), 4)}}{60}`,
      result: `= ${n(hydraulicPower(st.Q, Math.min(a.pNeed, st.relief)), 4)}\\ \\text{kW}`,
      cite: MG1617('Q(c): Ph = QA·ΔP/60'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function LiftPanel() {
  const st = useLift()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Lift / lower lever">
        <Segmented<Valve>
          value={st.valve}
          onChange={(valve) => st.set({ valve })}
          options={[
            { value: 'lift', label: 'Lift', title: 'Pump to ram' },
            { value: 'hold', label: 'Hold', title: 'Ram blocked; pump to tank' },
            { value: 'lower', label: 'Lower', title: 'Ram to tank — drops under its own weight' },
          ]}
        />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Circuit">
        <Slider label="Pump delivery Q" value={st.Q} min={5} max={60} step={0.5} unit="L/min" onChange={(Q) => set({ Q })} />
        <Slider label="Relief setting" value={st.relief} min={8} max={30} step={0.1} unit="MPa" onChange={(relief) => set({ relief })} hint="150 kg/cm² ≈ 14.7 MPa typical" />
        <Slider label="Implement weight" value={st.load} min={0} max={30} step={0.5} unit="kN" onChange={(load) => set({ load })} />
        <Slider label="Lowering rate (flow control)" value={st.dropQ} min={2} max={40} step={1} unit="L/min" onChange={(dropQ) => set({ dropQ })} />
        <Slider label="Ram bore" value={st.bore * 1000} min={60} max={120} step={1} unit="mm" onChange={(v) => set({ bore: v / 1000 })} hint="Changes the numbers; the drawn ram stays 90 mm" />
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                p.apply()
                setPreset(p.id)
              }}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{PRESETS.find((p) => p.id === preset)?.note}</p> : null}
      </Section>
      <PressureChart />
      <LiftWorking />
    </div>
  )
}
