import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import {
  axialForceUniformPressure,
  clutchTorque,
  frictionPairs,
  frictionRadiusUniformPressure,
  frictionRadiusUniformWear,
  powerFromTorque,
  pressureUniformWear,
  type ClutchTheory,
} from '@/physics/clutch'
import { TYPICAL_PEDAL, clutchPedal } from '@/physics/gearing'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../common/PanelBits'
import { DUAL_PRIMARY, DUAL_STAGE2, SP, WP } from './dims'
import { DEFAULTS, IPTO_SURFACES, dualCapacities, iptoCapacity, live, singleCapacity, useClutch, type Actuation, type ClutchKind, type ClutchParams } from './model'

const set = (p: Partial<ClutchParams>) => useClutch.getState().set(p)
const TONE = { engaged: 'accent', slipping: 'warn', released: 'info' } as const

const CALC_PRESETS: Preset[] = [
  {
    id: 'm8-9disc',
    label: '9-disc clutch',
    note: 'Di = 50 mm, Do = 70 mm, f = 0.1, p = 350 kPa, 5 steel + 4 bronze plates → 8 friction pairs. Expect F ≈ 660 N and T ≈ 16 N·m (uniform wear).',
    apply: () => set({ calcMode: 'pressure', calcP: 350e3, calcMu: 0.1, calcRo: 0.035, calcRi: 0.025, calcN1: 5, calcN2: 4, theory: 'wear' }),
  },
  {
    id: 'm8-plate',
    label: 'Plate clutch, F = 4 kN',
    note: 'Ri = 50, Ro = 100 mm, F = 4000 N, uniform wear: p_max = 254.6 kPa at Ri, p_min = 127.3 kPa at Ro, p_avg = 169.8 kPa.',
    apply: () => set({ calcMode: 'force', calcF: 4000, calcMu: 0.3, calcRo: 0.1, calcRi: 0.05, calcN1: 2, calcN2: 1, theory: 'wear' }),
  },
  {
    id: 'top-18',
    label: 'Wet pack, 10 + 9 plates',
    note: 'Ten driving and nine driven plates running in oil give 18 friction surfaces, n = 10 + 9 − 1.',
    apply: () => set({ calcMode: 'force', calcF: 6000, calcMu: 0.1, calcRo: 0.085, calcRi: 0.055, calcN1: 10, calcN2: 9 }),
  },
  {
    id: 'tractor',
    label: 'This tractor clutch',
    note: 'Single dry plate, 300 × 180 mm facings, 7.2 kN spring load, f = 0.3, two faces.',
    apply: () => set({ calcMode: 'force', calcF: SP.clampLoad, calcMu: SP.mu, calcRo: SP.Ro, calcRi: SP.Ri, calcN1: 2, calcN2: 1 }),
  },
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 15, (a, b) => a.gearbox === b.gearbox && a.pto === b.pto && a.cap === b.cap && a.state === b.state && a.pressure === b.pressure && a.capPto === b.capPto)
  const s = useClutch()
  return (
    <Section
      title="Live"
      right={
        <div className="flex gap-1">
          {s.kind !== 'ipto' ? <Badge tone={TONE[v.state]}>{s.kind === 'dual' ? 'transmission' : 'clutch'} {v.state}</Badge> : null}
          {s.kind !== 'single' ? <Badge tone={TONE[v.statePto]}>PTO {v.statePto}</Badge> : null}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine" value={fmt(v.engine, 4)} unit="rpm" />
        {s.kind !== 'ipto' ? <Readout label="Gearbox shaft" value={fmt(v.gearbox, 3)} unit="rpm" tone={TONE[v.state]} /> : null}
        {s.kind !== 'single' ? <Readout label="PTO shaft" value={fmt(v.pto, 3)} unit="rpm" tone={TONE[v.statePto]} /> : null}
        {s.kind !== 'ipto' ? <Readout label="Capacity now" value={fmt(v.cap, 3)} unit="N·m" /> : null}
        {s.kind === 'single' ? <Readout label="Clamp load" value={`${Math.round(v.clamp * 100)} %`} /> : null}
        {s.kind === 'single' ? <Readout label="Slip heat" value={fmt(v.heat, 2)} unit="kW" tone={v.heat > 0.5 ? 'warn' : 'ink'} /> : null}
        {s.kind !== 'single' ? <Readout label="PTO capacity" value={fmt(v.capPto, 3)} unit="N·m" /> : null}
        {s.kind === 'ipto' ? <Readout label="Oil pressure" value={fmt(v.pressure, 3)} unit="bar" tone="info" /> : null}
        {s.kind === 'ipto' ? <Readout label="Piston force" value={fmt(v.force / 1000, 3)} unit="kN" /> : null}
        {s.kind === 'ipto' ? <Readout label="PTO brake" value={v.braking ? 'ON' : 'off'} tone={v.braking ? 'warn' : 'ink'} /> : null}
        {s.kind === 'dual' ? <Readout label="Clamp T / PTO" value={`${Math.round(v.clamp * 100)} / ${Math.round(v.clampPto * 100)}`} unit="%" /> : null}
      </div>
      {s.kind === 'single' ? (
        <Note tone={v.drag > 0 || s.freePlay < TYPICAL_PEDAL.minFreePlay ? 'warn' : 'dim'}>
          {s.freePlay < TYPICAL_PEDAL.minFreePlay
            ? 'Too little free play: the thrust bearing rides on the levers — bearing wear and clutch slip.'
            : v.drag > 0
              ? 'Too much free play: the plate is not freed completely — drag, so gear engagement is difficult.'
              : v.bearing
                ? 'Free play taken up: the bearing is pushing the levers.'
                : 'Pedal in its free play: the bearing is clear of the levers.'}
        </Note>
      ) : null}
    </Section>
  )
}

