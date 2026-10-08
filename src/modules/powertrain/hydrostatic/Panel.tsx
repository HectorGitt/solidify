import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { HYDRO_ADVANTAGES, HYDRO_LIFE_FACTORS, MOTOR_MIN_FRACTION, unitDisplacement } from '@/physics/drives'
import { HYDRO_COMBOS, type HydroCombo } from '@/physics/transmission'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { DEFAULTS, UNIT, live, solveLoop, useHydro } from './model'

const COMBOS = Object.keys(HYDRO_COMBOS) as HydroCombo[]
const set = (p: Parameters<ReturnType<typeof useHydro.getState>['set']>[0]) => useHydro.getState().set(p)

const PRESETS: Preset[] = [
  { id: 'neutral', label: 'Neutral (0°)', note: 'Pump swashplate upright: the pistons do not stroke, no oil flows and the motor is held still — the tractor stands without a clutch.', apply: () => set({ ...DEFAULTS, combo: 'VDP-FDM', pumpLever: 0 }) },
  { id: 'full', label: 'Full forward', note: 'Pump at +18°, equal-size motor: motor speed ≈ η_v² × engine speed, torque ≈ η_T·Δp·D/2π.', apply: () => set({ ...DEFAULTS, combo: 'VDP-FDM', pumpLever: 1 }) },
  { id: 'rev', label: 'Half reverse', note: 'Lever pulled back past zero: the flow reverses, the red (pressure) line swaps sides and the motor turns the other way (flow direction sets travel direction).', apply: () => set({ ...DEFAULTS, combo: 'VDP-FDM', pumpLever: -0.5 }) },
  { id: 'vdm', label: 'FDP → VDM, small motor angle', note: 'Fixed pump, motor swashplate at 40 %: the motor runs faster with less torque. It cannot stop or reverse — only a variable pump can.', apply: () => set({ ...DEFAULTS, combo: 'FDP-VDM', motorLever: 0.4 }) },
  { id: 'best', label: 'VDP → VDM (exam Q4)', note: 'Both variable: the widest range of speed and torque — the best combination for optimum performance, but complex and expensive, so seldom used.', apply: () => set({ ...DEFAULTS, combo: 'VDP-VDM', pumpLever: 0.8, motorLever: 0.5 }) },
  { id: 'fdp', label: 'FDP → FDM (cheapest)', note: 'Both fixed: a fixed ratio, set only by engine speed. Simplest and cheapest, but no speed or direction control from the drive itself.', apply: () => set({ ...DEFAULTS, combo: 'FDP-FDM' }) },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.motorRpm === b.motorRpm && a.pumpAngle === b.pumpAngle)
  const st = useHydro()
  const r = solveLoop(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Pump (engine)" value={fmt(v.pumpRpm, 4)} unit="rpm" />
        <Readout label="Pump swashplate" value={`${fmt((v.pumpAngle * 180) / Math.PI, 3)}°`} tone="accent" />
        <Readout label="Motor swashplate" value={`${fmt((v.motorAngle * 180) / Math.PI, 3)}°`} />
        <Readout label="Flow Q" value={fmt(r.QA, 3)} unit="L/min" tone="info" />
        <Readout label="Motor speed" value={fmt(v.motorRpm, 4)} unit="rpm" tone="accent" />
        <Readout label="Motor torque" value={fmt(r.motorTorque, 3)} unit="N·m" />
        <Readout label="Pump torque" value={fmt(r.pumpTorque, 3)} unit="N·m" />
        <Readout label="Output power" value={fmt(r.outputPower, 3)} unit="kW" />
        <Readout label="Efficiency" value={fmt(r.eta * 100, 3)} unit="%" tone={r.eta < 0.7 ? 'warn' : 'ink'} />
      </div>
      <Note>
        Stroke {fmt(r.pumpStroke * 1000, 3)} mm (pump), {fmt(r.motorStroke * 1000, 3)} mm (motor). Heat into the oil {fmt(r.heat, 3)} kW — heat is one of the four things that shorten a
        unit's life.
      </Note>
    </Section>
  )
}

