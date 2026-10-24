import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { ROOMS, bedroomMinArea } from '@/physics/structures'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, PLANS, evaluate, useHouse, type PlanId } from './model'

const PRESETS: Preset[] = [
  {
    id: 'assignment',
    label: 'Courtyard house, family of 7',
    note: 'Parents, 3 boys and 2 girls: boys’ room max(9, 3 × 3) = 9 m², girls’ room max(9, 2 × 3) = 9 m², living room 12–15 m².',
    apply: () => useHouse.getState().set({ ...DEFAULTS, plan: 'courtyard', family: 7, scale: 1 }),
  },
  {
    id: 'one-room',
    label: 'One-room house, family of 5',
    note: 'Five people sleeping in one 20 m² room need max(9, 5 × 3) = 15 m² of sleeping space alone, with cooking and animals in the same room — the health hazard of the one-room plan.',
    apply: () => useHouse.getState().set({ ...DEFAULTS, plan: 'mp-one', family: 5, roof: 'thatch', pitch: 45 }),
  },
  {
    id: 'huts',
    label: 'Single-purpose huts, thatch',
    note: 'Thatch needs a slope of about 45° and eaves at least 2 m above the ground; floors raised 10–15 cm.',
    apply: () => useHouse.getState().set({ ...DEFAULTS, plan: 'sp-huts', family: 6, roof: 'thatch', pitch: 45, wallH: 2.1 }),
  },
  {
    id: 'crowded',
    label: 'Corridor house, family of 10',
    note: 'Ten people: two in the first bedroom and eight shared over the other three (3, 3, 2) — 9 m² rooms are enough for three; a fourth needs 12 m².',
    apply: () => useHouse.getState().set({ ...DEFAULTS, plan: 'corridor', family: 10 }),
  },
]

function Live() {
  const st = useHouse()
  const ev = useMemo(() => evaluate(st), [st])
  const all = ev.checks.length
  return (
    <Section title="Live" right={<Badge tone={ev.passes === all ? 'accent' : 'warn'}>{ev.passes} / {all} rooms meet the rules</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Floor area" value={fmt(ev.floor, 3)} unit="m²" />
        <Readout label="Wall area (material)" value={fmt(ev.wallArea, 3)} unit="m²" />
        <Readout label="External doors" value={ev.extDoors} tone={ev.extDoors <= 3 ? 'accent' : 'warn'} />
        <Readout label="Long axis off E–W" value={fmt(ev.ewDev, 3)} unit="°" tone={ev.ewOk ? 'accent' : 'warn'} />
        <Readout label="Floor raise" value={fmt(st.plinth * 100, 3)} unit="cm" tone={ev.plinthOk ? 'accent' : 'warn'} />
        <Readout label="Roof" value={st.roof === 'thatch' ? (ev.thatchOk ? 'thatch OK' : 'thatch: fix') : 'corrugated'} tone={ev.thatchOk ? 'accent' : 'warn'} />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useHouse()
  return (
    <Section title="Dwelling">
      <label className="mb-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-ink/90">Plan type</span>
        <select value={st.plan} onChange={(e) => st.set({ plan: e.target.value as PlanId })} className="w-56 rounded border border-line-2 bg-panel-2 px-1 py-0.5 text-[12px] text-ink">
          {(['Traditional', 'Contemporary'] as const).map((grp) => (
            <optgroup key={grp} label={grp}>
              {PLANS.filter((p) => p.group === grp).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <Slider label="Family size" value={st.family} min={1} max={14} step={1} onChange={(family) => st.set({ family })} />
      <Slider label="Plan scale" value={st.scale} min={0.7} max={1.4} step={0.01} unit="×" onChange={(scale) => st.set({ scale })} />
      <Slider label="Orientation of plan x-axis" value={st.orient} min={0} max={180} step={5} unit="° bearing" onChange={(orient) => st.set({ orient })} />
      <Slider label="Floor raise" value={st.plinth * 100} min={0} max={40} step={1} unit="cm" onChange={(v) => st.set({ plinth: v / 100 })} />
      <Slider label="Wall height" value={st.wallH} min={2} max={3.2} step={0.05} unit="m" onChange={(wallH) => st.set({ wallH })} />
      <Segmented
        value={st.roof}
        onChange={(roof) => st.set({ roof, pitch: roof === 'thatch' ? 45 : 15 })}
        options={[
          { value: 'corrugated', label: 'Corrugated steel' },
          { value: 'thatch', label: 'Thatch' },
        ]}
        size="sm"
      />
      <Slider label="Roof pitch" value={st.pitch} min={5} max={55} step={1} unit="°" onChange={(pitch) => st.set({ pitch })} />
      <Toggle label="Elaborately furnished living room (25–30 m²)" checked={st.elaborate} onChange={(elaborate) => st.set({ elaborate })} />
    </Section>
  )
}

function Rules() {
  const st = useHouse()
  const ev = useMemo(() => evaluate(st), [st])
  return (
    <Section title="Room-size check">
      <Table
        head={['Room', 'Area', 'People', 'Rule', '']}
        rows={ev.checks.map((c) => [c.room.name.split(' (')[0], `${fmt(c.area, 3)} m²`, c.people || '–', c.check!.need, c.check!.ok ? '✓' : '✗'])}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Bedrooms ≥ {ROOMS.bedroomMin} m² and ≥ {ROOMS.bedroomPerPerson} m² per person; living room {ROOMS.living.min}–{ROOMS.living.max} m² ({ROOMS.livingElaborate.min}–{ROOMS.livingElaborate.max} m² if elaborate); office ≈ {ROOMS.office} m²; washing slab ≥{' '}
        {ROOMS.washSlabMin} m². Two adults share the first bedroom; children are spread over the rest. Long axis east–west for shading; floor raised 10–15 cm.
      </p>
    </Section>
  )
}

function Compare() {
  const st = useHouse()
  return (
    <Section title="The seven plan types">
      <Table head={['Plan', 'For', 'Against']} highlight={PLANS.findIndex((p) => p.id === st.plan)} rows={PLANS.map((p) => [p.name, p.pros, p.cons])} />
    </Section>
  )
}

function Work() {
  const st = useHouse()
  const ev = useMemo(() => evaluate(st), [st])
  const steps: WorkingStep[] = ev.checks
    .filter((c) => c.room.kind === 'bedroom' || c.room.kind === 'multi')
    .slice(0, 4)
    .map((c) => ({
      label: c.room.name.split(' (')[0],
      tex: 'A_{min} = \\max(9,\\ 3n)',
      sub: `\\max(9,\\ 3\\times${c.people}) = ${bedroomMinArea(c.people)}\\ \\text{m}^2;\\quad A = ${n(c.room.w, 3)}\\times${n(c.room.d, 3)}`,
      result: `= ${n(c.area, 3)}\\ \\text{m}^2\\ ${c.check!.ok ? '\\ge' : '<'}\\ ${bedroomMinArea(c.people)}`,
      cite: C.ln('p17'),
    }))
  const liv = ev.checks.find((c) => c.room.kind === 'living')
  if (liv)
    steps.push({
      label: 'Living room',
      tex: st.elaborate ? '25 \\le A \\le 30\\ \\text{m}^2' : '12 \\le A \\le 15\\ \\text{m}^2',
      sub: `A = ${n(liv.room.w, 3)}\\times${n(liv.room.d, 3)}`,
      result: `= ${n(liv.area, 3)}\\ \\text{m}^2`,
      cite: C.ln('p17'),
    })
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
      <Rules />
      <Compare />
      <Work />
    </div>
  )
}
