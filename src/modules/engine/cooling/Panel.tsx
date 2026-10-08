import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { capBoilingPointC } from '@/physics/cooling'
import { coolingFlows, coolingSteady, heatToCoolant, thermostatTarget, type CoolMode, type ThermostatFault } from '@/physics/engineSystems'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DEFAULTS, SPEC, inputs, live, status, useCool, type CoolParams } from './model'

const STATUS = {
  warming: { label: 'Warming up', tone: 'info' },
  regulating: { label: 'At working temperature', tone: 'accent' },
  hot: { label: 'Overheating', tone: 'warn' },
  boiling: { label: 'Boiling — steam at the cap', tone: 'warn' },
  cool: { label: 'Cold', tone: 'info' },
} as const

interface Preset {
  id: string
  label: string
  note: string
  params: Partial<CoolParams>
}

const PRESETS: Preset[] = [
  { id: 'warm-up', label: 'Cold start, forced', note: 'Thermostat shut: coolant circulates through the bypass and the engine warms quickly. It opens near 80 °C and holds the coolant in the working range (60–93 °C).', params: { ...DEFAULTS } },
  { id: 'siphon', label: 'Thermosiphon', note: 'No pump. Hot water rises from the jacket to the top of the radiator, cooled water sinks to the bottom and back into the block — the circulation is driven only by the difference in density.', params: { mode: 'thermosiphon', load: 0.5, rpm: 1600 } },
  { id: 'stuck-shut', label: 'Thermostat stuck shut', note: 'Nothing reaches the radiator but the leak flow: the coolant climbs until it boils at the cap pressure.', params: { thermostat: 'stuck-shut' } },
  { id: 'stuck-open', label: 'Thermostat stuck open', note: 'At light load on a cool day the radiator removes heat faster than the engine makes it — the engine runs cold, wearing faster and using more fuel.', params: { thermostat: 'stuck-open', load: 0.25, ambientC: 18 } },
  { id: 'belt', label: 'Slack fan belt', note: 'The belt slips, so the fan and pump run slowly: less air through the radiator and less coolant flow.', params: { beltSlip: 0.6, load: 1, ambientC: 38 } },
  { id: 'scale', label: 'Scaled-up radiator', note: 'Scale and dirt insulate the tubes and fins. Heavy load on a hot day pushes the coolant past its working range.', params: { scale: 0.8, load: 1, ambientC: 38 } },
  { id: 'no-cap', label: 'Cap left off', note: 'Without the pressure cap the coolant boils at 100 °C instead of ≈ 119 °C.', params: { capKPa: 0, scale: 0.5, load: 1, ambientC: 40 } },
  { id: 'air', label: 'Air-cooled', note: 'Fins on the cylinder and head, a cowling, and fan blades on the flywheel. No coolant to leak, freeze or boil.', params: { mode: 'air', load: 0.4, rpm: 2200 } },
]

function LivePanel() {
  const p = useCool()
  const v = useLive(
    () => ({ Te: live.state.Te, th: live.state.th, Tb: live.flows.Tbottom, rad: live.flows.radFlow, by: live.flows.bypassFlow, heat: live.flows.heat, toAir: live.flows.toAir, boil: live.flows.boilC, t: live.t, st: status(useCool.getState(), live) }),
    8,
    (a, b) => a.Te === b.Te && a.t === b.t,
  )
  const s = STATUS[v.st]
  const air = p.mode === 'air'
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label={air ? 'Fin root' : 'Top hose'} value={fmt(v.Te, 3)} unit="°C" tone={v.st === 'hot' || v.st === 'boiling' ? 'warn' : 'accent'} />
        {air ? <Readout label="Air in" value={fmt(p.ambientC, 3)} unit="°C" /> : <Readout label="Bottom hose" value={fmt(v.Tb, 3)} unit="°C" tone="info" />}
        {air ? <Readout label="Fan speed" value={fmt(p.rpm, 3)} unit="rpm" /> : <Readout label="Thermostat" value={`${Math.round(v.th * 100)} %`} unit="open" />}
        <Readout label="Heat in" value={fmt(v.heat / 1000, 3)} unit="kW" />
        <Readout label="Heat to air" value={fmt(v.toAir / 1000, 3)} unit="kW" />
        {air ? <Readout label="Sim time" value={fmt(v.t / 60, 3)} unit="min" /> : <Readout label="Radiator flow" value={fmt(v.rad, 2)} unit="kg/s" />}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
        <span className={s.tone === 'warn' ? 'text-warn' : s.tone === 'accent' ? 'text-accent' : 'text-info'}>{s.label}</span>
        <span className="text-mute">
          {air ? '' : `boils at ${fmt(v.boil, 3)} °C · bypass ${fmt(v.by, 2)} kg/s · `}t = {fmt(v.t / 60, 3)} min
        </span>
      </div>
    </Section>
  )
}