function PedalZones({ kind, freePlay }: { kind: ClutchKind; freePlay: number }) {
  const T = TYPICAL_PEDAL.travel
  const seg = (a: number, b: number, color: string, title: string) => (
    <div title={title} style={{ left: `${(Math.max(0, a) / T) * 100}%`, width: `${((Math.min(T, b) - Math.max(0, a)) / T) * 100}%`, background: color }} className="absolute top-0 h-full" />
  )
  const B = kind === 'single' ? TYPICAL_PEDAL.bite : DUAL_PRIMARY.bite
  return (
    <div className="relative -mt-1 mb-2 h-1.5 overflow-hidden rounded bg-line-2">
      {seg(0, freePlay, '#6fb3e0', 'free play')}
      {seg(freePlay, freePlay + B, '#f5b942', kind === 'dual' ? 'transmission plate releasing' : 'bite (slipping)')}
      {kind === 'dual' ? seg(freePlay + DUAL_STAGE2, freePlay + DUAL_STAGE2 + B, '#e8794f', 'PTO plate releasing') : null}
    </div>
  )
}

function Controls() {
  const s = useClutch()
  return (
    <Section title="Clutch">
      <Segmented<ClutchKind>
        value={s.kind}
        onChange={(kind) => set({ kind, pedal: 0, spool: true })}
        options={[
          { value: 'single', label: 'Single plate', title: 'Single dry plate clutch' },
          { value: 'dual', label: 'Dual (live PTO)', title: 'Two-stage dual clutch for a live PTO' },
          { value: 'ipto', label: 'Wet IPTO', title: 'Wet multi-plate independent PTO clutch' },
        ]}
      />
      {s.kind !== 'ipto' ? (
        <>
          <Slider label="Pedal travel" value={s.pedal} min={0} max={150} step={1} unit="mm" onChange={(pedal) => set({ pedal })} />
          <PedalZones kind={s.kind} freePlay={s.freePlay} />
          <Slider label="Pedal free play" value={s.freePlay} min={0} max={50} step={1} unit="mm" onChange={(freePlay) => set({ freePlay })} hint="Typical setting 18 mm (¾ in)" />
          <Segmented<Actuation>
            label="Actuation"
            size="sm"
            value={s.actuation}
            onChange={(actuation) => set({ actuation })}
            options={[
              { value: 'mechanical', label: 'Mechanical' },
              { value: 'hydraulic', label: 'Hydraulic' },
              { value: 'electrical', label: 'Electrical' },
            ]}
          />
          <Note>
            {s.actuation === 'mechanical'
              ? 'Linkages and springs — a standard or an over-centre linkage.'
              : s.actuation === 'hydraulic'
                ? 'Pedal → master cylinder → ram (slave) cylinder; springs return the fluid on release. The most common method.'
                : 'Electrical control, direct (an electric actuator) or indirect (a solenoid valve working a hydraulic ram).'}
          </Note>
        </>
      ) : (
        <>
          <Toggle label="PTO lever: engaged" checked={s.spool} onChange={(spool) => set({ spool })} hint="Spool valve sends oil to the piston; neutral releases it and brakes the PTO" />
          <Note>Independent PTO: engaged or disengaged on the move with its own lever, whatever the main clutch is doing.</Note>
        </>
      )}
      <Slider label="Engine speed" value={s.engineRpm} min={600} max={2200} step={10} unit="rpm" onChange={(engineRpm) => set({ engineRpm })} />
      {s.kind !== 'ipto' ? <Slider label="Load on the gearbox shaft" value={s.load} min={0} max={600} step={10} unit="N·m" onChange={(load) => set({ load })} hint="0 = gearbox in neutral" /> : null}
      {s.kind !== 'single' ? <Slider label="Load on the PTO shaft" value={s.ptoLoad} min={0} max={1500} step={10} unit="N·m" onChange={(ptoLoad) => set({ ptoLoad })} /> : null}
      <Segmented<ClutchTheory>
        label="Friction radius"
        size="sm"
        value={s.theory}
        onChange={(theory) => set({ theory })}
        options={[
          { value: 'wear', label: 'Uniform wear (run-in)' },
          { value: 'pressure', label: 'Uniform pressure (new)' },
        ]}
      />
    </Section>
  )
}

