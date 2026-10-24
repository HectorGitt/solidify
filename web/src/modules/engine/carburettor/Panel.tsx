import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { liftHead } from '@/physics/engineSystems'
import { STOICH_AF, heatingValue } from '@/physics/fuel'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { FLOAT, SPEC, live, operatingPoint, useCarb } from './model'

const STRENGTH_TONE = { 'very rich': 'warn', rich: 'accent', correct: 'info', lean: 'accent', 'very lean': 'warn' } as const

const PRESETS = [
  { id: 'cold', label: 'Cold start (full choke)', note: 'Cranking at about 200 rpm with the choke shut: the choke adds its own suction at the jet, so the mixture is very rich — what a cold engine needs to fire.', p: { rpm: 200, throttle: 0.1, choke: 1, idle: true } },
  { id: 'idle', label: 'Idling', note: 'Throttle almost shut: the venturi is too slow to lift fuel, so the idle jet feeds the engine from manifold vacuum.', p: { rpm: 700, throttle: 0.04, choke: 0, idle: true } },
  { id: 'cruise', label: 'Part-load cruise', note: 'Main jet working: about 15 : 1 by weight.', p: { rpm: 1800, throttle: 0.4, choke: 0, idle: true } },
  { id: 'full', label: 'Full power', note: 'Throttle wide open at rated speed.', p: { rpm: 2400, throttle: 1, choke: 0, idle: true } },
  { id: 'choke-on', label: 'Choke left on', note: 'A half-closed choke on a warm engine: rich, smoky and wasteful.', p: { rpm: 1800, throttle: 0.6, choke: 0.55, idle: true } },
  { id: 'no-idle', label: 'Idle jet blocked', note: 'With the idle circuit blocked the engine cannot idle — the mixture is far too weak with the throttle shut.', p: { rpm: 700, throttle: 0.04, choke: 0, idle: false } },
] as const

function LivePanel() {
  const v = useLive(() => ({ ...live }), 12, (a, b) => a.cam === b.cam)
  const s = operatingPoint(useCarb.getState(), FLOAT.levelSet - v.level)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Air flow" value={fmt(v.air * 1000, 3)} unit="g/s" />
        <Readout label="Fuel flow" value={fmt(v.fuel * 1000, 3)} unit="g/s" />
        <Readout label="A/F by weight" value={Number.isFinite(v.af) ? `${fmt(v.af, 3)} : 1` : '—'} tone="accent" />
        <Readout label="Mixture" value={s.strength} tone={STRENGTH_TONE[s.strength]} />
        <Readout label="Throat speed" value={fmt(s.throatV, 3)} unit="m/s" />
        <Readout label="Jet suction" value={fmt(s.jetDep / 9.81, 3)} unit="mm H₂O" />
        <Readout label="Manifold" value={fmt(s.manifoldKPa, 3)} unit="kPa abs" />
        <Readout label="Float level" value={(v.level * 1000).toFixed(1)} unit="mm" tone={v.level < FLOAT.levelSet - 0.004 ? 'warn' : 'ink'} />
        <Readout label="Needle valve" value={`${Math.round(v.needle * 100)} %`} unit="open" />
      </div>
      {v.level < 0.008 ? <p className="mt-1.5 text-[11.5px] text-warn">Float chamber nearly empty — the jet is above the fuel and the engine starves until the needle valve refills it.</p> : null}
    </Section>
  )
}

function AfChart() {
  const rpm = useCarb((s) => s.rpm)
  const choke = useCarb((s) => s.choke)
  const idle = useCarb((s) => s.idle)
  const levelError = useCarb((s) => s.levelError)
  const data = useMemo(() => {
    const xs: number[] = []
    const af: (number | null)[] = []
    const st: number[] = []
    for (let i = 1; i <= 50; i++) {
      const t = i / 50
      const r = operatingPoint({ rpm: Math.max(rpm, 1), throttle: t, choke, idle, levelError })
      xs.push(t * 100)
      af.push(Number.isFinite(r.af) && r.af < 30 ? r.af : null)
      st.push(STOICH_AF)
    }
    return [xs, af, st]
  }, [rpm, choke, idle, levelError])
  return (
    <Section title="Mixture vs throttle">
      <Chart
        data={data}
        series={[
          { label: 'A/F', color: '#e8c94a', width: 2 },
          { label: '15 : 1', color: '#6fb3e0', width: 1, dash: [4, 4] },
        ]}
        xLabel="Throttle opening (%)"
        yLabel="Air–fuel ratio"
        yRange={[0, 30]}
        marker={() => (Number.isFinite(live.af) && live.af < 30 ? [useCarb.getState().throttle * 100, live.af] : null)}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">Below the dashed 15 : 1 line the mixture is rich, above it lean. At small openings the main jet stops and the idle circuit takes over.</p>
    </Section>
  )
}

