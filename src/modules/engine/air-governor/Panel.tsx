import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { governorRegulation } from '@/physics/engine'
import { DUST_DATA, dustConcentration, dustMeasured, flyweightAngle, flyweightRadius, fuelFraction, sleeveForce, type CleanerKind } from '@/physics/engineSystems'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { DESIGN, FULL_LOAD, G, dust, historyArrays, live, preload, stability, steadyPair, useAirGov } from './model'

const rpmOf = (w: number) => (w * 30) / Math.PI

function GovLive() {
  const v = useLive(() => ({ w: live.state.w, x: live.state.x }), 15, (a, b) => a.w === b.w && a.x === b.x)
  const st = useAirGov()
  const stab = useMemo(() => stability(st), [st])
  return (
    <Section title="Live — governor">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine speed" value={fmt(rpmOf(v.w), 4)} unit="rpm" tone="accent" />
        <Readout label="Sleeve lift" value={(v.x * 1000).toFixed(2)} unit="mm" />
        <Readout label="Flyweights out" value={((flyweightAngle(G, v.x) * 180) / Math.PI).toFixed(1)} unit="°" />
        <Readout label="Rack (fuel)" value={Math.round(fuelFraction(G, v.x) * 100)} unit="%" tone="warn" />
        <Readout label="Load" value={fmt(st.load, 3)} unit="N·m" />
        <Readout label="Loop" value={stab.stable ? 'stable' : 'HUNTING'} tone={stab.stable ? 'info' : 'warn'} />
      </div>
    </Section>
  )
}

function GovCharts() {
  const h = useLive(() => {
    const a = historyArrays()
    const t1 = a.t.length ? a.t[a.t.length - 1] : 0
    return { t: a.t.map((t) => t - t1), rpm: a.rpm, fuel: a.fuel, key: t1 }
  }, 8, (a, b) => a.key === b.key)
  return (
    <Section title="Speed and fuel vs time">
      <Chart data={[h.t, h.rpm]} series={[{ label: 'rpm', color: '#9bd17a', width: 2 }]} xLabel="Time (s, sim)" yLabel="Speed (rpm)" height={140} />
      <div className="h-2" />
      <Chart data={[h.t, h.fuel]} series={[{ label: 'fuel', color: '#ff7a45', width: 2 }]} xLabel="Time (s, sim)" yLabel="Rack (%)" yRange={[0, 100]} height={110} />
      <p className="mt-1 text-[11px] leading-snug text-dim">Throw full load on and off and watch the speed droop and recover. With low sleeve damping the governor over-corrects: the speed swings fast–slow–fast — hunting.</p>
    </Section>
  )
}

function DustChart() {
  const data = useMemo(() => {
    const hs: number[] = []
    const c: number[] = []
    const pts: (number | null)[] = []
    for (let i = 0; i <= 45; i++) {
      const h = (i / 45) * 0.9
      hs.push(h * 100)
      c.push(dustConcentration(h))
      const m = DUST_DATA.find((d) => Math.abs(d.h - h) < 0.011)
      pts.push(m ? m.c : null)
    }
    return [hs, c, pts]
  }, [])
  return (
    <Chart
      data={data}
      series={[
        { label: 'C', color: '#c99a5e', width: 2 },
        { label: 'Measured', color: '#f5b942', points: true, width: 0 },
      ]}
      xLabel="Intake height above dashboard (cm)"
      yLabel="Dust (g/m³)"
      marker={() => {
        const h = useAirGov.getState().height
        return [h * 100, dustConcentration(h)]
      }}
      height={140}
    />
  )
}

