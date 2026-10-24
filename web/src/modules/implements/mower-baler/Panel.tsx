import { useMemo, useState } from 'react'
import { baleVolume, knifeDisplacement, knifeVelocity } from '@/physics/hay'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../_appkit/ui'
import { C, DEFAULTS, MOWER, PITMAN, baler, drying, live, mower, useHay, type HayParams } from './model'

const apply = (p: Partial<HayParams>) => useHay.getState().set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'lead',
    label: 'Lead on a 5 ft bar',
    note: 'The outer end of the bar is set ahead by about 6 mm per metre: 1.524 m × 6 mm/m ≈ 9.1 mm. Under load the drag of the crop swings the bar back to square. Shown true size here.',
    apply: () => apply({ mode: 'mower', leadPerM: 6, exaggerate: false }),
  },
  {
    id: 'register',
    label: 'Out of register',
    note: 'Registration: at each end of its stroke every knife section should be centred on a guard. Here the knife is 20 mm off, so the sections stop short and leave stems uncut between guards.',
    apply: () => apply({ mode: 'mower', regOffset: 20 }),
  },
  {
    id: 'fast',
    label: 'Driving too fast',
    note: 'At 14 km/h the bar moves forward about 127 mm per knife stroke — more than a section is long — so some stems are pushed over instead of cut. Slow down or speed up the knife.',
    apply: () => apply({ mode: 'mower', speed: 14 }),
  },
  {
    id: 'dry',
    label: 'Hay drying',
    note: '1000 kg of grass cut at 80 % moisture holds 200 kg of dry matter; at 20 % storage moisture that is 250 kg of hay, so 750 kg of water must dry off.',
    apply: () => apply({ mode: 'mower', fresh: 1000 }),
  },
  {
    id: 'bale',
    label: 'Standard bale',
    note: 'Bale about 35 × 45 × 90 cm = 0.142 m³. At 160 kg/m³ it weighs about 23 kg.',
    apply: () => apply({ mode: 'baler', baleL: 0.9, density: 160 }),
  },
  {
    id: 'heavy',
    label: 'Heavy windrow',
    note: 'A heavier windrow at the same speed feeds more crop per ram stroke: thicker slices, fewer strokes per bale, more bales per hour.',
    apply: () => apply({ mode: 'baler', windrow: 6, speed: 6 }),
  },
]

function LiveMower() {
  const st = useHay()
  const m = mower(st)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank" value={fmt(m.N, 3)} unit="rpm" />
        <Readout label="Stroke" value={fmt(m.S * 1000, 3)} unit="mm" />
        <Readout label="Mean knife" value={fmt(m.vk, 3)} unit="m/s" tone="accent" />
        <Readout label="Advance/stroke" value={fmt(m.adv * 1000, 3)} unit="mm" tone={m.adv > 0.1 ? 'warn' : 'ink'} />
        <Readout label="Lead" value={fmt(m.lead * 1000, 3)} unit="mm" />
        <Readout label="Capacity" value={fmt(m.cap, 3)} unit="ha/h" />
      </div>
      <Note>
        Knife/forward speed ratio {fmt(m.ratio, 3)}. Register error at the ends of the stroke: {fmt(m.reg.inner * 1000, 3)} / {fmt(m.reg.outer * 1000, 3)} mm.
        {st.exaggerate ? ' The lead is drawn ×20 so you can see it.' : ''}
      </Note>
    </Section>
  )
}

function LiveBaler() {
  const st = useHay()
  const b = baler(st)
  const v = useLive(() => ({ f: live.forming, n: live.bales }), 8, (a, c) => Math.abs(a.f - c.f) < 0.01 && a.n === c.n)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Feed" value={fmt(b.feed, 3)} unit="kg/s" />
        <Readout label="Slice / stroke" value={fmt(b.slice * 1000, 3)} unit="mm" />
        <Readout label="Strokes / bale" value={fmt(b.strokes, 3)} />
        <Readout label="Bale mass" value={fmt(b.mass, 3)} unit="kg" />
        <Readout label="Bales" value={fmt(b.perHour, 3)} unit="per h" tone="accent" />
        <Readout label="Forming" value={`${Math.round((v.f / st.baleL) * 100)}`} unit={`% · ${v.n} made`} />
      </div>
      <Note>Pick-up tine speed {fmt(b.pick.tip, 3)} m/s, {fmt(b.pick.ratio, 3)} × forward speed (it must exceed 1 to lift the windrow cleanly).</Note>
    </Section>
  )
}

