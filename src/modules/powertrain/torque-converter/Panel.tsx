import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { TC_DESIGNS } from '@/physics/drives'
import { converterEfficiency, converterPeak, converterTorqueRatio, vortexShare } from '@/physics/transmission'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { DEFAULTS, SPEC, live, point, useTc } from './model'

const set = (p: Partial<typeof DEFAULTS>) => useTc.getState().set(p)

const PRESETS: Preset[] = [
  { id: 'stall', label: 'Stall (turbine held)', note: 'Tractor held by its load, engine at full throttle: all vortex flow, maximum torque multiplication (2.2 : 1 here), zero efficiency — all the power heats the oil.', apply: () => set({ ...DEFAULTS, SR: 0 }) },
  { id: 'accel', label: 'Pulling away', note: 'Turbine at half pump speed: the stator is still held; torque is still multiplied (≈ 1.5 : 1).', apply: () => set({ ...DEFAULTS, SR: 0.5 }) },
  { id: 'peak', label: 'Best efficiency', note: 'Peak efficiency of the converter range of this (idealised) characteristic.', apply: () => set({ ...DEFAULTS, SR: Math.round(converterPeak(SPEC).SR * 100) / 100 }) },
  { id: 'coupling', label: 'Coupling point', note: 'The oil now strikes the back of the stator blades: the one-way clutch lets it freewheel. Torque increase stops; the converter acts as a simple fluid coupling ("locked up").', apply: () => set({ ...DEFAULTS, SR: 0.9 }) },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.turbine === b.turbine && a.stator === b.stator)
  const st = useTc()
  const p = point(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Pump (engine)" value={fmt(v.impeller, 4)} unit="rpm" />
        <Readout label="Turbine" value={fmt(v.turbine, 4)} unit="rpm" tone="accent" />
        <Readout label="Stator" value={p.statorHeld ? 'held' : `${fmt(v.stator, 4)} rpm`} tone={p.statorHeld ? 'warn' : 'info'} />
        <Readout label="Pump torque" value={fmt(p.Ti, 3)} unit="N·m" />
        <Readout label="Turbine torque" value={fmt(p.Tt, 3)} unit="N·m" tone="accent" />
        <Readout label="Stator reaction" value={fmt(p.Ts, 3)} unit="N·m" />
        <Readout label="Torque ratio" value={fmt(p.TR, 3)} unit=": 1" />
        <Readout label="Efficiency" value={fmt(p.eta * 100, 3)} unit="%" />
        <Readout label="Vortex flow" value={fmt(vortexShare(p.SR) * 100, 3)} unit="%" />
      </div>
      <Note>{p.statorHeld ? 'Converter range: vortex flow, stator held, torque multiplied.' : 'Coupling range: rotary flow, stator freewheeling, 1 : 1 torque.'}</Note>
    </Section>
  )
}

function CharChart() {
  const data = useMemo(() => {
    const xs: number[] = []
    const tr: number[] = []
    const eta: number[] = []
    for (let s = 0; s <= SPEC.maxSR + 1e-9; s += 0.01) {
      xs.push(s)
      tr.push(converterTorqueRatio(s, SPEC))
      eta.push(converterEfficiency(s, SPEC) * 2.5)
    }
    return [xs, tr, eta]
  }, [])
  return (
    <Section title="Characteristic curve">
      <Chart
        data={data}
        series={[
          { label: 'torque ratio', color: '#f5b942', width: 2 },
          { label: 'efficiency × 2.5', color: '#6fb3e0', width: 2 },
        ]}
        xLabel="Speed ratio N_t / N_p"
        yLabel="Torque ratio  |  η × 2.5"
        yRange={[0, 2.6]}
        marker={() => [useTc.getState().SR, converterTorqueRatio(useTc.getState().SR, SPEC)]}
        height={170}
      />
      <Note tone="warn">
        This is a typical idealised curve (stall ratio 2.2, coupling point at SR 0.85), not measured data: the
        torque ratio falls as the turbine catches up; at the coupling point it reaches 1 and the converter becomes a fluid coupling.
      </Note>
    </Section>
  )
}

/** PT p10 block diagram: Engine → Pump → Turbine → Drive wheels, with the stator loop back. */
function BlockDiagram() {
  const box = (x: number, label: string) => (
    <g key={label}>
      <rect x={x} y={8} width={64} height={22} rx={3} fill="#2a3a30" stroke="#d0631c" />
      <text x={x + 32} y={23} fontSize={10} fill="#e8efe9" textAnchor="middle" fontFamily="Inter, sans-serif">
        {label}
      </text>
    </g>
  )
  return (
    <svg viewBox="0 0 300 78" className="w-full" role="img" aria-label="Engine, pump, turbine, drive wheels, with stator loop">
      <defs>
        <marker id="tc-arrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="#f5b942" />
        </marker>
      </defs>
      {box(2, 'Engine')}
      {box(80, 'Pump')}
      {box(158, 'Turbine')}
      {box(234, 'Drive wheels')}
      {[66, 144, 222].map((x) => (
        <line key={x} x1={x} y1={19} x2={x + 12} y2={19} stroke="#f5b942" strokeWidth={1.6} markerEnd="url(#tc-arrow)" />
      ))}
      <path d="M266 30 V60 H190" fill="none" stroke="#f5b942" strokeWidth={1.6} markerEnd="url(#tc-arrow)" />
      <text x={160} y={64} fontSize={10} fill="#e8efe9" textAnchor="middle" fontFamily="Inter, sans-serif">
        Stator
      </text>
      <path d="M130 60 H34 V32" fill="none" stroke="#f5b942" strokeWidth={1.6} markerEnd="url(#tc-arrow)" />
    </svg>
  )
}

