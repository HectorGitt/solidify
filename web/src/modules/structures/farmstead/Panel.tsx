import { useMemo, useState } from 'react'
import { PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { DRIVES, FARMSTEAD_MAX_FRACTION, FT, HAZARD_SEPARATION, SITE_CRITERIA, ZONES, ZONE_WIDTH, driveVerdict, ft, turningPad, zoneWidthOk } from '@/physics/structures'
import { Badge, Readout, Section, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, assess, useFarmstead } from './model'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

const PRESETS: Preset[] = [
  {
    id: 'figure',
    label: 'Zone plan, wind from the south',
    note: 'Four 20 m zones tangent at the road, wind blowing up the layout axis: dwelling upwind, livestock at the far downwind end.',
    apply: () => useFarmstead.getState().set({ ...DEFAULTS, widths: [20, 20, 20, 20], windFrom: 180 }),
  },
  {
    id: 'drives',
    label: 'Drives & turning (18 ft, 45 ft)',
    note: 'Two-way drive 18 ft = 5.5 m; three 12 × 60 ft stalls = 11.0 × 18.3 m; turning radius 45 ft = 13.7 m, so a cleared pad ≈ 27 m across.',
    apply: () => useFarmstead.getState().set({ driveW: ft(18), turnR: ft(45) }),
  },
  {
    id: 'wrong-wind',
    label: 'Wind from the north',
    note: 'The wind now blows from the livestock towards the house: odour, dust and flies reach zone 1. Re-orient the layout so livestock are downwind.',
    apply: () => useFarmstead.getState().set({ windFrom: 0 }),
  },
  {
    id: 'fuel',
    label: 'Fuel store too close',
    note: 'The fuel store is only 8 m from the workshop: it must be at least 15 m from any other building.',
    apply: () => useFarmstead.getState().set({ fuelGap: 8 }),
  },
]

function Live() {
  const st = useFarmstead()
  const a = useMemo(() => assess(st), [st])
  const dv = driveVerdict(st.driveW)
  return (
    <Section title="Live" right={<Badge tone={a.verdict === 'good' && !a.plumeHits ? 'accent' : a.verdict === 'bad' || a.plumeHits ? 'danger' : 'warn'}>{a.plumeHits ? 'odour reaches dwelling' : a.verdict === 'good' ? 'livestock downwind' : a.verdict}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Wind from" value={`${fmt(st.windFrom, 3)}° ${compass(st.windFrom)}`} />
        <Readout label="Wind vs axis" value={fmt(a.angle, 3)} unit="°" tone={a.verdict === 'good' ? 'accent' : 'warn'} />
        <Readout label="Farmstead depth" value={fmt(a.L.far, 3)} unit="m" />
        <Readout label="Farmstead area" value={fmt(a.area / 1e4, 3)} unit="ha" />
        <Readout label="Of production area" value={fmt(a.frac * 100, 3)} unit="%" tone={a.fracOk ? 'accent' : 'warn'} />
        <Readout label="Fuel store gap" value={fmt(a.fuelGap, 3)} unit="m" tone={a.fuelOk ? 'accent' : 'warn'} />
        <Readout label="Drive" value={fmt(st.driveW, 3)} unit={`m · ${dv}`} tone={dv === 'two-way' ? 'accent' : 'warn'} />
        <Readout label="Turning pad" value={fmt(turningPad(st.turnR), 3)} unit="m dia." />
        <Readout label="Zone widths" value={st.widths.every(zoneWidthOk) ? 'OK' : 'out of range'} tone={st.widths.every(zoneWidthOk) ? 'accent' : 'warn'} />
      </div>
    </Section>
  )
}

function Controls() {
  const st = useFarmstead()
  return (
    <Section title="Layout">
      <Slider label={`Prevailing wind from (${compass(st.windFrom)})`} value={st.windFrom} min={0} max={359} step={1} unit="°" onChange={(windFrom) => st.set({ windFrom })} hint="Bearing the wind blows from; the layout axis (road → livestock) points north." />
      {ZONES.map((z, i) => (
        <Slider key={z.n} label={`Zone ${z.n} width · ${z.short}`} value={st.widths[i]} min={6} max={36} step={1} unit="m" onChange={(w) => st.setWidth(i, w)} hint={`${ZONE_WIDTH.min}–${ZONE_WIDTH.max} m`} />
      ))}
      <Slider label="Access drive width" value={st.driveW} min={2.5} max={8} step={0.1} unit="m" onChange={(driveW) => st.set({ driveW })} />
      <Slider label="Turning radius" value={st.turnR} min={8} max={18} step={0.1} unit="m" onChange={(turnR) => st.set({ turnR })} />
      <Slider label="Fuel store to workshop" value={st.fuelGap} min={4} max={30} step={0.5} unit="m" onChange={(fuelGap) => st.set({ fuelGap })} />
      <Slider label="Production area" value={st.prodHa} min={10} max={300} step={5} unit="ha" onChange={(prodHa) => st.set({ prodHa })} />
      <Toggle label="Show odour plume" checked={st.plume} onChange={(plume) => st.set({ plume })} />
    </Section>
  )
}

function ZoneRule() {
  return (
    <Section title="Zone ordering rule">
      <Table head={['Zone', 'Contents']} rows={[...ZONES.map((z) => [`${z.n}`, z.what]), ['5', 'Farm access road and courtyard — the central spine.']]} />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Zones run from the road outwards in the order 1 → 4, each ring 10–30 m wide, with the prevailing wind blowing from zone 1 towards zone 4 so odour, dust, flies and noise move away from the house. The
        layout leaves room for present operations and expansion. In many African settings livestock are traditionally kept at the centre, so the plan runs against custom.
      </p>
    </Section>
  )
}

function Checklist() {
  const st = useFarmstead()
  const score = SITE_CRITERIA.filter((c) => st.checks[c.id]).length
  return (
    <Section title="Site-selection checklist" right={<Badge tone={score === SITE_CRITERIA.length ? 'accent' : 'mute'}>{score} / {SITE_CRITERIA.length}</Badge>}>
      {SITE_CRITERIA.map((c) => (
        <Toggle key={c.id} label={`${c.id}. ${c.label}`} hint={c.hint} checked={!!st.checks[c.id]} onChange={(v) => st.set({ checks: { ...st.checks, [c.id]: v } })} />
      ))}
      <p className="mt-1 text-[11px] leading-snug text-dim">Also: a flat or gently sloping, well-drained site, never a flood plain, with space for future expansion.</p>
    </Section>
  )
}

function Work() {
  const st = useFarmstead()
  const a = useMemo(() => assess(st), [st])
  const r = a.L.r
  const steps: WorkingStep[] = [
    {
      label: 'Zone circles',
      tex: 'r_k = r_{k-1} + w_k,\\quad \\text{centre } r_k \\text{ from the road}',
      sub: `r = ${r.map((v) => n(v, 3)).join(',\\ ')}\\ \\text{m}`,
      result: `\\text{depth } 2r_4 = ${n(a.L.far, 4)}\\ \\text{m}`,
      cite: C.ln('p8 zone figure'),
    },
    {
      label: 'Farmstead share of the production area',
      tex: `\\dfrac{\\pi r_4^2}{A_{prod}} \\le ${FARMSTEAD_MAX_FRACTION * 100}\\%`,
      sub: `\\dfrac{\\pi\\times${n(r[3], 3)}^2}{${n(st.prodHa, 4)}\\times10^4}`,
      result: `= ${n(a.frac * 100, 3)}\\%`,
      cite: C.ln('p3'),
    },
    {
      label: 'Drive width',
      tex: '\\text{two-way } 16\\text{–}20\\ \\text{ft},\\quad \\text{one-way } 12\\ \\text{ft}',
      sub: `16\\times${FT} = ${n(DRIVES.twoWay.min, 3)},\\ 20\\times${FT} = ${n(DRIVES.twoWay.max, 3)},\\ 12\\times${FT} = ${n(DRIVES.oneWay, 3)}\\ \\text{m}`,
      result: `${n(st.driveW, 3)}\\ \\text{m} \\Rightarrow \\text{${driveVerdict(st.driveW)}}`,
      cite: C.ln('p21'),
    },
    {
      label: 'Turning pad and parking',
      tex: 'D = 2R,\\quad \\text{3 stalls} = 3\\times12\\ \\text{ft} \\times 60\\ \\text{ft}',
      sub: `D = 2\\times${n(st.turnR, 3)};\\ 3\\times${n(DRIVES.stall.w, 3)} \\times ${n(DRIVES.stall.l, 3)}`,
      result: `D = ${n(turningPad(st.turnR), 3)}\\ \\text{m};\\ ${n(3 * DRIVES.stall.w, 3)}\\times${n(DRIVES.stall.l, 3)}\\ \\text{m}`,
      cite: C.ln('p22'),
    },
    {
      label: 'Hazardous store separation',
      tex: `\\text{gap} \\ge ${HAZARD_SEPARATION}\\ \\text{m}`,
      sub: `\\text{nearest building } ${n(a.fuelGap, 3)}\\ \\text{m}`,
      result: a.fuelOk ? '\\text{OK}' : '\\text{too close}',
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
      <ZoneRule />
      <Checklist />
      <Work />
    </div>
  )
}