function KnifeChart() {
  const data = useMemo(() => {
    const xs: number[] = []
    const d: number[] = []
    const v: number[] = []
    const w = (2 * Math.PI * 918) / 60
    for (let a = 0; a <= 360; a += 3) {
      const th = (a * Math.PI) / 180
      xs.push(a)
      d.push(knifeDisplacement(PITMAN, th) * 1000)
      v.push(knifeVelocity(PITMAN, th, w) * 10)
    }
    return [xs, d, v]
  }, [])
  return (
    <Section title="Crank and pitman: knife motion">
      <Chart
        data={data}
        series={[
          { label: 'Displacement (mm)', color: '#9bd17a', width: 2 },
          { label: 'Velocity ×10 (m/s)', color: '#e8794f', width: 1.5 },
        ]}
        xLabel="Crank angle (°)"
        yLabel="mm  /  m/s ×10"
        height={160}
      />
      <Note>Rotation in, reciprocation out. The knife stops at each end of the stroke and is fastest mid-stroke; at 918 rpm the peak is about ωr = 3.7 m/s.</Note>
    </Section>
  )
}

function MowerWorking() {
  const st = useHay()
  const m = mower(st)
  const d = drying(st)
  const steps: WorkingStep[] = [
    {
      label: 'Alignment lead (outer end ahead)',
      tex: '\\ell = L\\times 6\\ \\text{mm/m}',
      sub: `= ${n(MOWER.L, 4)}\\,\\text{m}\\times${n(st.leadPerM, 3)}\\,\\text{mm/m}`,
      result: `= ${n(m.lead * 1000, 3)}\\ \\text{mm}`,
      cite: C.am('§16.2.2 alignment'),
    },
    {
      label: 'Crank speed through the gears',
      tex: 'N = N_{pto}\\,\\dfrac{z_1}{z_2}',
      sub: `= ${n(st.pto, 4)}\\times\\dfrac{${MOWER.gearIn}}{${MOWER.gearOut}}`,
      result: `= ${n(m.N, 4)}\\ \\text{rpm}`,
      cite: C.am('§16.2.1 — PTO drives the crank through gears'),
      beyond: true,
    },
    {
      label: 'Mean knife speed (two strokes per turn)',
      tex: '\\bar v_k = \\dfrac{2SN}{60}',
      sub: `= \\dfrac{2\\times${n(m.S, 4)}\\times${n(m.N, 4)}}{60}`,
      result: `= ${n(m.vk, 4)}\\ \\text{m/s}`,
      beyond: true,
    },
    {
      label: 'Forward travel per knife stroke',
      tex: 'a = \\dfrac{60\\,v}{2N}',
      sub: `= \\dfrac{60\\times${n(m.v, 4)}}{2\\times${n(m.N, 4)}}`,
      result: `= ${n(m.adv * 1000, 4)}\\ \\text{mm}`,
      beyond: true,
    },
    {
      label: 'Field capacity (FE = 1)',
      tex: 'C = \\dfrac{W\\,S}{10}',
      sub: `= \\dfrac{${n(MOWER.L, 4)}\\times${n(st.speed, 3)}}{10}`,
      result: `= ${n(m.cap, 4)}\\ \\text{ha/h}`,
      cite: C.mgmt('p7–8 field capacity'),
    },
    {
      label: 'Hay made from fresh grass (80 % → 20 % moisture)',
      tex: 'M_h = \\dfrac{M_f(1-0.8)}{1-0.2}',
      sub: `= \\dfrac{${n(st.fresh, 4)}\\times0.2}{0.8}`,
      result: `= ${n(d.hay, 4)}\\ \\text{kg}\\quad(\\text{water off } ${n(d.water, 4)}\\ \\text{kg})`,
      cite: C.am('§16.2.2 — about 80 % at cutting, 20 % for storage'),
    },
  ]
  return (
    <Section title="Working — mower">
      <Slider label="Fresh grass" value={st.fresh} min={100} max={5000} step={50} unit="kg" onChange={(fresh) => st.set({ fresh })} />
      <Working steps={steps} />
    </Section>
  )
}