function CapacityChart() {
  const s = useClutch()
  const data = useMemo(() => {
    const xs: number[] = []
    const a: number[] = []
    const b: number[] = []
    const full = s.kind === 'single' ? singleCapacity(s.theory) : dualCapacities(s.theory).trans
    const fullP = dualCapacities(s.theory).pto
    for (let p = 0; p <= 150; p += 1) {
      xs.push(p)
      const ps = clutchPedal(p, s.kind === 'single' ? { ...TYPICAL_PEDAL, freePlay: s.freePlay } : { ...DUAL_PRIMARY, freePlay: s.freePlay })
      a.push((ps.clamp + ps.drag) * full)
      const p2 = clutchPedal(p, { ...DUAL_PRIMARY, freePlay: s.freePlay + DUAL_STAGE2 })
      b.push((p2.clamp + p2.drag) * fullP)
    }
    return s.kind === 'dual' ? [xs, a, b] : [xs, a]
  }, [s.kind, s.theory, s.freePlay])
  if (s.kind === 'ipto') return null
  return (
    <Section title="Torque capacity vs pedal travel">
      <Chart
        data={data}
        series={s.kind === 'dual' ? [{ label: 'transmission', color: '#9bd17a', width: 2 }, { label: 'PTO', color: '#e8794f', width: 2 }] : [{ label: 'capacity', color: '#9bd17a', width: 2 }]}
        xLabel="Pedal travel (mm)"
        yLabel="Capacity (N·m)"
        marker={() => [useClutch.getState().pedal, live.cap]}
        height={160}
      />
      <Note>
        {s.kind === 'dual'
          ? 'First half of the travel frees the transmission plate (wheels stop, PTO runs); full travel frees the PTO plate too.'
          : `Flat for the free play, then the capacity falls as the levers take load off the plate. Load on the shaft: ${s.load} N·m — below the curve the clutch holds, above it slips.`}
      </Note>
    </Section>
  )
}

