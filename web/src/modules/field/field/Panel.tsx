import { useMemo, useState } from 'react'
import { drawbarPower, ploughDraft } from '@/physics/implements'
import { pullSpeedRun } from '@/physics/testing'
import { FARMLAND_GEARS } from '@/physics/tractor'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '@/modules/implements/_appkit/ui'
import { C, DEFAULTS, IMPLEMENTS, live, operating, surfaceOf, useField, type FieldParams, type Gear, type ImplementId } from './model'

const apply = (p: Partial<FieldParams>) => useField.getState().set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  { id: 'clay', label: 'Plough in clay (2 N/cm²)', note: 'Three 35 cm bottoms at 20 cm: 2100 cm² of furrow × 2 N/cm² = 4.2 kN of draft — a standard unit draft for clay.', apply: () => apply({ implement: 'plough', unitDraft: 2, depth: 0.2, gear: 5 }) },
  { id: 'sand', label: 'Plough in sand (1 N/cm²)', note: 'Sand has half the unit draft of clay: the same plough needs about 2.1 kN.', apply: () => apply({ implement: 'plough', unitDraft: 1, depth: 0.2, gear: 5 }) },
  { id: 'heavy', label: 'Heavy soil, 3rd gear', note: 'Field unit drafts in heavy soil are often well above these figures (5 N/cm² here is a typical heavier-soil value). The plough now needs about 10.5 kN: in 3rd gear the governed engine pulls it, with about 12 % slip.', apply: () => apply({ implement: 'plough', unitDraft: 5, depth: 0.2, gear: 3 }) },
  { id: 'lug', label: 'Wrong gear: 7th, heavy soil', note: 'The same 10.5 kN in 7th gear needs more engine torque than the engine has: it lugs down its torque curve and stalls. Pull depends on engine torque and the ratio — change down.', apply: () => apply({ implement: 'plough', unitDraft: 5, depth: 0.2, gear: 7 }) },
  { id: 'soft', label: 'Soft soil (CI 400 kPa)', note: 'A lower cone index gives a lower mobility number: more slip and rolling resistance for the same pull (Brixius equations).', apply: () => apply({ implement: 'disc', CI: 400, gear: 5 }) },
  { id: 'q1819', label: '2018/19 · Two-bottom draft question', note: 'Two 150 mm bottoms at 70 mm, 2 N/cm², 2.8 km/h: 2 × 105 cm² = 210 cm², 420 N, ≈ 327 W. See the Working.', apply: () => apply({ implement: 'plough', unitDraft: 2 }) },
]

function Dashboard() {
  const st = useField()
  const v = useLive(() => ({ ...live }), 10, (a, b) => Math.abs(a.rpm - b.rpm) < 2 && Math.abs(a.V - b.V) < 0.005 && a.working === b.working && Math.abs(a.area - b.area) < 1 && a.stalled === b.stalled)
  const spec = IMPLEMENTS[st.implement]
  const FE = v.tTotal > 0 ? v.tWork / v.tTotal : 0
  const Skmh = v.V * 3.6
  const work = operating(st, true)
  return (
    <Section title="Live dashboard">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Engine" value={Number.isFinite(v.rpm) ? fmt(v.rpm, 4) : 'stall'} unit="rpm" tone={v.stalled ? 'warn' : 'ink'} />
        <Readout label="Gear" value={st.gear} unit={`q = ${FARMLAND_GEARS[st.gear]}`} />
        <Readout label="Speed" value={fmt(Skmh, 3)} unit="km/h" tone="accent" />
        <Readout label="Slip" value={fmt(v.slip * 100, 3)} unit="%" tone={v.slip > 0.15 ? 'warn' : 'ink'} />
        <Readout label="Draft" value={fmt(v.P / 1000, 3)} unit="kN" />
        <Readout label="Drawbar power" value={fmt(v.Pd / 1000, 3)} unit="kW" tone="accent" />
        <Readout label="Engine power" value={fmt(v.Pe / 1000, 3)} unit="kW" />
        <Readout label="Tractive eff." value={fmt(v.etaT * 100, 3)} unit="%" />
        <Readout label="Fuel" value={fmt(v.fuel, 3)} unit="L/h" />
        <Readout label="Capacity Cth" value={fmt(work.Cth, 3)} unit="ha/h" />
        <Readout label="Field eff." value={fmt(FE * 100, 3)} unit="%" />
        <Readout label="Ce" value={fmt(work.Cth * FE, 3)} unit="ha/h" />
      </div>
      <Note>
        {spec.label}: {v.working ? 'in work' : 'raised (turning)'} · {fmt(v.area / 10000, 3)} ha done. {v.stalled ? 'The engine cannot hold this load in this gear — change down.' : v.spinning ? 'The tyres cannot develop this pull — wheel spin.' : ''} Turn on the viewer’s X-ray to watch the engine, gearbox and crown wheel turning with the wheels.
      </Note>
    </Section>
  )
}