function HistoryChart() {
  const air = useCool((s) => s.mode === 'air')
  const data = useLive(() => [live.hist.t.map((t) => t / 60), [...live.hist.Te], [...live.hist.Tb]], 2, (a, b) => a[0].length === b[0].length && a[0][0] === b[0][0])
  return (
    <Section title="Temperature since start">
      <Chart
        data={data}
        series={[
          { label: air ? 'Fin root' : 'Top hose', color: '#e8794f', width: 2 },
          { label: air ? 'Air' : 'Bottom hose', color: '#6fb3e0', width: 1.5 },
        ]}
        xLabel="Simulated time (min)"
        yLabel="Temperature (°C)"
        marker={() => [live.t / 60, live.state.Te]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Thermal time runs faster than the animation (set below). Use “Restart from cold” to watch a warm-up again.</p>
    </Section>
  )
}

function ThermostatChart() {
  const xs = useMemo(() => Array.from({ length: 61 }, (_, i) => 50 + i), [])
  const data = useMemo(() => [xs, xs.map((T) => thermostatTarget(SPEC, T) * 100)], [xs])
  return (
    <Section title="Thermostat opening">
      <Chart data={data} series={[{ label: 'lift', color: '#c9a24a', width: 2 }]} xLabel="Coolant temperature (°C)" yLabel="Opening (%)" marker={() => [Math.max(50, Math.min(110, live.state.Te)), live.state.th * 100]} height={140} />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Typical wax thermostat: starts to open at {SPEC.thOpen} °C, fully open at {SPEC.thFull} °C. The dot lags the curve because the wax takes time to melt.
      </p>
    </Section>
  )
}

function CoolWorking() {
  const p = useCool()
  const inp = useMemo(() => inputs(p), [p])
  const steady = useMemo(() => coolingSteady(SPEC, inp), [inp])
  const f = useMemo(() => coolingFlows(SPEC, inp, steady), [inp, steady])
  const heat = heatToCoolant(SPEC, p.load, p.rpm)
  const speed = p.rpm / SPEC.ratedRpm
  const bp = Math.min(1.2, p.load) * SPEC.ratedPower * speed
  const fp = 0.1 * SPEC.ratedPower * speed * speed
  const steps: WorkingStep[] = [
    {
      label: 'Heat the cooling system must remove (heat balance 40 / 30 / 30)',
      tex: 'Q_{cool} = \\dfrac{30\\,\\%}{30\\,\\%}\\,(BP + FP)',
      sub: `= ${n(bp / 1000, 3)} + ${n(fp / 1000, 3)}\\ \\text{kW}`,
      result: `= ${n(heat / 1000, 3)}\\ \\text{kW}`,
      cite: SRC.supp509('heat balance: 30 % to cooling, 30 % useful work'),
    },
  ]
  if (p.mode === 'air') {
    steps.push({
      label: 'Fins reject the heat to the air stream',
      tex: 'Q = hA\\,(T_{fin} - T_{air})\\;\\Rightarrow\\; T_{fin} = T_{air} + \\dfrac{Q}{hA}',
      sub: `hA = ${n(f.toAir / Math.max(1e-6, steady.Te - p.ambientC), 3)}\\ \\text{W/K}`,
      result: `T_{fin} = ${n(steady.Te, 3)}\\,^\\circ\\text{C (steady)}`,
      cite: SRC.tb509('Fig 7.1'),
      beyond: true,
    })
  } else {
    steps.push({
      label: 'Coolant carries the heat to the radiator',
      tex: 'Q = \\dot m\\, c_p\\,(T_{top} - T_{bottom})',
      sub: `= ${n(f.radFlow, 3)}\\times4.186\\times(${n(steady.Te, 3)} - ${n(f.Tbottom, 3)})`,
      result: `= ${n(f.toAir / 1000, 3)}\\ \\text{kW (steady)}`,
      cite: SRC.tb509('Fig 7.3'),
      beyond: true,
    })
    steps.push({
      label: 'Boiling point under the pressure cap',
      tex: 'T_{boil} = T_{sat}(p_{atm} + p_{cap})',
      sub: `p = 101.3 + ${n(p.capKPa, 3)}\\ \\text{kPa}`,
      result: `T_{boil} = ${n(capBoilingPointC(p.capKPa), 4)}\\,^\\circ\\text{C}`,
      cite: SRC.tb509('Fig 7.4 — pressure cap'),
      beyond: true,
    })
    steps.push({
      label: 'Steady running temperature',
      tex: 'Q_{cool} = Q_{radiator} = Q_{air}',
      sub: `\\text{thermostat } ${n(steady.th * 100, 3)}\\,\\%\\ \\text{open}`,
      result: `T_{top} = ${n(steady.Te, 3)}\\,^\\circ\\text{C}\\quad(\\text{working range } 60\\text{–}93\\,^\\circ\\text{C})`,
      cite: SRC.l4_509('operating temperature 60–93 °C'),
      beyond: true,
    })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function CoolPanel() {
  const st = useCool()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<CoolParams>) => {
    setPreset(null)
    st.set(p)
  }
  const air = st.mode === 'air'
  return (
    <div>
      <LivePanel />
      <Section title="System">
        <Segmented<CoolMode>
          value={st.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'forced', label: 'Forced', title: 'Pump, thermostat, bypass, radiator' },
            { value: 'thermosiphon', label: 'Thermosiphon', title: 'No pump: hot water rises, cool water sinks' },
            { value: 'air', label: 'Air-cooled', title: 'Fins, cowling and flywheel fan' },
          ]}
        />
        <Slider label="Engine load" value={st.load * 100} min={0} max={110} step={1} unit="%" onChange={(v) => set({ load: v / 100 })} />
        <Slider label="Engine speed" value={st.rpm} min={600} max={2400} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} />
        <Slider label="Air temperature" value={st.ambientC} min={0} max={45} step={1} unit="°C" onChange={(ambientC) => set({ ambientC })} />
        {!air ? (
          <>
            <Slider label="Pressure cap" value={st.capKPa} min={0} max={110} step={5} unit="kPa" onChange={(capKPa) => set({ capKPa })} hint="0 = cap off (open to the air)" />
            <Segmented<ThermostatFault>
              size="sm"
              label="Thermostat"
              value={st.thermostat}
              onChange={(thermostat) => set({ thermostat })}
              options={[
                { value: 'none', label: 'Working' },
                { value: 'stuck-shut', label: 'Stuck shut' },
                { value: 'stuck-open', label: 'Stuck open' },
              ]}
            />
            <Slider label="Fan-belt slip" value={st.beltSlip * 100} min={0} max={80} step={1} unit="%" onChange={(v) => set({ beltSlip: v / 100 })} />
          </>
        ) : null}
        <Slider label={air ? 'Dirt on the fins' : 'Scale / dirt'} value={st.scale * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ scale: v / 100 })} />
        <Toggle label={air ? 'Flywheel fan' : 'Fan'} checked={st.fan} onChange={(fan) => set({ fan })} />
        <Slider label="Thermal time speed-up" value={st.thermalSpeed} min={1} max={60} step={1} unit="×" onChange={(thermalSpeed) => st.set({ thermalSpeed })} />
        <Toggle label="Show coolant and air flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <button onClick={() => st.coldStart()} className="mt-1 w-full rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-accent/50">
          Restart from cold
        </button>
      </Section>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set({ ...DEFAULTS, ...p.params })
                st.coldStart()
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
      <HistoryChart />
      {!air ? <ThermostatChart /> : null}
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[12px] leading-snug text-ink/85">
          <li>
            <b>Why cool?</b> Combustion reaches up to about 1600 °C. (Standard answer, beyond notes: without cooling the oil film breaks down and parts distort and seize.) Working temperature 60–93 °C (140–200 °F), typically about 90 °C.
          </li>
          <li>
            <b>Thermosiphon:</b> hot water rises from the jacket to the top of the radiator; cooled water returns from the bottom. No pump — a belt-driven fan helps the airflow.
          </li>
          <li>
            <b>Forced circulation:</b> pump → jacket → thermostat → top tank → finned tubes → bottom tank → pump; the bypass recirculates while the thermostat is shut.
          </li>
          <li>
            <b>Pressure cap</b> raises the boiling point and has a vacuum valve.
          </li>
          <li>
            <b>Faults:</b> scale, a stuck thermostat, a loose fan belt.
          </li>
          <li>
            <b>Air cooling:</b> finned cylinder in a cowling, fan blades on the flywheel. Standard answer for its advantages (beyond notes): lighter and simpler, no coolant to leak, freeze or boil, and quicker warm-up; but noisier, with less even cylinder temperatures.
          </li>
        </ul>
      </Section>
      <CoolWorking />
    </div>
  )
}
