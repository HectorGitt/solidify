import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { PresetGrid, Note, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { FARMLAND, staticRear } from '@/physics/chassis'
import { CONCRETE, ETA_TRANSMISSION, UPPSALA, drawbarPoint, pullSpeedRun } from '@/physics/testing'
import { FARMLAND_GEARS } from '@/physics/tractor'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, CYL, LINK, RUN, instrument, live, solveCached, startRun, stopRun, surfaceOf, useDrawbar, type DrawbarParams, type Gear, type Meter } from './model'

const METER_LABEL: Record<Meter, string> = { cylinder: 'Car cylinder + transducer', link: 'Strain-gauge link', dillon: 'Dillon spring dial' }

function LivePanel() {
  const p = useDrawbar()
  const pt = solveCached(p)
  const r = useLive(() => ({ Pread: Math.round(live.Pread / 50) * 50, Pinst: Math.round(live.Pinst / 50) * 50 }), 12, (a, b) => a.Pread === b.Pread && a.Pinst === b.Pinst)
  const ins = instrument(r.Pread)
  const warn = pt.stalled ? 'Engine stalled — the pull is more than the engine can give in this gear.' : pt.spinning ? 'Wheels spinning — the tyres cannot develop this pull on this surface.' : ''
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Mean pull P" value={fmt(pt.P / 1000, 3)} unit="kN" tone="accent" />
        <Readout label={p.mode === 'dyno' ? 'Scale reading' : 'Instrument reads'} value={p.mode === 'dyno' ? fmt((pt.dyno?.scaleF ?? 0) / 1000, 3) : fmt(r.Pread / 1000, 3)} unit="kN" />
        <Readout label="Engine" value={fmt(pt.rpm, 4)} unit="rpm" tone={pt.stalled ? 'warn' : 'ink'} />
        <Readout label="Speed V" value={fmt(pt.V * 3.6, 3)} unit="km/h" />
        <Readout label="Wheel slip" value={fmt(pt.slip * 100, 3)} unit="%" tone={pt.slip > 0.15 ? 'warn' : 'ink'} />
        <Readout label="Drawbar power" value={fmt(pt.Pd / 1000, 3)} unit="kW" tone="accent" />
        <Readout label="Tractive eff." value={fmt(pt.etaT * 100, 3)} unit="%" />
        <Readout label="Fuel" value={fmt(pt.fuel.Lh, 3)} unit="L/h" />
        {p.mode === 'car' ? (
          p.meter === 'cylinder' ? (
            <Readout label="Oil pressure" value={fmt(ins.pressureMPa, 3)} unit="MPa" tone="info" />
          ) : p.meter === 'link' ? (
            <Readout label="Link strain" value={fmt(ins.microstrain, 3)} unit="µε" tone="info" />
          ) : (
            <Readout label="Spring stretch" value={fmt(ins.springMm, 3)} unit="mm" tone="info" />
          )
        ) : (
          <Readout label="Absorber" value={fmt(pt.dyno?.nAbsorber ?? 0, 4)} unit="rpm" tone="info" />
        )}
      </div>
      {warn ? <Note tone="warn">{warn}</Note> : null}
    </Section>
  )
}

