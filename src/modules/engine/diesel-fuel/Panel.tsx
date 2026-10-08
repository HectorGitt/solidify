import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { DENSITY, deliveryPerStroke, kgcm2ToPa, plungerState } from '@/physics/fuel'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { CYLINDERS, DIM, ELEMENT, HV_HSD, PHASE_LABEL, RACK_MAX, live, pumpOutput, useFuel } from './model'

const PHASE_TONE = { filling: 'info', delivering: 'warn', spill: 'accent', returning: 'ink' } as const

const PRESETS = [
  { id: 'stop', label: 'Stop (rack 0)', note: 'Vertical slot over the spill port: the port is never covered, so no fuel is delivered and the engine stops.', p: { rack: 0, rpm: 1500 } },
  { id: 'idle', label: 'Idling', note: 'Small rack opening at low speed: a short effective stroke.', p: { rack: 0.0022, rpm: 650 } },
  { id: 'rated', label: 'Rated load', note: 'Typical full-load rack position at rated speed.', p: { rack: 0.0065, rpm: 1500 } },
  { id: 'excess', label: 'Excess fuel (start)', note: 'Rack against the maximum stop for cold starting at cranking speed — the whole helix land passes the port.', p: { rack: RACK_MAX, rpm: 250 } },
] as const

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.cam === b.cam && a.phase === b.phase)
  const air = useFuel((s) => s.air)
  const bleeding = useFuel((s) => s.bleeding)
  return (
    <Section title="Live — element 1">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Pump cam" value={`${Math.round((v.cam * 180) / Math.PI)}°`} />
        <Readout label="Plunger lift" value={(v.lift * 1000).toFixed(2)} unit="mm" />
        <Readout label="Phase" value={PHASE_LABEL[v.phase]} tone={PHASE_TONE[v.phase]} />
        <Readout label="Pipe pressure" value={fmt(v.pLine, 3)} unit="kg/cm²" tone={v.pLine > 100 ? 'warn' : 'ink'} />
        <Readout label="Needle" value={v.needleOpen ? 'OPEN' : 'shut'} tone={v.needleOpen ? 'warn' : 'ink'} />
        <Readout label="Fuel colours" value={<span className="text-[11px]"><span style={{ color: '#e8c94a' }}>low</span> · <span style={{ color: '#ff5233' }}>high</span> · <span style={{ color: '#9bd36a' }}>return</span></span>} />
      </div>
      {air && !bleeding ? <p className="mt-1.5 text-[11.5px] text-warn">Air in the system: the plungers just compress air, the needle never lifts and the engine stops. Prime and bleed it.</p> : null}
      {bleeding ? <p className="mt-1.5 text-[11.5px] text-info">Priming… air bubbles out at each bleed screw, working from the filters towards the pump.</p> : null}
    </Section>
  )
}

function Charts() {
  const rack = useFuel((s) => s.rack)
  const rackCurve = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i <= 50; i++) {
      const r = (RACK_MAX * i) / 50
      xs.push(r * 1000)
      ys.push(deliveryPerStroke(r, ELEMENT) * 1e9)
    }
    return [xs, ys]
  }, [])
  const liftCurve = useMemo(() => {
    const xs: number[] = []
    const lift: number[] = []
    const deliv: (number | null)[] = []
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * 2 * Math.PI
      const s = plungerState(a, rack, ELEMENT)
      xs.push((a * 180) / Math.PI)
      lift.push(s.lift * 1000)
      deliv.push(s.delivering ? s.lift * 1000 : null)
    }
    return [xs, lift, deliv]
  }, [rack])
  return (
    <Section title="Metering charts">
      <Chart
        data={rackCurve}
        series={[{ label: 'q', color: '#e8c94a', width: 2 }]}
        xLabel="Control-rack travel (mm)"
        yLabel="Delivery (mm³/stroke)"
        marker={() => [useFuel.getState().rack * 1000, deliveryPerStroke(useFuel.getState().rack, ELEMENT) * 1e9]}
        height={150}
      />
      <div className="h-2" />
      <Chart
        data={liftCurve}
        series={[
          { label: 'lift', color: '#93a59a', width: 1.5 },
          { label: 'delivering', color: '#ff5233', width: 3.5 },
        ]}
        xLabel="Pump cam angle (°)"
        yLabel="Plunger lift (mm)"
        marker={() => [(live.cam * 180) / Math.PI, live.lift * 1000]}
        height={150}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Red = effective (delivery) stroke: from the pre-stroke ({ELEMENT.preStroke * 1000} mm, ports covered) until the helix uncovers the spill port. The rest of the
        cam lift only pushes fuel back into the gallery.
      </p>
    </Section>
  )
}