function GovWorking() {
  const st = useAirGov()
  const { n1, n2 } = steadyPair(st)
  const R = governorRegulation(n1.rpm, n2.rpm)
  const stab = stability(st)
  const x = n1.x
  const steps: WorkingStep[] = [
    {
      label: 'Worked example: speed regulation',
      tex: 'R = \\dfrac{N_1 - N_2}{(N_1 + N_2)/2}\\times100',
      sub: '= \\dfrac{1600 - 1500}{(1600 + 1500)/2}\\times100',
      result: `= ${n(governorRegulation(1600, 1500), 3)}\\ \\%`,
      cite: SRC.supp509('governor regulation example'),
    },
    {
      label: 'This governor at its lever setting (no load → full load 220 N·m)',
      tex: 'R = \\dfrac{N_1 - N_2}{(N_1 + N_2)/2}\\times100',
      sub: `= \\dfrac{${n(n1.rpm, 4)} - ${n(n2.rpm, 4)}}{(${n(n1.rpm, 4)} + ${n(n2.rpm, 4)})/2}\\times100`,
      result: `= ${n(R, 3)}\\ \\%\\quad(\\Delta N = ${n(n1.rpm - n2.rpm, 3)}\\ \\text{rpm})`,
      cite: SRC.supp509('a good governor holds within about 100 rpm'),
    },
    {
      label: 'Flyweight force on the sleeve balances the spring (no load)',
      tex: 'n\\,m\\,\\tfrac{b}{c}\\,r\\,\\Omega^2 = k\\,(x + s_0),\\quad r = r_p + \\tfrac{b}{c}x,\\ \\Omega = \\tfrac12\\omega',
      sub: `${G.n}\\times${G.m}\\times${G.b / G.c}\\times${n(flyweightRadius(G, x), 3)}\\times(${n(G.ratio * n1.omega, 4)})^2 = ${n(DESIGN.k, 4)}\\times(${n(x, 3)} + ${n(preload(st.setRpm), 3)})`,
      result: `F = ${n(sleeveForce(G, x, n1.omega), 4)}\\ \\text{N}`,
      beyond: true,
    },
    {
      label: 'Hunting: Routh–Hurwitz test of the linearised engine + governor loop',
      tex: '(Js + D)(Ms^2 + cs + k_{eff}) + K_T K_F = 0',
      sub: `${n(stab.coeffs[0], 3)}s^3 + ${n(stab.coeffs[1], 4)}s^2 + ${n(stab.coeffs[2], 4)}s + ${n(stab.coeffs[3], 4)} = 0`,
      result: `${stab.stable ? '\\text{stable}' : '\\text{unstable — hunts}'}\\quad(c = ${st.damping},\\ c_{crit} = ${n(stab.cCrit, 3)}\\ \\text{N·s/m})`,
      cite: SRC.ln518('Stability — Routh–Hurwitz'),
      beyond: true,
    },
  ]
  return <Working steps={steps} />
}

function AirWorking({ rpm }: { rpm: number }) {
  const st = useAirGov()
  const d = dust(st, rpm)
  const steps: WorkingStep[] = [
    {
      label: 'Dust concentration at the intake height (field survey)',
      tex: 'C(h)\\ \\text{interpolated between } 0.565,\\ 0.283,\\ 0.141\\ \\text{g/m}^3 \\text{ at } 0,\\ 45,\\ 74\\ \\text{cm}',
      sub: `h = ${n(st.height * 100, 3)}\\ \\text{cm}`,
      result: `C = ${n(d.C, 3)}\\ \\text{g/m}^3${dustMeasured(st.height) ? '' : '\\ (\\text{extrapolated})'}`,
      cite: SRC.tb509('§4.3 dust concentration vs height'),
    },
    {
      label: 'Air drawn in by the engine (3.3 L four-stroke, ηv 0.85)',
      tex: 'Q = \\eta_v V_d \\dfrac{N}{2\\times60}',
      sub: `= 0.85\\times3.3\\times10^{-3}\\times\\dfrac{${Math.round(rpm)}}{120}`,
      result: `= ${n(d.Q, 3)}\\ \\text{m}^3/\\text{s}`,
      cite: SRC.misc509('p3 volumetric efficiency'),
    },
    {
      label: 'Dust carried in and dust that gets past the cleaner',
      tex: '\\dot m_{dust} = C\\,Q\\times3600,\\quad \\dot m_{engine} = (1-\\eta_{cl})\\,\\dot m_{dust}',
      sub: `= ${n(d.C, 3)}\\times${n(d.Q, 3)}\\times3600,\\quad \\eta_{cl} = ${n(d.eff * 100, 3)}\\,\\%`,
      result: `= ${n(d.inGph, 3)}\\ \\text{g/h},\\quad ${n(d.passGph, 3)}\\ \\text{g/h} \\to ${n((d.passGph * 1000) / 1000, 3)}\\ \\text{kg per 1000 h}`,
      beyond: true,
    },
  ]
  return <Working steps={steps} />
}