function PullSpeed() {
  const CI = useField((s) => s.CI)
  const throttle = useField((s) => s.throttle)
  const data = useMemo(() => {
    const runs = ([3, 5, 7] as Gear[]).map((g) => pullSpeedRun(FARMLAND_GEARS[g], surfaceOf({ CI }), { throttle, steps: 60, maxPull: 30000 }))
    const xs: number[] = []
    for (let P = 0; P <= 30000; P += 500) xs.push(P / 1000)
    const at = (run: ReturnType<typeof pullSpeedRun>, Pk: number) => {
      const pt = run.find((p) => p.P >= Pk * 1000 - 1)
      return pt && pt.P <= Pk * 1000 + 300 ? pt.V * 3.6 : null
    }
    return [xs, ...runs.map((r) => xs.map((x) => at(r, x)))]
  }, [CI, throttle])
  return (
    <Section title="Speed against pull (with slip)">
      <Chart
        data={data}
        series={[
          { label: 'Gear 3', color: '#9bd17a', width: 2 },
          { label: 'Gear 5', color: '#6fb3e0', width: 2 },
          { label: 'Gear 7', color: '#e8794f', width: 2 },
        ]}
        xLabel="Drawbar pull (kN)"
        yLabel="km/h"
        marker={() => [live.P / 1000, live.V * 3.6]}
        height={170}
      />
      <Note>Each gear runs flat while the governor holds the engine, then falls as the engine lugs down its torque curve and slip grows (soil at the chosen cone index).</Note>
    </Section>
  )
}

