import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { DRIVES, HAZARD_LIMITS, HAZARD_SEPARATION, MACHINES, WORKSHOP, ft } from '@/physics/structures'
import { Badge, Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, STORED, design, useStorage } from './model'

const PRESETS: Preset[] = [
  {
    id: 'drives',
    label: 'Drive 18 ft, turning 45 ft',
    note: 'Two-way drive 18 ft = 5.5 m; turning radius 45 ft = 13.7 m (pad ≈ 27 m across); stalls 12 × 60 ft = 3.7 × 18.3 m.',
    apply: () => useStorage.getState().set({ driveW: ft(18), turnR: ft(45) }),
  },
  {
    id: 'fuel-close',
    label: 'Fuel store 10 m away',
    note: '400 L diesel exceeds 50 L, so it needs a separate store at least 15 m from any other building — 10 m fails.',
    apply: () => useStorage.getState().set({ fuelGap: 10, diesel: 400 }),
  },
  {
    id: 'small-fuel',
    label: '40 L diesel, 8 L petrol',
    note: 'Below 50 L diesel and 10 L petrol: no separate building is required (still stored apart, ventilated and locked).',
    apply: () => useStorage.getState().set({ diesel: 40, petrol: 8, kerosene: 0, thinner: 0 }),
  },
  {
    id: 'beam',
    label: 'Lifting span 2.5 m',
    note: 'Span ≤ 3 m: a timber lifting beam is enough; above 3 m use a truss or a portable hoist.',
    apply: () => useStorage.getState().set({ liftSpan: 2.5 }),
  },
]