export function AirGovPanel() {
  const st = useAirGov()
  const [note, setNote] = useState<string | null>(null)
  const rpm = useLive(() => Math.round(rpmOf(live.state.w) / 10) * 10, 4)
  const d = dust(st, rpm)
  return (
    <div>
      <GovLive />
      <Section title="Governor controls">
        <Slider label="Load torque" value={st.load} min={0} max={260} step={5} unit="N·m" onChange={(load) => st.set({ load })} hint="Full load = 220 N·m; above ≈ 245 N·m the rack is on its stop and the engine lugs down" />
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <button className="rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-warn/60" onClick={() => st.set({ load: FULL_LOAD })}>
            Throw on full load
          </button>
          <button className="rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-accent/60" onClick={() => st.set({ load: 0 })}>
            Throw off load
          </button>
        </div>
        <Slider label="Speed-control lever (no-load speed)" value={st.setRpm} min={900} max={1800} step={10} unit="rpm" onChange={(setRpm) => st.set({ setRpm })} hint="Sets the governor-spring preload" />
        <Slider label="Sleeve damping" value={st.damping} min={0} max={300} step={5} unit="N·s/m" onChange={(damping) => st.set({ damping })} hint="Friction / dashpot on the sleeve. Too little → hunting" />
      </Section>
      <Section title="Exam presets">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="rounded-md border border-line-2 px-2 py-1.5 text-left text-[12px] text-ink/80 hover:border-accent/50"
            onClick={() => {
              st.set({ setRpm: 1600, damping: 200, load: FULL_LOAD })
              setNote('Worked example: N1 = 1600 rpm with no load, N2 = 1500 rpm at full load → R = 100/1550 × 100 = 6.45 %. The spring was sized to give exactly this; the speed settles at 1500 rpm.')
            }}
          >
            1600 → 1500 rpm
          </button>
          <button
            className="rounded-md border border-line-2 px-2 py-1.5 text-left text-[12px] text-ink/80 hover:border-accent/50"
            onClick={() => {
              st.set({ setRpm: 1600, damping: 15, load: 0 })
              setNote('Sleeve damping cut to 15 N·s/m — below the critical value — so the flyweights overshoot and the speed hunts fast–slow–fast. Raise the damping to stop it.')
            }}
          >
            Hunting
          </button>
        </div>
        {note ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{note}</p> : null}
      </Section>
      <GovCharts />
      <Section title="Working — governor">
        <GovWorking />
      </Section>

      <Section title="Air cleaner">
        <Segmented<CleanerKind>
          value={st.cleaner}
          onChange={(cleaner) => st.set({ cleaner })}
          options={[
            { value: 'oil-bath', label: 'Oil bath', title: 'Oil-bath air cleaner' },
            { value: 'dry', label: 'Dry element', title: 'Dry paper-element air cleaner' },
          ]}
        />
        <Slider label="Intake height above dashboard" value={st.height * 100} min={0} max={90} step={1} unit="cm" onChange={(v) => st.set({ height: v / 100 })} />
        {st.cleaner === 'oil-bath' ? <Slider label="Oil level (1 = at the mark)" value={st.oilLevel} min={0} max={1.4} step={0.05} onChange={(oilLevel) => st.set({ oilLevel })} /> : null}
        {st.cleaner === 'oil-bath' && st.oilLevel > 1.15 ? <p className="mb-2 text-[11.5px] text-warn">Overfilled: oil is carried over into the engine.</p> : null}
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Dust at intake" value={fmt(d.C, 3)} unit="g/m³" tone="warn" />
          <Readout label="Air flow" value={fmt(d.Q * 60, 3)} unit="m³/min" />
          <Readout label="Cleaner η" value={fmt(d.eff * 100, 3)} unit="%" tone="info" />
          <Readout label="Dust in" value={fmt(d.inGph, 3)} unit="g/h" />
          <Readout label="Reaching engine" value={fmt(d.passGph, 3)} unit="g/h" tone="warn" />
          <Readout label="Engine speed" value={rpm} unit="rpm" />
        </div>
        <Toggle label="Show air and dust flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <div className="h-1" />
        <DustChart />
        <p className="mt-1 text-[10.5px] leading-snug text-dim">The three points are field measurements; cleaner efficiencies and the 3.3 L engine are typical values.</p>
      </Section>
      <Section title="Working — air intake">
        <AirWorking rpm={rpm} />
      </Section>
    </div>
  )
}