function Calculator() {
  const s = useClutch()
  const [preset, setPreset] = useState<string | null>(null)
  const Ro = s.calcRo
  const Ri = s.calcRi
  const F = s.calcMode === 'force' ? s.calcF : axialForceUniformPressure(s.calcP, Ro, Ri)
  const nPairs = frictionPairs(s.calcN1, s.calcN2)
  const Rp = frictionRadiusUniformPressure(Ro, Ri)
  const Rw = frictionRadiusUniformWear(Ro, Ri)
  const Rf = s.theory === 'pressure' ? Rp : Rw
  const T = clutchTorque(F, s.calcMu, Rf, nPairs)
  const steps: WorkingStep[] = []
  if (s.calcMode === 'pressure')
    steps.push({
      label: 'Axial force from the allowable pressure',
      tex: 'F = p\\,\\pi(R_o^2 - R_i^2)',
      sub: `= ${n(s.calcP / 1000, 4)}\\times10^3\\,\\pi(${n(Ro, 3)}^2 - ${n(Ri, 3)}^2)`,
      result: `= ${n(F, 4)}\\ \\text{N}`,
      cite: SRC.m503(8, 'F = pπ(Ro² − Ri²)'),
    })
  steps.push({
    label: 'Number of friction pairs',
    tex: 'n = n_1 + n_2 - 1',
    sub: `= ${s.calcN1} + ${s.calcN2} - 1`,
    result: `= ${nPairs}`,
    cite: SRC.top510('p7 — 10 + 9 → 18 surfaces'),
  })
  steps.push({
    label: s.theory === 'pressure' ? 'Friction radius — uniform pressure (new clutch)' : 'Friction radius — uniform wear (run-in clutch)',
    tex: s.theory === 'pressure' ? 'R_f = \\tfrac{2}{3}\\dfrac{R_o^3 - R_i^3}{R_o^2 - R_i^2}' : 'R_f = \\dfrac{R_o + R_i}{2}',
    sub: s.theory === 'pressure' ? `= \\tfrac23\\dfrac{${n(Ro, 3)}^3 - ${n(Ri, 3)}^3}{${n(Ro, 3)}^2 - ${n(Ri, 3)}^2}` : `= \\dfrac{${n(Ro, 3)} + ${n(Ri, 3)}}{2}`,
    result: `= ${n(Rf * 1000, 4)}\\ \\text{mm}\\quad(\\text{other theory: } ${n((s.theory === 'pressure' ? Rw : Rp) * 1000, 4)}\\ \\text{mm})`,
    cite: SRC.m503(8, 'friction radius'),
  })
  steps.push({
    label: 'Torque capacity',
    tex: 'T = n\\,f\\,F\\,R_f',
    sub: `= ${nPairs}\\times${n(s.calcMu, 3)}\\times${n(F, 4)}\\times${n(Rf, 4)}`,
    result: `= ${n(T, 4)}\\ \\text{N·m};\\quad P = \\tfrac{2\\pi N T}{60} = ${n(powerFromTorque(T, s.engineRpm) / 1000, 4)}\\ \\text{kW at ${s.engineRpm} rpm}`,
    cite: SRC.m503(8, 'T = F f R_f n; MG16'),
  })
  steps.push({
    label: 'Pressure under uniform wear (p·r constant)',
    tex: 'p = \\dfrac{F}{2\\pi r (R_o - R_i)},\\quad p_{max}\\ \\text{at}\\ R_i,\\ p_{min}\\ \\text{at}\\ R_o',
    sub: `p_{max} = \\dfrac{${n(F, 4)}}{2\\pi(${n(Ri, 3)})(${n(Ro - Ri, 3)})}`,
    result: `p_{max} = ${n(pressureUniformWear(F, Ri, Ro, Ri) / 1000, 4)},\\ p_{min} = ${n(pressureUniformWear(F, Ro, Ro, Ri) / 1000, 4)},\\ p_{avg} = ${n(F / (Math.PI * (Ro ** 2 - Ri ** 2)) / 1000, 4)}\\ \\text{kPa}`,
    cite: SRC.m503(8, 'uniform wear pressure'),
  })
  return (
    <>
      <Section title="Torque calculator">
        <Segmented<'force' | 'pressure'>
          size="sm"
          value={s.calcMode}
          onChange={(calcMode) => set({ calcMode })}
          options={[
            { value: 'force', label: 'Given F' },
            { value: 'pressure', label: 'Given p' },
          ]}
        />
        {s.calcMode === 'force' ? (
          <Slider label="Axial force F" value={s.calcF} min={100} max={30000} step={50} unit="N" onChange={(calcF) => set({ calcF })} />
        ) : (
          <Slider label="Pressure p" value={s.calcP / 1000} min={50} max={1500} step={5} unit="kPa" onChange={(v) => set({ calcP: v * 1000 })} />
        )}
        <Slider label="Friction coefficient f" value={s.calcMu} min={0.05} max={0.5} step={0.01} onChange={(calcMu) => set({ calcMu })} />
        <Slider label="Outer radius R_o" value={s.calcRo * 1000} min={20} max={200} step={1} unit="mm" onChange={(v) => set({ calcRo: Math.max(v / 1000, s.calcRi + 0.002) })} />
        <Slider label="Inner radius R_i" value={s.calcRi * 1000} min={10} max={190} step={1} unit="mm" onChange={(v) => set({ calcRi: Math.min(v / 1000, s.calcRo - 0.002) })} />
        <div className="grid grid-cols-2 gap-2">
          <Slider label="Driving plates" value={s.calcN1} min={1} max={12} step={1} onChange={(calcN1) => set({ calcN1 })} />
          <Slider label="Driven plates" value={s.calcN2} min={1} max={12} step={1} onChange={(calcN2) => set({ calcN2 })} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Pairs n" value={nPairs} />
          <Readout label="R_f" value={fmt(Rf * 1000, 4)} unit="mm" />
          <Readout label="Torque" value={fmt(T, 4)} unit="N·m" tone="accent" />
        </div>
        <div className="mt-2">
          <PresetGrid presets={CALC_PRESETS} active={preset} onPick={setPreset} />
        </div>
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

export function ClutchPanel() {
  const s = useClutch()
  return (
    <div>
      <LivePanel />
      <Controls />
      <CapacityChart />
      {s.kind === 'ipto' ? (
        <Section title="This pack">
          <Note>
            {WP.friction} friction plates between {WP.friction - 1} inter-plates, the piston and the drum face: n = {WP.friction + 1} + {WP.friction} − 1 = {IPTO_SURFACES} surfaces. At {WP.pressure / 1e5} bar,
            capacity ≈ {fmt(iptoCapacity(WP.pressure, s.theory), 3)} N·m (wet f = {WP.mu}). Pressure, piston size and f are typical (assumed) values.
          </Note>
        </Section>
      ) : null}
      <Calculator />
    </div>
  )
}

export { DEFAULTS }