function Controls() {
  const p = useDrawbar()
  const set = p.set
  return (
    <Section title="Test set-up">
      <Segmented<DrawbarParams['mode']>
        value={p.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'car', label: 'Test car on track', title: 'Nebraska test car' },
          { value: 'dyno', label: 'Chassis dynamometer', title: 'Uppsala chassis dynamometer' },
        ]}
      />
      <Segmented<string>
        label="Gear (Farmland tractor)"
        value={String(p.gear)}
        onChange={(g) => set({ gear: Number(g) as Gear })}
        options={[3, 5, 7].map((g) => ({ value: String(g), label: `${g} · q = ${FARMLAND_GEARS[g]}` }))}
        size="sm"
      />
      <Slider label="Hand throttle" value={p.throttle} min={0} max={1} step={0.01} onChange={(throttle) => set({ throttle })} hint="Tests are run at open throttle (1). Lower settings move the governor's high idle down." />
      {p.mode === 'car' ? (
        <>
          <Slider label="Load applied by the car (mean pull)" value={p.pull} min={0} max={30} step={0.1} unit="kN" onChange={(pull) => set({ pull })} />
          <Segmented<DrawbarParams['surface']>
            label="Track surface"
            value={p.surface}
            onChange={(surface) => set({ surface })}
            options={[
              { value: 'concrete', label: 'Concrete (test track)' },
              { value: 'soil', label: 'Soil (Brixius)' },
            ]}
            size="sm"
          />
          {p.surface === 'soil' ? <Slider label="Cone index CI" value={p.CI} min={300} max={2000} step={10} unit="kPa" onChange={(CI) => set({ CI })} hint="Worked example: CI = 860 kPa" /> : null}
          <Segmented<Meter> label="Drawbar dynamometer in the hitch line" value={p.meter} onChange={(meter) => set({ meter })} options={(['cylinder', 'link', 'dillon'] as Meter[]).map((m) => ({ value: m, label: METER_LABEL[m] }))} size="sm" />
          {p.meter === 'cylinder' ? <Slider label="Throttling valve (damping)" value={p.damping} min={0} max={1} step={0.01} onChange={(damping) => set({ damping })} hint="Closes down the oil passage to the transducer, smoothing the pull fluctuations" /> : null}
          <Toggle label="Ideal analysis (no slip, no rolling resistance, ηr = 1)" checked={p.ideal} onChange={(ideal) => set({ ideal })} />
        </>
      ) : (
        <>
          <Slider label="Range gearbox ratio (1 : k)" value={p.k} min={UPPSALA.rangeMin} max={UPPSALA.rangeMax} step={0.1} onChange={(k) => set({ k })} hint="Gearbox 1:1–7.7 after the fixed 1:18 box" />
          <Slider label="Absorber load setting" value={p.s} min={0} max={1} step={0.01} onChange={(s) => set({ s })} hint="Water level / valve setting of the hydraulic dynamometer" />
          <Note>
            The absorber torque rises as n² (power ∝ n³), so the tractor settles where its engine curve meets the reflected load. Drum radius {UPPSALA.drumR} m and scale arm {UPPSALA.arm} m are typical values.
          </Note>
        </>
      )}
    </Section>
  )
}

function TestRun() {
  const p = useDrawbar()
  const v = useLive(() => live.run.version, 10)
  const run = live.run
  void v
  const best = run.points.reduce<(typeof run.points)[number] | null>((a, b) => (!a || b.Pd > a.Pd ? b : a), null)
  return (
    <Section
      title="Test run · pull vs speed"
      right={
        <button
          className="rounded-md border border-accent/60 px-2 py-0.5 text-[11.5px] text-accent hover:bg-accent/10"
          onClick={() => (run.active ? stopRun('stopped') : startRun())}
        >
          {run.active ? 'Stop' : 'Run test'}
        </button>
      }
    >
      <p className="mb-1.5 text-[11.5px] leading-snug text-mute">
        Open throttle, gear {p.gear}: the car raises its load {RUN.stepkN} kN at a time and logs each steady point until the engine stalls or slip passes {RUN.slipLimit * 100} % (the 10–15 % optimum).
        {run.stoppedBy ? <span className="text-warn"> Stopped: {run.stoppedBy}.</span> : null}
      </p>
      {run.points.length ? (
        <div className="max-h-52 overflow-y-auto">
          <Table
            head={['P kN', 'V km/h', 'slip %', 'rpm', 'Pd kW', 'L/h']}
            rows={run.points.map((q) => [fmt(q.P / 1000, 3), fmt(q.V * 3.6, 3), fmt(q.slip * 100, 2), fmt(q.rpm, 4), fmt(q.Pd / 1000, 3), fmt(q.fuelLh, 3)])}
            highlight={best ? run.points.indexOf(best) : undefined}
          />
        </div>
      ) : null}
      {best ? (
        <Note tone="mute">
          Maximum drawbar power {fmt(best.Pd / 1000, 3)} kW at {fmt(best.P / 1000, 3)} kN. Before 1959 the rated drawbar power was 0.75 × the corrected maximum = {fmt((0.75 * best.Pd) / 1000, 3)} kW.
        </Note>
      ) : null}
    </Section>
  )
}