function TcWorking() {
  const st = useTc()
  const p = point(st)
  const steps: WorkingStep[] = [
    {
      label: 'Speed ratio',
      tex: 'SR = \\dfrac{N_{turbine}}{N_{pump}}',
      sub: `= \\dfrac{${n(p.Nt, 4)}}{${n(st.rpm, 4)}}`,
      result: `= ${n(p.SR, 3)}`,
      cite: SRC.pt510('p10: as the engine speeds up, the turbine speeds up'),
      beyond: true,
    },
    {
      label: 'Torque ratio from the characteristic',
      tex: 'TR = TR_0 - (TR_0 - 1)\\dfrac{SR}{SR_c}\\ \\ (SR < SR_c),\\qquad TR = 1\\ \\ (SR \\ge SR_c)',
      sub: `TR_0 = ${SPEC.stallRatio},\\ SR_c = ${SPEC.couplingSR}`,
      result: `TR = ${n(p.TR, 4)}`,
      cite: SRC.beyond('idealised torque-converter characteristic'),
      beyond: true,
    },
    {
      label: 'Torque balance: the stator is the fulcrum',
      tex: 'T_{turbine} = T_{pump} + T_{stator}',
      sub: `${n(p.Tt, 4)} = ${n(p.Ti, 4)} + ${n(p.Ts, 4)}`,
      result: p.statorHeld ? `T_{stator} = ${n(p.Ts, 4)}\\ \\text{N·m held by the one-way clutch}` : 'T_{stator} = 0\\ \\text{(freewheeling)}',
      cite: SRC.pt510('p10 stator as a fluid lever or fulcrum'),
      beyond: true,
    },
    {
      label: 'Efficiency and heat',
      tex: '\\eta = TR\\times SR,\\quad \\dot Q = P_{in}(1-\\eta)',
      sub: `= ${n(p.TR, 4)}\\times${n(p.SR, 3)},\\quad P_{in} = \\dfrac{2\\pi\\times${n(st.rpm, 4)}\\times${n(st.torque, 4)}}{60}`,
      result: `\\eta = ${n(p.eta * 100, 3)}\\,\\%,\\quad \\dot Q = ${n(p.heat, 3)}\\ \\text{kW}`,
      cite: SRC.beyond('converter efficiency'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function TcPanel() {
  const st = useTc()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Partial<typeof DEFAULTS>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Controls">
        <Slider label="Speed ratio (turbine / pump)" value={st.SR} min={0} max={SPEC.maxSR} step={0.01} onChange={(SR) => change({ SR })} hint="0 = stall (turbine held); the coupling point is at 0.85" />
        <Slider label="Engine speed" value={st.rpm} min={800} max={2400} step={10} unit="rpm" onChange={(rpm) => change({ rpm })} />
        <Slider label="Engine torque" value={st.torque} min={50} max={600} step={5} unit="N·m" onChange={(torque) => change({ torque })} />
        <Toggle label="Show oil flow (orange vortex, blue rotary)" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <CharChart />
      <Section title="Power path">
        <BlockDiagram />
        <Note>Engine → pump → turbine → drive wheels; the stator returns the oil to the pump in the pump’s direction of rotation.</Note>
      </Section>
      <Section title="Elements in several converters">
        <Table head={['Design', 'Pumps', 'Stators', 'Turbines']} highlight={3} rows={TC_DESIGNS.map((d) => [d.design, d.pumps, d.stators, d.turbines])} />
        <Note>The design employed depends on the power to be transmitted. This model is design D.</Note>
      </Section>
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>
            <b>Advantage over the hydrostatic drive (exam 2022/23 Q4):</b> the torque converter <b>multiplies torque</b> (through the stator); the notes say the hydrostatic drive does not.
          </li>
          <li>Two flows: vortex flow (round between pump and turbine) and rotary flow (pump and turbine turning together like a coupling).</li>
          <li>As the turbine speeds up, vortex flow changes to rotary flow until they "lock up" and torque increase stops — the converter is then a fluid coupling.</li>
          <li>It adjusts torque automatically, in infinitely small steps, "on the go" — like shifting gears without steps.</li>
          <li>A TC transmission = converter + range gears (planetary; reverse needed) + final drive + hydraulic control.</li>
        </ul>
      </Section>
      <TcWorking />
    </div>
  )
}