function PumpWorking() {
  const p = useFuel()
  const o = pumpOutput(p)
  const A = o.area * 1e6
  const steps: WorkingStep[] = [
    {
      label: 'Plunger rotation from rack travel',
      tex: '\\theta = \\dfrac{x_{rack}}{r_{pinion}}',
      sub: `= \\dfrac{${n(p.rack * 1000, 3)}\\,\\text{mm}}{${n(ELEMENT.sleeveR * 1000, 3)}\\,\\text{mm}}`,
      result: `= ${n(o.theta, 3)}\\ \\text{rad} = ${n((o.theta * 180) / Math.PI, 3)}^\\circ`,
      cite: SRC.tb509('§4.5.3 rack turns the plungers'),
    },
    {
      label: 'Effective stroke set by the helix (lead L per turn)',
      tex: 's_e = L\\,\\dfrac{\\theta}{2\\pi}\\quad(\\le \\text{cam lift} - \\text{pre-stroke})',
      sub: `= ${n(ELEMENT.helixLead * 1000, 3)}\\times\\dfrac{${n(o.theta, 3)}}{2\\pi}`,
      result: `= ${n(o.eff * 1000, 3)}\\ \\text{mm}`,
      cite: SRC.tb509('p25 helical groove meters the fuel'),
      beyond: true,
    },
    {
      label: 'Fuel delivered per stroke',
      tex: 'q = \\tfrac{\\pi}{4}d^2\\,s_e',
      sub: `= ${n(A, 4)}\\,\\text{mm}^2\\times${n(o.eff * 1000, 3)}\\,\\text{mm}`,
      result: `= ${n(o.vol * 1e9, 3)}\\ \\text{mm}^3 = ${n(o.mass * 1e6, 3)}\\ \\text{mg}\\ (\\rho = ${DENSITY.diesel}\\ \\text{kg/m}^3)`,
      cite: SRC.tb509('§4.5.3'),
    },
    {
      label: 'Fuel rate: each element pumps once per 2 crank revolutions',
      tex: '\\dot m_f = q\\,\\rho\\,z\\,\\dfrac{N}{2\\times60}',
      sub: `= ${n(o.mass * 1e6, 3)}\\times10^{-6}\\times${CYLINDERS}\\times\\dfrac{${p.rpm}}{120}`,
      result: `= ${n(o.mf * 1000, 3)}\\ \\text{g/s} = ${n(o.mf * 3600, 3)}\\ \\text{kg/h}`,
      cite: SRC.misc509('p4 fuel consumption'),
    },
    {
      label: 'Power this fuel can give (HSD calorific value)',
      tex: 'P = \\eta_{bth}\\,\\dot m_f\\,HV',
      sub: `= ${n(p.eta, 3)}\\times${n(o.mf, 3)}\\times${n(HV_HSD / 1e6, 4)}\\times10^6`,
      result: `= ${n(o.power / 1000, 3)}\\ \\text{kW},\\quad sfc = ${n(o.sfc, 3)}\\ \\text{kg/kWh}`,
      cite: SRC.misc509('p4 eq 1.2; Supp calorific values (HSD 10 550 kcal/kg)'),
    },
    {
      label: 'Injector spring load for the opening pressure',
      tex: 'F = p_{open}\\,\\tfrac{\\pi}{4}\\left(d_n^2 - d_s^2\\right)',
      sub: `= ${n(p.pOpen, 3)}\\,\\text{kg/cm}^2 (${n(kgcm2ToPa(p.pOpen) / 1e6, 3)}\\,\\text{MPa})\\times\\tfrac{\\pi}{4}(${DIM.needleD * 1000}^2-${DIM.seatD * 1000}^2)\\,\\text{mm}^2`,
      result: `= ${n(o.spring, 4)}\\ \\text{N}`,
      cite: SRC.supp509('opening pressure 120–300 kg/cm²'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function FuelPanel() {
  const st = useFuel()
  const [preset, setPreset] = useState<string | null>(null)
  const o = pumpOutput(st)
  return (
    <div>
      <LivePanel />
      <Section title="Controls">
        <Slider label="Control rack" value={st.rack * 1000} min={0} max={RACK_MAX * 1000} step={0.1} unit="mm" onChange={(v) => (setPreset(null), st.set({ rack: v / 1000 }))} hint="0 = stop, 10 = excess fuel for starting" />
        <div className="mb-2 grid grid-cols-3 gap-1.5">
          <Readout label="Effective stroke" value={(o.eff * 1000).toFixed(2)} unit="mm" />
          <Readout label="Per stroke" value={fmt(o.vol * 1e9, 3)} unit="mm³" tone="accent" />
          <Readout label="Fuel rate" value={fmt(o.mf * 3600, 3)} unit="kg/h" />
        </div>
        <Slider label="Engine speed" value={st.rpm} min={0} max={2200} step={10} unit="rpm" onChange={(rpm) => (setPreset(null), st.set({ rpm }))} hint="The pump camshaft turns at half this speed" />
        <Slider label="Injector opening pressure" value={st.pOpen} min={120} max={300} step={5} unit="kg/cm²" onChange={(pOpen) => st.set({ pOpen })} hint="120–300 kg/cm²; about 140 kg/cm² typical" />
        <Slider label="Brake thermal efficiency" value={st.eta} min={0.25} max={0.4} step={0.01} onChange={(eta) => st.set({ eta })} hint="Used only for the power estimate (diesel 32–38 %)" />
        <Toggle label="Show fuel flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <button className="rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-warn/60" onClick={() => st.set({ air: true, bleeding: false })}>
            Run the tank dry (air in)
          </button>
          <button
            className="rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-accent/60 disabled:opacity-40"
            disabled={!st.air || st.bleeding}
            onClick={() => {
              live.bleed = 0
              st.set({ bleeding: true })
            }}
          >
            Prime & bleed
          </button>
        </div>
      </Section>
      <Section title="Operating presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                st.set(p.p)
                setPreset(p.id)
              }}
              className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${preset === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{PRESETS.find((p) => p.id === preset)?.note}</p> : null}
        <p className="mt-1.5 text-[10.5px] leading-snug text-dim">Element dimensions (8 mm plunger, 8 mm cam lift, 11.3 mm helix lead) are typical values.</p>
      </Section>
      <Charts />
      <PumpWorking />
    </div>
  )
}