const PRESETS: Preset[] = [
  {
    id: 'g3-0',
    label: 'Ideal · gear 3, no load',
    note: 'Ideal analysis, open throttle, P = 0: the engine runs at high idle 2390 rpm. Expect 4.07 km/h.',
    apply: () => useDrawbar.getState().set({ mode: 'car', gear: 3, ideal: true, pull: 0, throttle: 1 }),
  },
  {
    id: 'g3-38',
    label: 'Ideal · gear 3, 38.31 kN',
    note: 'Ideal: P = 2qTe/D with Te = 173 N·m at 1300 rpm. Expect 38.31 kN at 2.21 km/h.',
    apply: () => useDrawbar.getState().set({ mode: 'car', gear: 3, ideal: true, pull: 38.3, throttle: 1 }),
  },
  {
    id: 'g7-0',
    label: 'Ideal · gear 7, no load',
    note: 'Ideal, P = 0: expect 11.99 km/h (D ≈ 1.26 m gives 12.0).',
    apply: () => useDrawbar.getState().set({ mode: 'car', gear: 7, ideal: true, pull: 0, throttle: 1 }),
  },
  {
    id: 'concrete',
    label: 'Tyre on concrete',
    note: 'Concrete: about 2 % motion resistance and 5 % slip give TE = 92.5 % for the tyre. Here the pull is set for 5 % rear slip; the whole tractor’s ηt is a little lower because the front wheels also roll.',
    apply: () => useDrawbar.getState().set({ mode: 'car', gear: 5, ideal: false, surface: 'concrete', pull: 17.9, throttle: 1 }),
  },
  {
    id: 'soil-860',
    label: 'Soil · CI 860 kPa',
    note: 'Same pull on soil with a cone index of 860 kPa: slip and rolling resistance rise, and drawbar power falls.',
    apply: () => useDrawbar.getState().set({ mode: 'car', gear: 5, ideal: false, surface: 'soil', CI: 860, pull: 12, throttle: 1 }),
  },
  {
    id: 'uppsala',
    label: 'Chassis dyno',
    note: 'Drums → 1:18 → 1:1–7.7 → hydraulic dynamometer on the pendulum frame. The scale force F on arm l gives P = 2πlFn/60 000 kW.',
    apply: () => useDrawbar.getState().set({ mode: 'dyno', gear: 5, k: 4, s: 0.8, throttle: 1 }),
  },
]

function Charts() {
  const surface = useDrawbar((s) => s.surface)
  const CI = useDrawbar((s) => s.CI)
  const throttle = useDrawbar((s) => s.throttle)
  const gear = useDrawbar((s) => s.gear)
  const mode = useDrawbar((s) => s.mode)
  const data = useMemo(() => {
    const surf = surfaceOf({ surface, CI })
    const xs: number[] = []
    for (let P = 0; P <= 40; P += 0.5) xs.push(P)
    const series = ([3, 5, 7] as Gear[]).flatMap((g) => {
      const q = FARMLAND_GEARS[g]
      const real = xs.map((P) => {
        const pt = drawbarPoint({ P: P * 1000, q, surface: surf, throttle })
        return pt.stalled || pt.spinning ? null : pt.V * 3.6
      })
      const ideal = xs.map((P) => {
        const pt = drawbarPoint({ P: P * 1000, q, surface: surf, throttle, ideal: true })
        return pt.stalled ? null : pt.V * 3.6
      })
      return [real, ideal]
    })
    const run = pullSpeedRun(FARMLAND_GEARS[gear], surf, { throttle, steps: 80, maxPull: 40000 })
    const px = run.map((r) => r.P / 1000)
    return { xs, series, power: { x: px, pd: run.map((r) => r.Pd / 1000), slip: run.map((r) => r.slip * 100), te: run.map((r) => r.etaT * 100) } }
  }, [surface, CI, throttle, gear])
  const colors = { 3: '#e8794f', 5: '#9bd17a', 7: '#6fb3e0' } as const
  return (
    <Section title="Pull–speed curves">
      <Chart
        data={[data.xs, ...data.series]}
        series={([3, 5, 7] as Gear[]).flatMap((g) => [
          { label: `gear ${g}`, color: colors[g], width: g === gear ? 2.4 : 1.2 },
          { label: `gear ${g} ideal`, color: colors[g], width: 1, dash: [4, 4] },
        ])}
        xLabel="Drawbar pull (kN)"
        yLabel="Speed (km/h)"
        marker={() => {
          const pt = solveCached(useDrawbar.getState())
          return mode === 'car' || pt.dyno ? [pt.P / 1000, pt.V * 3.6] : null
        }}
        height={190}
      />
      <Note>
        Dashed: ideal (speed set by engine speed, pull by engine torque). Solid: with slip, rolling resistance and ηr = 0.98⁵ on the selected surface.
      </Note>
      <div className="h-2" />
      <Chart
        data={[data.power.x, data.power.pd, data.power.slip, data.power.te]}
        series={[
          { label: 'drawbar power kW', color: '#f5b942', width: 2 },
          { label: 'slip %', color: '#e0564a', width: 1.5 },
          { label: 'ηt %', color: '#6fb3e0', width: 1.2, dash: [3, 3] },
        ]}
        xLabel={`Drawbar pull, gear ${gear} (kN)`}
        yLabel="kW · %"
        marker={() => {
          const pt = solveCached(useDrawbar.getState())
          return [pt.P / 1000, pt.Pd / 1000]
        }}
        height={170}
      />
    </Section>
  )
}

