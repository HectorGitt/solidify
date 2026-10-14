import { useState } from 'react'
import { PresetGrid, type Preset } from '@/modules/vibration/_shared/ui'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, live, useGreenhouse } from './model'
import { GREENHOUSE, ventRateMid, ventFlow, solarLoad, riseFor, fansNeeded, doorAreaRange, AIR, DENSITY, arealMass } from '@/physics/structures'

const PRESETS: Preset[] = [
  {
    id: 'worked',
    label: 'Example: Glass house',
    note: 'A glass house 9.6 m wide (3 × 3.2 m bays) × 43 m long. Q = 0.045 × 413 = 18.6 m³/s. Needs 8 fans of 2.5 m³/s.',
    flag: '',
    apply: () => useGreenhouse.getState().set({ ...DEFAULTS }),
  },
  {
    id: 'poly',
    label: 'Example: Polythene',
    note: 'Same 413 m² floor but polythene. Q = 0.035 × 413 = 14.5 m³/s.',
    flag: '',
    apply: () => useGreenhouse.getState().set({ ...DEFAULTS, cladding: 'polythene', qFans: 6 }),
  }
]

function LivePanel() {
  const v = useLive(() => ({ ...live }), 10)
  return (
    <Section title="Live" right={v.dt >= 4 ? <Badge tone="warn">{"ΔT >= 4 °C"}</Badge> : <Badge tone="accent">{"ΔT < 4 °C"}</Badge>}>
      <div className="grid grid-cols-2 gap-1.5">
        <Readout label="Floor area" value={fmt(v.floorArea, 1)} unit="m²" />
        <Readout label="Required Q (mid)" value={fmt(v.qAir, 1)} unit="m³/s" tone="accent" />
        <Readout label="Actual Q (fans + doors)" value={fmt(v.qAir, 1)} unit="m³/s" />
        <Readout label="Est. Temp Rise ΔT" value={fmt(v.dt, 2)} unit="°C" tone={v.dt >= 4 ? 'warn' : 'accent'} />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useGreenhouse()
  return (
    <Section title="Greenhouse">
      <Slider label="Bays" value={st.bays} min={1} max={10} step={1} onChange={(bays) => st.set({ bays })} />
      <Slider label="Length" value={st.length} min={10} max={100} step={1} unit="m" onChange={(length) => st.set({ length })} />
      <Segmented
        value={st.cladding}
        onChange={(c) => st.set({ cladding: c as any })}
        options={[
          { value: 'glass', label: 'Glass' },
          { value: 'polythene', label: 'Polythene' },
          { value: 'frp', label: 'FRP' },
        ]}
        size="sm"
      />
      <div className="mt-2" />
      <Slider label="Fans (2.5 m³/s)" value={st.qFans} min={0} max={20} step={1} onChange={(qFans) => st.set({ qFans })} />
      <Toggle label="Doors open (Natural vent)" checked={st.doorsOpen} onChange={(doorsOpen) => st.set({ doorsOpen })} />
      <Toggle label="Whitewash (Shading)" checked={st.whitewash} onChange={(whitewash) => st.set({ whitewash })} />
      <Toggle label="Evaporative cooling pad" checked={st.pad} onChange={(pad) => st.set({ pad })} />
    </Section>
  )
}

function WorkingSection() {
  const st = useGreenhouse()
  
  const A = st.bays * GREENHOUSE.bay * st.length
  const c = st.cladding === 'frp' ? 'polythene' : st.cladding
  const qRate = ventRateMid(c)
  const Q = ventFlow(qRate, A)
  const fans = fansNeeded(Q, st.fanCapacity)
  const doors = doorAreaRange(A)
  
  const steps: WorkingStep[] = [
    {
      label: 'Floor area',
      tex: 'A = \\text{bays} \\times \\text{bay width} \\times L',
      sub: `= ${st.bays} \\times ${GREENHOUSE.bay} \\times ${st.length}`,
      result: `= ${n(A, 1)}\\ \\text{m}^2`,
      cite: C.aee505('p29')
    },
    {
      label: 'Ventilation flow (mid rate)',
      tex: 'Q = \\text{rate} \\times A',
      sub: `= ${qRate} \\times ${n(A, 1)}`,
      result: `= ${n(Q, 2)}\\ \\text{m}^3\\text{/s}`,
      cite: C.aee505('p30')
    },
    {
      label: 'Fans required',
      tex: 'N = \\lceil Q / \\text{capacity} \\rceil',
      sub: `= \\lceil ${n(Q, 2)} / ${st.fanCapacity} \\rceil`,
      result: `= ${fans}\\ \\text{fans}`,
      cite: C.aee505('p30 worked example')
    },
    {
      label: 'Natural ventilation (door area 3-7%)',
      tex: 'A_{doors} = (0.03 \\dots 0.07) \\times A',
      sub: `= 0.03 \\times ${n(A, 1)} \\dots 0.07 \\times ${n(A, 1)}`,
      result: `= ${n(doors.min, 1)} \\dots ${n(doors.max, 1)}\\ \\text{m}^2`,
      cite: C.aee505('p30')
    },
    {
      label: 'Glazing load errata',
      tex: 'M = \\rho \\times t',
      sub: `= ${DENSITY.glass}\\ \\text{kg/m}^3 \\times 0.004\\ \\text{m}`,
      result: `= ${arealMass(DENSITY.glass, 0.004)}\\ \\text{kg/m}^2`,
      cite: C.aee505('p30'),
      errata: 'Notes list 4 mm glass as 2.8 kg/m².'
    }
  ]
  
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

function HeatBalance() {
  const st = useGreenhouse()
  const A = st.bays * GREENHOUSE.bay * st.length
  const c = st.cladding === 'frp' ? 'polythene' : st.cladding
  const qSensible = solarLoad(800, c, st.whitewash ? 0.3 : 0) * A
  const Qactual = st.qFans * st.fanCapacity + (st.doorsOpen ? ventFlow(ventRateMid(c), A) : 0)
  const dt = riseFor(qSensible, Qactual)
  
  const steps: WorkingStep[] = [
    {
      label: 'Sensible heat removed (SUPP)',
      tex: 'q = \\rho \\cdot c_p \\cdot Q \\cdot \\Delta T',
      sub: `= ${AIR.rho} \\times ${AIR.cp} \\times ${n(Qactual, 1)} \\times ${n(dt, 2)}`,
      result: `= ${n(qSensible / 1000, 1)}\\ \\text{kW}`,
      beyond: true,
      cite: C.aee505('p30 implicit')
    }
  ]
  
  return (
    <Section title="Heat balance [SUPP]">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Controls />
      <WorkingSection />
      <HeatBalance />
    </div>
  )
}