function CarbWorking() {
  const st = useCarb()
  const r = operatingPoint(st)
  const rho = 101325 / (287 * 298.15)
  const Av = (Math.PI / 4) * SPEC.venturiD ** 2
  const eta = 0.28
  const fa = r.air > 0 ? r.fuel / r.air : 0
  const P = eta * heatingValue('petrol') * r.air * fa
  const steps: WorkingStep[] = [
    {
      label: 'Air speed at the venturi throat (continuity)',
      tex: 'v = \\dfrac{\\dot m_a}{C_d\\,\\rho\\,A_t}',
      sub: `= \\dfrac{${n(r.air * 1000, 3)}\\times10^{-3}}{${SPEC.venturiCd}\\times${n(rho, 3)}\\times${n(Av * 1e6, 3)}\\times10^{-6}}`,
      result: `= ${n(r.throatV, 3)}\\ \\text{m/s}`,
      beyond: true,
    },
    {
      label: 'Depression at the throat (Bernoulli) plus choke suction',
      tex: '\\Delta p = \\tfrac12\\rho v^2 + \\Delta p_{choke}',
      sub: `= \\tfrac12(${n(rho, 3)})(${n(r.throatV, 3)})^2 + ${n(r.jetDep - r.throatDep, 3)}`,
      result: `= ${n(r.jetDep, 4)}\\ \\text{Pa} \\approx ${n(r.jetDep / 9.81, 3)}\\ \\text{mm H}_2\\text{O}`,
      beyond: true,
    },
    {
      label: 'Fuel lifted up the main jet (head ρ g h to the jet tip)',
      tex: '\\dot m_f = C_d A_j\\sqrt{2\\rho_f\\,(\\Delta p - \\rho_f g h)}',
      sub: `h = ${n(r.lift * 1000, 3)}\\,\\text{mm}\\Rightarrow \\rho_f g h = ${n(liftHead(r.lift), 3)}\\,\\text{Pa},\\; d_j = ${SPEC.jetD * 1000}\\,\\text{mm}`,
      result: `\\dot m_{main} = ${n(r.mainFuel * 1000, 3)},\\;\\dot m_{idle} = ${n(r.idleFuel * 1000, 3)}\\ \\text{g/s}`,
      beyond: true,
    },
    {
      label: 'Air–fuel ratio and mixture strength',
      tex: 'A/F = \\dfrac{\\dot m_a}{\\dot m_f}\\quad(\\text{correct} \\approx 15:1 \\text{ by weight})',
      sub: `= \\dfrac{${n(r.air * 1000, 3)}}{${n(r.fuel * 1000, 3)}}`,
      result: `= ${Number.isFinite(r.af) ? n(r.af, 3) : '\\infty'} : 1\\quad(\\text{${r.strength}})`,
      cite: SRC.tb509('§4.4.3 mixture 1 : 15 by weight; Misc p3 SI range 12–18'),
    },
    {
      label: 'Power the mixture can give (petrol 11 100 kcal/kg, η ≈ 28 %)',
      tex: 'P = \\eta\\,HV\\,\\dot m_a\\,(F/A)',
      sub: `= ${eta}\\times${n(heatingValue('petrol') / 1e6, 4)}\\times10^6\\times${n(r.air, 3)}\\times${n(fa, 3)}`,
      result: `= ${n(P / 1000, 3)}\\ \\text{kW}`,
      cite: SRC.misc509('p4 eq 1.3; Supp calorific values; L2 petrol η 25–32 %'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function CarbPanel() {
  const st = useCarb()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Parameters<typeof st.set>[0]) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Controls">
        <Slider label="Engine speed" value={st.rpm} min={0} max={2600} step={10} unit="rpm" onChange={(rpm) => set({ rpm })} hint="0 = engine stopped (the bowl stays full and the pump idles)" />
        <Slider label="Throttle opening" value={st.throttle * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ throttle: v / 100 })} />
        <Slider label="Choke closed" value={st.choke * 100} min={0} max={100} step={1} unit="%" onChange={(v) => set({ choke: v / 100 })} />
        <Slider label="Float level error" value={st.levelError * 1000} min={-4} max={3} step={0.1} unit="mm" onChange={(v) => set({ levelError: v / 1000 })} hint="Float set too low → more lift → leaner; too high → richer (and flooding)" />
        <Toggle label="Idle (slow-running) circuit" checked={st.idle} onChange={(idle) => set({ idle })} />
        <Toggle label="Show fuel and air flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
        <button className="mt-1 w-full rounded-md border border-line-2 px-2 py-1.5 text-[12px] text-ink/85 hover:border-accent/60" onClick={() => st.emptyBowl()}>
          Empty the float chamber (watch it refill)
        </button>
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
        <p className="mt-1.5 text-[10.5px] leading-snug text-dim">
          The venturi/jet flow model and all dimensions (24 mm venturi, 1.29 mm main jet, 2 L engine) are typical values.
        </p>
      </Section>
      <AfChart />
      <CarbWorking />
    </div>
  )
}