function WorkingPanel() {
  const p = useDrawbar()
  const pt = solveCached(p)
  const q = FARMLAND_GEARS[p.gear]
  const Wr = staticRear(FARMLAND)
  const steps: WorkingStep[] = []
  if (p.mode === 'dyno' && pt.dyno) {
    const d = pt.dyno
    steps.push({
      label: 'Drum → absorber speeds',
      tex: 'n_{drum} = \\dfrac{V}{2\\pi r_d},\\quad n_{abs} = 18\\,k\\,n_{drum}',
      sub: `= \\dfrac{${n(pt.V, 4)}}{2\\pi(${UPPSALA.drumR})}\\times60,\\quad 18\\times${n(p.k, 3)}\\times${n(d.nDrum, 4)}`,
      result: `n_{drum} = ${n(d.nDrum, 4)}\\ \\text{rpm},\\; n_{abs} = ${n(d.nAbsorber, 4)}\\ \\text{rpm}`,
      cite: C.chassis,
    })
    steps.push({
      label: 'Pendulum frame and scale',
      tex: 'T = F\\,l = P\\,r_d \\;\\Rightarrow\\; F = \\dfrac{P\\,r_d}{l}',
      sub: `= \\dfrac{${n(pt.P, 4)}\\times${UPPSALA.drumR}}{${UPPSALA.arm}}`,
      result: `F = ${n(d.scaleF, 4)}\\ \\text{N}`,
      cite: SRC.tests502('p5, eq 4'),
    })
    steps.push({
      label: 'Power from the scale',
      tex: '\\text{Power} = \\dfrac{2\\pi l F n}{60\\,000}',
      sub: `= \\dfrac{2\\pi(${UPPSALA.arm})(${n(d.scaleF, 4)})(${n(d.nDrum, 4)})}{60\\,000}`,
      result: `= ${n(d.scalePowerkW, 4)}\\ \\text{kW}\\;(= P\\,V)`,
      cite: SRC.tests502('p5, eq 3'),
    })
  } else {
    steps.push({
      label: 'Weight transfer to the rear axle',
      tex: 'V_r = W_r + \\dfrac{P\\,y\'}{x}',
      sub: `= ${n(Wr, 4)} + \\dfrac{${n(pt.P, 4)}\\times${FARMLAND.yd}}{${FARMLAND.x}}`,
      result: `= ${n(pt.Vr, 4)}\\ \\text{N}`,
      cite: C.mac,
    })
    if (!p.ideal) {
      steps.push({
        label: 'Net traction ratio and slip',
        tex: '\\text{NTR} = \\dfrac{P}{V_r},\\quad \\text{NTR} = \\text{GTR}(s)-\\text{MRR}(s)\\ \\text{solved for } s',
        sub: `\\text{NTR} = \\dfrac{${n(pt.P, 4)}}{${n(pt.Vr, 4)}} = ${n(pt.NTR, 3)}`,
        result: `s = ${n(pt.slip * 100, 3)}\\,\\%`,
        cite: p.surface === 'soil' ? SRC.l27('eqs 5, 14–16') : SRC.l27('p37 concrete'),
        beyond: p.surface === 'concrete',
      })
      steps.push({
        label: 'Rolling resistance and soil reaction',
        tex: 'R = \\text{MRR}_r V_r + \\text{MRR}_f V_f,\\quad H = P + R',
        sub: p.surface === 'concrete' ? `\\text{MRR} = ${CONCRETE.MRR}` : `V_f = ${n(pt.Vf, 4)}\\ \\text{N}`,
        result: `R = ${n(pt.R, 4)}\\ \\text{N},\\quad H = ${n(pt.H, 4)}\\ \\text{N}`,
        cite: C.mech('p7, eq 2.7'),
      })
    }
    steps.push({
      label: 'Engine torque needed',
      tex: 'T_e = \\dfrac{H\\,D}{2\\,q\\,\\eta_r}',
      sub: `= \\dfrac{${n(pt.H, 4)}\\times1.26}{2\\times${q}\\times${n(p.ideal ? 1 : ETA_TRANSMISSION, 3)}}`,
      result: `= ${n(pt.Te, 4)}\\ \\text{N·m}\\;\\Rightarrow\\; N_e = ${n(pt.rpm, 4)}\\ \\text{rpm (engine curve)}`,
      cite: C.mech('p3, eq 2.2; p8, eq 2.12'),
    })
    steps.push({
      label: 'Travel speed',
      tex: 'V_0 = \\dfrac{\\pi D N_e}{q},\\quad V = V_0(1-i)',
      sub: `V_0 = \\dfrac{\\pi(1.26)(${n(pt.rpm, 4)}/60)}{${q}}`,
      result: `V_0 = ${n(pt.V0 * 3.6, 4)},\\; V = ${n(pt.V * 3.6, 4)}\\ \\text{km/h}`,
      cite: C.mech('p1, eq 2.1; p7, eq 2.6'),
    })
    steps.push({
      label: 'Drawbar power and tractive efficiency',
      tex: 'Q_d = P\\,V,\\quad \\eta_t = \\dfrac{P}{P+R}(1-i)',
      sub: `Q_d = ${n(pt.P, 4)}\\times${n(pt.V, 4)}`,
      result: `Q_d = ${n(pt.Pd / 1000, 4)}\\ \\text{kW},\\; \\eta_t = ${n(pt.etaT * 100, 3)}\\,\\%`,
      cite: C.mech('p3, eq 2.4; p8, eq 2.10'),
    })
    if (p.meter === 'cylinder') {
      const A = (Math.PI / 4) * (CYL.bore ** 2 - CYL.rod ** 2)
      steps.push({
        label: 'Test-car cylinder pressure',
        tex: 'p = \\dfrac{P}{A},\\quad A = \\tfrac{\\pi}{4}(D^2-d^2)',
        sub: `= \\dfrac{${n(pt.P, 4)}}{${n(A, 4)}}`,
        result: `= ${n(pt.P / A / 1e6, 4)}\\ \\text{MPa}`,
        cite: C.car,
        beyond: true,
      })
    } else if (p.meter === 'link') {
      steps.push({
        label: 'Strain in the gauge link',
        tex: '\\varepsilon = \\dfrac{P}{E A}',
        sub: `= \\dfrac{${n(pt.P, 4)}}{${n(LINK.E / 1e9, 3)}\\times10^9\\times${n(LINK.A, 3)}}`,
        result: `= ${n((pt.P / (LINK.E * LINK.A)) * 1e6, 4)}\\ \\mu\\varepsilon`,
        cite: C.gauge,
        beyond: true,
      })
    }
  }
  const fuel = pt.fuel
  steps.push({
    label: 'Engine efficiency from the fuel the car measures',
    tex: '\\eta_e = \\dfrac{2\\pi T_e N_e}{1000\\,FC\\,C}',
    sub: `FC = ${n(fuel.kgh / 60, 3)}\\ \\text{kg/min},\\; C = 44\\,170\\ \\text{kJ/kg}`,
    result: `\\eta_e = ${n(fuel.etaE * 100, 3)}\\,\\%`,
    cite: C.mech('p9, eq 2.13'),
    beyond: true,
  })
  return (
    <Section title="Working">
      <Working steps={steps} />
      <Note>Fuel use comes from a Willans-line model set to ηe = 0.30 at rated load (a typical value).</Note>
    </Section>
  )
}

export function DrawbarPanel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam & worked-example presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <TestRun />
      <Charts />
      <WorkingPanel />
    </div>
  )
}