function FieldWorking() {
  const st = useField()
  const w = operating(st, true)
  const d = w.pt
  const spec = w.spec
  const S = w.Skmh
  const q = ploughDraft(2, 0.15, 0.07, 2)
  const steps: WorkingStep[] = [
    st.implement === 'plough'
      ? {
          label: 'Plough draft (unit draft × furrow area)',
          tex: 'D = u\\,n\\,w\\,d',
          sub: `= ${n(st.unitDraft, 3)}\\,\\text{N/cm}^2\\times3\\times${n(35, 3)}\\times${n(st.depth * 100, 3)}\\,\\text{cm}^2`,
          result: `= ${n(w.P, 4)}\\ \\text{N}`,
          cite: C.am('§12 plough draft'),
        }
      : { label: `${spec.label} draft`, tex: 'D = k\\,W', result: `= ${n(w.P, 4)}\\ \\text{N}`, beyond: true },
    {
      label: 'Slip (travel reduction)',
      tex: 'i = 1 - \\dfrac{V}{V_0}',
      sub: `= 1 - \\dfrac{${n(d.V, 4)}}{${n(d.V0, 4)}}`,
      result: `= ${n(d.slip * 100, 3)}\\ \\%`,
      cite: C.mech('p7, eq 2.5'),
    },
    {
      label: 'Drawbar power',
      tex: 'P_d = D\\,V',
      sub: `= ${n(w.P, 4)}\\times${n(d.V, 4)}`,
      result: `= ${n((w.P * d.V) / 1000, 4)}\\ \\text{kW}`,
      cite: C.mech('eq 2.4'),
    },
    {
      label: 'Tractive efficiency',
      tex: '\\eta_t = \\dfrac{P}{P+R}(1-i)',
      sub: `= \\dfrac{${n(d.P, 4)}}{${n(d.P, 4)}+${n(d.R, 4)}}(1-${n(d.slip, 3)})`,
      result: `= ${n(d.etaT * 100, 3)}\\ \\%`,
      cite: C.mech('p8'),
    },
    {
      label: 'Theoretical field capacity',
      tex: 'C_{th} = \\dfrac{W\\,S}{10}',
      sub: `= \\dfrac{${n(spec.W, 3)}\\times${n(S, 3)}}{10}`,
      result: `= ${n(w.Cth, 4)}\\ \\text{ha/h}`,
      cite: C.mgmt('p7–8'),
    },
    {
      label: 'Check: two-bottom plough example',
      tex: 'D = 2\\times(15\\times7)\\times2,\\quad P = D\\,v',
      sub: `= ${n(q, 4)}\\,\\text{N}\\times${n(2.8 / 3.6, 4)}\\,\\text{m/s}`,
      result: `= ${n(drawbarPower(q, 2.8 / 3.6), 4)}\\ \\text{W}`,
      cite: C.guide1819('draft question'),
      errata: 'The marking guide uses one bottom (105 cm², 210 N, ≈ 163 W); the question says two bottoms, so 210 cm², 420 N and ≈ 327 W.',
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function FieldPanel() {
  const st = useField()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<FieldParams>) => {
    setPreset(null)
    st.set(p)
  }
  const spec = IMPLEMENTS[st.implement]
  return (
    <div>
      <Dashboard />
      <Section title="Tractor and implement">
        <Segmented<ImplementId>
          label="Implement"
          value={st.implement}
          options={(Object.keys(IMPLEMENTS) as ImplementId[]).map((k) => ({ value: k, label: k === 'none' ? 'None' : k === 'plough' ? 'Plough' : k === 'disc' ? 'Disc' : k === 'cultivator' ? 'Cultivator' : 'Ridger', title: IMPLEMENTS[k].label }))}
          onChange={(implement) => set({ implement, depth: IMPLEMENTS[implement].depth[1] })}
          size="sm"
        />
        <Note>{spec.note}</Note>
        <Segmented<`${Gear}`> label="Gear" value={`${st.gear}`} options={(['3', '5', '7'] as const).map((g) => ({ value: g, label: `${g} · q ${FARMLAND_GEARS[Number(g)]}` }))} onChange={(g) => set({ gear: Number(g) as Gear })} size="sm" />
        <Slider label="Hand throttle" value={st.throttle} min={0.3} max={1} step={0.01} onChange={(throttle) => set({ throttle })} />
        {st.implement !== 'none' && <Slider label="Working depth" value={st.depth} min={spec.depth[0]} max={spec.depth[2]} step={0.01} unit="m" onChange={(depth) => set({ depth })} />}
        <Slider label="Soil unit draft" value={st.unitDraft} min={0.5} max={10} step={0.5} unit="N/cm²" onChange={(unitDraft) => set({ unitDraft })} hint="Typical: sand ≈ 1, clay ≈ 2" />
        <Slider label="Cone index" value={st.CI} min={200} max={2000} step={20} unit="kPa" onChange={(CI) => set({ CI })} />
        <Toggle label="Show drivetrain internals (use with X-ray)" checked={st.internals} onChange={(internals) => set({ internals })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <PullSpeed />
      <FieldWorking />
    </div>
  )
}