function Live() {
  const st = useStorage()
  const D = useMemo(() => design(st), [st])
  const fuelBad = D.hazard.required && !D.fuelOk
  return (
    <Section title="Live" right={<Badge tone={fuelBad ? 'danger' : 'accent'}>{fuelBad ? 'fuel store too close' : 'layout OK'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Building" value={`${fmt(D.length, 3)} × ${fmt(D.depth, 3)}`} unit="m" />
        <Readout label="Eave height" value={fmt(D.height, 3)} unit="m" />
        <Readout label="Workshop door" value={`${fmt(D.door.w, 3)} × ${fmt(D.door.h, 3)}`} unit="m" tone="accent" />
        <Readout label="Side clearance" value={fmt(D.doorClear, 3)} unit="m" />
        <Readout label="Headroom" value={fmt(D.headroom, 3)} unit="m" />
        <Readout label="Lifting gear" value={D.lift} />
        <Readout label="Drive" value={fmt(st.driveW, 3)} unit={`m · ${D.drive}`} tone={D.drive === 'two-way' ? 'accent' : 'warn'} />
        <Readout label="Separate store" value={D.hazard.required ? 'required' : 'not required'} tone={D.hazard.required ? 'warn' : 'accent'} />
        <Readout label="Fuel store gap" value={fmt(st.fuelGap, 3)} unit="m" tone={D.fuelOk ? 'accent' : 'warn'} />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useStorage()
  return (
    <Section title="Sizing">
      <Slider label="Side clearance per side" value={st.sideClear} min={0.2} max={1.2} step={0.05} unit="m" onChange={(sideClear) => st.set({ sideClear })} hint="Typical value; the rule is only that the door is wide enough." />
      <Slider label="Head clearance" value={st.headClear} min={0.1} max={1} step={0.05} unit="m" onChange={(headClear) => st.set({ headClear })} />
      <Slider label="Working space round the tractor" value={st.workSpace} min={0.6} max={2} step={0.1} unit="m" onChange={(workSpace) => st.set({ workSpace })} />
      <Slider label="Lifting span" value={st.liftSpan} min={1.5} max={6} step={0.1} unit="m" onChange={(liftSpan) => st.set({ liftSpan })} />
      <Slider label="Drive width" value={st.driveW} min={2.5} max={8} step={0.1} unit="m" onChange={(driveW) => st.set({ driveW })} />
      <Slider label="Turning radius" value={st.turnR} min={8} max={18} step={0.1} unit="m" onChange={(turnR) => st.set({ turnR })} />
      <Slider label="Fuel store gap" value={st.fuelGap} min={4} max={30} step={0.5} unit="m" onChange={(fuelGap) => st.set({ fuelGap })} />
      <Slider label="Diesel held" value={st.diesel} min={0} max={1000} step={10} unit="L" onChange={(diesel) => st.set({ diesel })} />
      <Slider label="Petrol held" value={st.petrol} min={0} max={100} step={1} unit="L" onChange={(petrol) => st.set({ petrol })} />
      <Slider label="Kerosene held" value={st.kerosene} min={0} max={100} step={1} unit="L" onChange={(kerosene) => st.set({ kerosene })} />
      <Slider label="Cellulose thinner held" value={st.thinner} min={0} max={20} step={0.5} unit="L" onChange={(thinner) => st.set({ thinner })} />
      <Toggle label="Drive the tractor into the workshop" checked={st.drive} onChange={(drive) => st.set({ drive })} />
    </Section>
  )
}

function Bays() {
  const st = useStorage()
  const D = useMemo(() => design(st), [st])
  return (
    <Section title="Shed bays">
      <Table head={['Machine', 'L × W × H (m)', 'Bay width']} rows={STORED.map((k, i) => [MACHINES[k].name, `${MACHINES[k].l} × ${MACHINES[k].w} × ${MACHINES[k].h}`, `${fmt(D.shed.bays[i], 3)} m`])} />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        One nose-in bay per machine so none has to be moved to reach another. Machine sizes and clearances are typical values. Workbench {WORKSHOP.bench.h} m high, ≤ {WORKSHOP.bench.dMax * 1000} mm deep, ≥ {WORKSHOP.bench.lMin} m long; a second door for fire escape; 2–3 buckets of dry sand.
      </p>
    </Section>
  )
}

function Work() {
  const st = useStorage()
  const D = useMemo(() => design(st), [st])
  const tr = MACHINES.tractor
  const steps: WorkingStep[] = [
    {
      label: 'Workshop door for the tractor',
      tex: 'w_{door} = w + 2c,\\quad h_{door} = h + c_h',
      sub: `${n(tr.w, 3)} + 2\\times${n(st.sideClear, 3)};\\ ${n(tr.h, 3)} + ${n(st.headClear, 3)}`,
      result: `= ${n(D.door.w, 3)} \\times ${n(D.door.h, 3)}\\ \\text{m}`,
      cite: C.ln('p24 ii'),
      beyond: true,
    },
    {
      label: 'Shed size',
      tex: 'W = \\sum (w_i + 2c),\\quad D = \\max l_i + 0.6,\\quad H = \\max h_i + c_h',
      sub: D.shed.bays.map((b) => n(b, 3)).join(' + '),
      result: `W = ${n(D.shed.width, 3)},\\ D = ${n(D.shed.depth, 3)},\\ H = ${n(D.shed.height, 3)}\\ \\text{m}`,
      cite: C.ln('p26'),
      beyond: true,
    },
    {
      label: 'Lifting gear',
      tex: `\\text{span} \\le ${WORKSHOP.timberBeamMaxSpan}\\ \\text{m} \\Rightarrow \\text{timber beam}`,
      sub: `\\text{span} = ${n(st.liftSpan, 3)}\\ \\text{m}`,
      result: `\\Rightarrow \\text{${D.lift}}`,
      cite: C.ln('p24 iii'),
    },
    {
      label: 'Drive and turning',
      tex: '16\\text{–}20\\ \\text{ft two-way},\\ 12\\ \\text{ft one-way};\\ R = 40\\text{–}50\\ \\text{ft}',
      sub: `${n(DRIVES.twoWay.min, 3)}\\text{–}${n(DRIVES.twoWay.max, 3)}\\ \\text{m};\\ R = ${n(DRIVES.turningRadius.min, 3)}\\text{–}${n(DRIVES.turningRadius.max, 3)}\\ \\text{m}`,
      result: `${n(st.driveW, 3)}\\ \\text{m (${D.drive})},\\ \\text{pad } ${n(2 * st.turnR, 3)}\\ \\text{m}`,
      cite: C.ln('p21–22'),
    },
    {
      label: 'Hazardous store',
      tex: `V > ${HAZARD_LIMITS.diesel}\\ \\text{L diesel}, ${HAZARD_LIMITS.petrol}\\ \\text{L petrol}, ${HAZARD_LIMITS.kerosene}\\ \\text{L kerosene}, ${HAZARD_LIMITS.thinner}\\ \\text{L thinner} \\Rightarrow \\text{gap} \\ge ${HAZARD_SEPARATION}\\ \\text{m}`,
      sub: `\\text{over: ${D.hazard.over.join(', ') || 'none'}};\\ \\text{gap} = ${n(st.fuelGap, 3)}\\ \\text{m}`,
      result: D.hazard.required ? (D.fuelOk ? '\\text{separate store, OK}' : '\\text{too close}') : '\\text{no separate building needed}',
      cite: C.ln('p27'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <Live />
      <Controls />
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Bays />
      <Work />
    </div>
  )
}