function SpeedChart() {
  const st = useHydro()
  const data = useMemo(() => {
    const xs: number[] = []
    const speed: number[] = []
    for (let k = -1; k <= 1.0001; k += 0.02) {
      const r = solveLoop({ ...st, pumpLever: k })
      xs.push(k)
      speed.push(r.motorSpeed)
    }
    return [xs, speed]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.combo, st.motorLever, st.rpm, st.etaV, st.etaT, st.dp])
  return (
    <Section title="Motor speed vs control lever">
      <Chart
        data={data}
        series={[{ label: 'motor rpm', color: '#f5b942', width: 2 }]}
        xLabel="Pump lever (−1 reverse … +1 forward)"
        yLabel="Motor speed (rpm)"
        marker={() => [useHydro.getState().pumpLever, live.motorRpm]}
        height={160}
      />
      <Note>
        {HYDRO_COMBOS[st.combo].pumpVariable
          ? 'Stepless: any speed from full reverse through zero to full forward with one lever — no gear steps.'
          : 'A fixed pump ignores the lever: the line is flat. Only a variable pump can stop and reverse the motor.'}
      </Note>
    </Section>
  )
}

function HydroWorking() {
  const st = useHydro()
  const r = solveLoop(st)
  const z = UNIT.pistons
  const d = UNIT.bore * 1000
  const R2 = UNIT.pitchR * 2000
  const bp = (r.pumpAngle * 180) / Math.PI
  const steps: WorkingStep[] = [
    {
      label: 'Pump displacement from the swashplate angle',
      tex: 'D = z\\,\\tfrac{\\pi}{4}d^2\\,(2R\\tan\\beta)',
      sub: `= ${z}\\times\\tfrac{\\pi}{4}(${d}\\,\\text{mm})^2\\times${R2}\\tan(${n(bp, 3)}^\\circ)`,
      result: `D_p = ${n(r.Dp, 4)}\\ \\text{cm}^3/\\text{rev}`,
      cite: SRC.pt510('p8 swashplate varies the flow'),
      beyond: true,
    },
    {
      label: 'Pump delivery',
      tex: 'Q_A = \\eta_v\\,\\dfrac{D_p N_p}{1000}',
      sub: `= ${n(st.etaV, 3)}\\times\\dfrac{${n(r.Dp, 4)}\\times${n(st.rpm, 4)}}{1000}`,
      result: `= ${n(r.QA, 4)}\\ \\text{L/min}`,
      cite: SRC.beyond('Q = D·N/1000 — standard pump formula, as in the AEE502 hydraulics marking guides'),
      beyond: true,
    },
    {
      label: 'Motor speed — set by the flow',
      tex: 'N_m = \\eta_v\\,\\dfrac{1000\\,Q_A}{D_m}',
      sub: `= ${n(st.etaV, 3)}\\times\\dfrac{1000\\times${n(r.QA, 4)}}{${n(r.Dm, 4)}}`,
      result: `= ${n(r.motorSpeed, 4)}\\ \\text{rpm}`,
      cite: SRC.pt510('p8: flow rate → speed, flow direction → travel direction'),
      beyond: true,
    },
    {
      label: 'Motor torque — set by the pressure',
      tex: 'T_m = \\eta_T\\,\\dfrac{\\Delta p\\,D_m}{2\\pi}',
      sub: `= ${n(st.etaT, 3)}\\times\\dfrac{${n(st.dp, 3)}\\,\\text{MPa}\\times${n(r.Dm, 4)}}{2\\pi}`,
      result: `= ${n(r.motorTorque, 4)}\\ \\text{N·m}`,
      cite: SRC.pt510('p8: pressure → power'),
      beyond: true,
    },
    {
      label: 'Torque ratio motor : pump',
      tex: '\\dfrac{T_m}{T_p} = \\eta_T^2\\,\\dfrac{D_m}{D_p}',
      sub: `= ${n(st.etaT ** 2, 3)}\\times\\dfrac{${n(r.Dm, 4)}}{${n(Math.abs(r.Dp), 4)}}`,
      result: `= ${n(r.torqueRatio, 4)}`,
      cite: SRC.pt510('p7 (PDF p9)'),
      beyond: true,
      errata:
        'The notes say torque is not multiplied in a hydrostatic drive. Strictly, it is: like a gearbox, T_m/T_p = D_m/D_p (less losses), so with the pump swashplate part-way the motor torque exceeds the pump torque. What it lacks is the torque converter’s automatic, load-sensing multiplication by the stator.',
    },
    {
      label: 'Power and overall efficiency',
      tex: 'P = \\dfrac{2\\pi N_m T_m}{60},\\quad \\eta = \\dfrac{P_{out}}{P_{in}} = (\\eta_v\\eta_T)^2',
      sub: `P_{in} = ${n(r.inputPower, 4)}\\ \\text{kW}`,
      result: `P_{out} = ${n(r.outputPower, 4)}\\ \\text{kW},\\ \\eta = ${n(r.eta * 100, 3)}\\,\\%,\\ \\text{heat} = ${n(r.heat, 3)}\\ \\text{kW}`,
      cite: SRC.pt510('p9 life shortened by heat'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function HydroPanel() {
  const st = useHydro()
  const [preset, setPreset] = useState<string | null>(null)
  const change = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  const c = HYDRO_COMBOS[st.combo]
  return (
    <div>
      <LivePanel />
      <Section title="Pump → motor combination">
        <Segmented<HydroCombo> value={st.combo} onChange={(combo) => change({ combo })} size="sm" options={COMBOS.map((k) => ({ value: k, label: k.replace('-', '→'), title: HYDRO_COMBOS[k].label }))} />
        <p className="text-[11.5px] leading-snug text-ink/85">
          <b>{c.label}.</b> {c.note}
        </p>
      </Section>
      <Section title="Controls">
        <Slider label="Pump swashplate lever" value={st.pumpLever} min={-1} max={1} step={0.01} onChange={(pumpLever) => change({ pumpLever })} hint={c.pumpVariable ? 'Tilts the pump swashplate: speed and direction' : 'Fixed pump — the lever does nothing'} />
        <Slider label="Motor swashplate lever" value={st.motorLever} min={MOTOR_MIN_FRACTION} max={1} step={0.01} onChange={(motorLever) => change({ motorLever })} hint={c.motorVariable ? 'Smaller angle: faster, less torque' : 'Fixed motor — the lever does nothing'} />
        {!c.pumpVariable || !c.motorVariable ? <Note>{!c.pumpVariable ? 'Fixed pump: the pump lever is inactive. ' : ''}{!c.motorVariable ? 'Fixed motor: the motor lever is inactive.' : ''}</Note> : null}
        <Slider label="Engine speed" value={st.rpm} min={600} max={2400} step={10} unit="rpm" onChange={(rpm) => change({ rpm })} />
        <Slider label="Loop pressure Δp" value={st.dp} min={2} max={40} step={0.5} unit="MPa" onChange={(dp) => change({ dp })} hint="High − low side; set by the load" />
        <Slider label="Volumetric efficiency η_v" value={st.etaV} min={0.8} max={1} step={0.005} onChange={(etaV) => change({ etaV })} />
        <Slider label="Torque efficiency η_T" value={st.etaT} min={0.8} max={1} step={0.005} onChange={(etaT) => change({ etaT })} />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <Note>Unit size {fmt(unitDisplacement(UNIT, UNIT.maxAngle), 3)} cm³/rev at 18° (typical). Red = high-pressure line, blue = low-pressure (return) line.</Note>
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <SpeedChart />
      <Section title="The four combinations">
        <Table
          head={['', 'Speed control', 'Stop / reverse', 'Notes']}
          highlight={COMBOS.indexOf(st.combo)}
          rows={[
            ['FDP→FDM', 'engine only', 'no', 'cheapest, simplest'],
            ['VDP→FDM', 'pump lever', 'yes', 'the common one'],
            ['FDP→VDM', 'motor angle', 'no', 'speed ↑ torque ↓'],
            ['VDP→VDM', 'both', 'yes', 'best, complex & costly'],
          ]}
        />
      </Section>
      <Section title="Exam lists">
        <div className="grid grid-cols-2 gap-3 text-[11.5px] leading-snug text-ink/85">
          <div>
            <div className="mb-1 text-dim">10 advantages</div>
            <ol className="list-decimal space-y-0.5 pl-4">
              {HYDRO_ADVANTAGES.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="mb-1 text-dim">Life greatly reduced by too much…</div>
            <ul className="list-disc space-y-0.5 pl-4">
              {HYDRO_LIFE_FACTORS.map((a) => (
                <li key={a}>{a.replace('Too much ', '')}</li>
              ))}
            </ul>
            <div className="mb-1 mt-2 text-dim">Two principles</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Liquids take the shape of their container</li>
              <li>Liquids are incompressible</li>
            </ul>
            <div className="mb-1 mt-2 text-dim">vs torque converter</div>
            <p>The TC multiplies torque through its stator; the notes say the hydrostatic drive does not (see the working).</p>
          </div>
        </div>
      </Section>
      <HydroWorking />
    </div>
  )
}