function BalerWorking() {
  const st = useHay()
  const b = baler(st)
  const steps: WorkingStep[] = [
    {
      label: 'Bale volume (about 35 × 45 × 90 cm)',
      tex: 'V = w\\,h\\,L',
      sub: `= ${n(b.bale.w, 3)}\\times${n(b.bale.h, 3)}\\times${n(b.bale.L, 3)}`,
      result: `= ${n(baleVolume(b.bale), 4)}\\ \\text{m}^3`,
      cite: C.am('§16.2.3'),
    },
    {
      label: 'Bale mass',
      tex: 'm = \\rho V',
      sub: `= ${n(st.density, 4)}\\times${n(baleVolume(b.bale), 4)}`,
      result: `= ${n(b.mass, 4)}\\ \\text{kg}`,
      beyond: true,
    },
    {
      label: 'Crop fed by the pick-up',
      tex: '\\dot m = m_w\\,v',
      sub: `= ${n(st.windrow, 3)}\\,\\text{kg/m}\\times${n(b.v, 4)}\\,\\text{m/s}`,
      result: `= ${n(b.feed, 4)}\\ \\text{kg/s}`,
      beyond: true,
    },
    {
      label: 'Slice added per ram stroke',
      tex: 't = \\dfrac{\\dot m}{(n/60)\\,\\rho\\,w\\,h}',
      sub: `= \\dfrac{${n(b.feed, 4)}}{(${n(st.ramSpm, 3)}/60)\\times${n(st.density, 4)}\\times${n(b.bale.w, 3)}\\times${n(b.bale.h, 3)}}`,
      result: `= ${n(b.slice * 1000, 4)}\\ \\text{mm}`,
      beyond: true,
    },
    {
      label: 'Strokes per bale (knotter trips)',
      tex: 'k = L/t',
      sub: `= ${n(b.bale.L, 3)}/${n(b.slice, 4)}`,
      result: `= ${n(b.strokes, 4)}`,
      beyond: true,
    },
    {
      label: 'Output',
      tex: 'B = \\dfrac{3600\\,\\dot m}{m}',
      sub: `= \\dfrac{3600\\times${n(b.feed, 4)}}{${n(b.mass, 4)}}`,
      result: `= ${n(b.perHour, 4)}\\ \\text{bales/h}`,
      beyond: true,
    },
  ]
  return (
    <Section title="Working — baler">
      <Working steps={steps} />
    </Section>
  )
}

export function MowerBalerPanel() {
  const st = useHay()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<HayParams>) => {
    setPreset(null)
    st.set(p)
  }
  const isM = st.mode === 'mower'
  return (
    <div>
      <Section title="Machine">
        <Segmented
          value={st.mode}
          options={[
            { value: 'mower', label: 'Cutter-bar mower' },
            { value: 'baler', label: 'Pick-up baler' },
          ]}
          onChange={(mode) => set({ mode })}
        />
      </Section>
      {isM ? <LiveMower /> : <LiveBaler />}
      <Section title="Controls">
        <Slider label="Forward speed" value={st.speed} min={2} max={16} step={0.5} unit="km/h" onChange={(speed) => set({ speed })} />
        <Slider label="PTO speed" value={st.pto} min={400} max={600} step={10} unit="rpm" onChange={(pto) => set({ pto })} />
        {isM ? (
          <>
            <Slider label="Lead" value={st.leadPerM} min={0} max={12} step={0.5} unit="mm/m" onChange={(leadPerM) => set({ leadPerM })} />
            <Toggle label="Exaggerate lead ×20" checked={st.exaggerate} onChange={(exaggerate) => set({ exaggerate })} />
            <Slider label="Registration error" value={st.regOffset} min={-38} max={38} step={1} unit="mm" onChange={(regOffset) => set({ regOffset })} hint="Knife sections off-centre on the guards at the stroke ends" />
          </>
        ) : (
          <>
            <Slider label="Windrow" value={st.windrow} min={1} max={8} step={0.25} unit="kg/m" onChange={(windrow) => set({ windrow })} />
            <Slider label="Ram speed" value={st.ramSpm} min={50} max={100} step={1} unit="strokes/min" onChange={(ramSpm) => set({ ramSpm })} />
            <Slider label="Bale density" value={st.density} min={100} max={250} step={5} unit="kg/m³" onChange={(density) => set({ density })} />
            <Slider label="Bale length" value={st.baleL} min={0.6} max={1.2} step={0.05} unit="m" onChange={(baleL) => set({ baleL })} />
          </>
        )}
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      {isM ? <KnifeChart /> : null}
      {isM ? <MowerWorking /> : <BalerWorking />}
    </div>
  )
}
