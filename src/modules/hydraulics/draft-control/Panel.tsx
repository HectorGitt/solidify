import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { SENSE_TAU, draftGain, seriesStats, type ControlMode } from '@/physics/linkageControl'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { PLOUGH_WIDTH } from '../three-point/plough'
import { C, PLANT, SPRING_K, live, settings, traces, useDraft, type DraftParams } from './model'

function LivePanel() {
  const mode = useDraft((s) => s.mode)
  const v = useLive(() => ({ ...live, other: { ...live.other } }), 12, (a, b) => a.x === b.x)
  const valve = v.rate > 0.002 ? 'Lift (oil to ram)' : v.rate < -0.002 ? 'Lower (ram to tank)' : 'Neutral'
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Field position" value={fmt(v.x, 3)} unit="m" />
        <Readout label="Soil resistance k" value={fmt(v.k / 1000, 3)} unit="kN/m²" tone={v.k > useDraft.getState().k0 * 1150 ? 'warn' : 'ink'} />
        <Readout label="Valve" value={valve} tone={v.rate > 0.002 ? 'warn' : v.rate < -0.002 ? 'info' : 'ink'} />
        <Readout label="Draft" value={fmt(v.draft / 1000, 3)} unit="kN" tone="accent" />
        <Readout label="Depth" value={fmt(v.depth * 1000, 3)} unit="mm" tone="accent" />
        <Readout label="Top link" value={`${fmt(Math.abs(v.comp) / 1000, 2)} ${v.comp >= 0 ? 'C' : 'T'}`} unit="kN" />
        <Readout label={`Draft (${mode === 'draft' ? 'position' : 'draft'} ctrl)`} value={fmt(v.other.draft / 1000, 3)} unit="kN" />
        <Readout label={`Depth (${mode === 'draft' ? 'position' : 'draft'} ctrl)`} value={fmt(v.other.depth * 1000, 3)} unit="mm" />
        <Readout label="Hitch height" value={fmt(v.h * 1000, 3)} unit="mm" />
      </div>
    </Section>
  )
}

const PRESETS: { id: string; label: string; note: string; p: Partial<DraftParams> }[] = [
  { id: 'notes', label: 'Draft control', note: 'Top-link sensing holds the draft near the setting: in hard soil the plough is lifted, in soft soil it is lowered — the depth varies instead.', p: { mode: 'draft', response: 0.45, variability: 0.6 } },
  { id: 'position', label: 'Position control', note: 'The valve follows the lift-arm position only (for sprayers and other above-ground implements). Depth stays constant on level ground; the draft follows the soil strength.', p: { mode: 'position', response: 0.45, variability: 0.6 } },
  { id: 'fast', label: 'Response: fast', note: 'High valve gain with the sensing lag: dropping into work and leaving the compacted strip at 35–39 m, the draft overshoots the setting and the hitch can hunt — turn the knob toward slow to damp it.', p: { mode: 'draft', response: 1 } },
  { id: 'slow', label: 'Response: slow', note: 'Heavily damped: the draft wanders further from the setting before the hitch catches up.', p: { mode: 'draft', response: 0 } },
]

function useCharts() {
  const st = useDraft()
  return useMemo(() => {
    const T = traces(st)
    const s = settings(st)
    const x = T.draft.x
    return {
      T,
      s,
      draft: [x, T.draft.draft.map((d) => d / 1000), T.position.draft.map((d) => d / 1000), x.map(() => s.setD / 1000)],
      depth: [x, T.draft.depth.map((d) => d * 1000), T.position.depth.map((d) => d * 1000), T.draft.k.map((k) => k / 1000)],
      sd: { draft: seriesStats(x, T.draft.draft, 4), pos: seriesStats(x, T.position.draft, 4) },
      sdep: { draft: seriesStats(x, T.draft.depth, 4), pos: seriesStats(x, T.position.depth, 4) },
    }
  }, [st])
}

function Charts() {
  const c = useCharts()
  return (
    <>
      <Section title="Draft along the field">
        <Chart
          data={c.draft}
          series={[
            { label: 'Draft control', color: '#e8794f', width: 2 },
            { label: 'Position control', color: '#6fb3e0', width: 1.5 },
            { label: 'Setting', color: '#f5b942', width: 1, dash: [5, 4] },
          ]}
          xLabel="Distance (m)"
          yLabel="Draft (kN)"
          marker={() => [live.x, live.draft / 1000]}
          height={160}
        />
      </Section>
      <Section title="Depth along the field">
        <Chart
          data={c.depth}
          series={[
            { label: 'Draft control', color: '#e8794f', width: 2 },
            { label: 'Position control', color: '#6fb3e0', width: 1.5 },
            { label: 'Soil k (kN/m²)', color: '#9bd17a', width: 1, dash: [3, 3] },
          ]}
          xLabel="Distance (m)"
          yLabel="Depth (mm) · k"
          marker={() => [live.x, live.depth * 1000]}
          height={160}
        />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Readout label="Draft range: draft / position" value={`${fmt(c.sd.draft.range / 1000, 2)} / ${fmt(c.sd.pos.range / 1000, 2)}`} unit="kN" />
          <Readout label="Depth range: draft / position" value={`${fmt(c.sdep.draft.range * 1000, 3)} / ${fmt(c.sdep.pos.range * 1000, 3)}`} unit="mm" />
        </div>
      </Section>
    </>
  )
}

function DraftWorking() {
  const st = useDraft()
  const s = settings(st)
  const D = s.setD
  const Cset = s.setC
  const h = 0.002
  const G = Math.abs((PLANT.compression(s.setH - h, st.k0 * 1000 * PLOUGH_WIDTH * PLANT.depth(s.setH - h)) - PLANT.compression(s.setH + h, st.k0 * 1000 * PLOUGH_WIDTH * PLANT.depth(s.setH + h))) / (2 * h))
  const Kv = draftGain(st.response)
  const zeta = 1 / (2 * Math.sqrt(SENSE_TAU * Kv * G))
  const T = traces(st)
  const r = { d: seriesStats(T.draft.x, T.draft.draft, 4), p: seriesStats(T.position.x, T.position.draft, 4) }
  const steps: WorkingStep[] = [
    {
      label: 'Draft of the plough at the set depth (mean soil)',
      tex: 'D = k\\,w\\,d',
      sub: `= ${n(st.k0, 3)}\\,\\text{kN/m}^2\\times${n(PLOUGH_WIDTH, 3)}\\,\\text{m}\\times${n(st.depth, 3)}\\,\\text{m}`,
      result: `D = ${n(D / 1000, 3)}\\ \\text{kN}`,
      cite: SRC.beyond('specific draft'),
      beyond: true,
    },
    {
      label: 'Top-link force from moments about the lower hitch point',
      tex: 'C\\,r_{top} = -\\textstyle\\sum M_L(S,\\,W_{plough})',
      sub: '\\text{top link = two-force member; soil force below the hitch → compression}',
      result: `C = ${n(Cset / 1000, 3)}\\ \\text{kN}\\ (${Cset >= 0 ? '\\text{compression}' : '\\text{tension}'})`,
      cite: C.draft[0],
    },
    {
      label: 'Sensing spring deflection (the valve signal)',
      tex: 'x_s = C / k_s',
      sub: `= ${n(Cset, 4)} / ${n(SPRING_K / 1000, 3)}\\times10^3`,
      result: `x_s = ${n((Cset / SPRING_K) * 1000, 3)}\\ \\text{mm (heavy spring)}`,
      cite: C.draft[0],
    },
    {
      label: 'Valve law and loop damping (response knob)',
      tex: '\\dot h = K_v\\,(C_s - C_{set}),\\quad \\zeta = \\dfrac{1}{2\\sqrt{\\tau K_v G}},\\ G = \\left|\\dfrac{dC}{dh}\\right|',
      sub: `K_v = ${n(Kv * 1e6, 3)}\\,\\mu\\text{m/s per N},\\ \\tau = ${n(SENSE_TAU, 2)}\\,\\text{s},\\ G = ${n(G / 1000, 3)}\\,\\text{kN/m}`,
      result: `\\zeta \\approx ${n(zeta, 3)}\\ ${zeta < 0.5 ? '\\text{(hunts)}' : zeta > 1 ? '\\text{(sluggish)}' : ''}`,
      cite: SRC.beyond('linear control loop'),
      beyond: true,
    },
    {
      label: 'Result over the field (after the first 4 m)',
      tex: '\\Delta D_{draft\\ ctrl}\\ \\text{vs}\\ \\Delta D_{position\\ ctrl}',
      sub: `\\text{ranges } ${n(r.d.range / 1000, 3)}\\ \\text{vs}\\ ${n(r.p.range / 1000, 3)}\\ \\text{kN}`,
      result: `\\text{draft control cuts the draft swing to } ${n((100 * r.d.range) / Math.max(1, r.p.range), 3)}\\,\\%`,
      cite: C.draft[0],
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function DraftPanel() {
  const st = useDraft()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<DraftParams>) => {
    setPreset(null)
    st.set(p)
  }
  return (
    <div>
      <LivePanel />
      <Section title="Control">
        <Segmented<ControlMode>
          value={st.mode}
          onChange={(mode) => st.set({ mode })}
          options={[
            { value: 'draft', label: 'Draft control', title: 'Top-link sensing keeps the draft constant' },
            { value: 'position', label: 'Position control', title: 'Keeps the hitch (depth) where the lever is set' },
          ]}
        />
        <Slider label="Lever setting (working depth in mean soil)" value={st.depth} min={0.08} max={0.26} step={0.005} unit="m" digits={3} onChange={(depth) => set({ depth })} />
        <Slider label="Response / damping knob" value={st.response} min={0} max={1} step={0.05} onChange={(response) => set({ response })} hint="0 = slow (damped) … 1 = fast" />
        <Toggle label="Show oil flow" checked={st.flows} onChange={(flows) => st.set({ flows })} />
      </Section>
      <Section title="Field">
        <Slider label="Mean soil resistance" value={st.k0} min={25} max={90} step={1} unit="kN/m²" onChange={(k0) => set({ k0 })} />
        <Slider label="Soil variability" value={st.variability} min={0} max={1} step={0.05} onChange={(variability) => set({ variability })} hint="Hard pan at 27 m, soft patch at 45 m" />
        <Slider label="Forward speed" value={st.speed} min={2} max={10} step={0.1} unit="km/h" onChange={(speed) => set({ speed })} />
      </Section>
      <Section title="Presets">
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
      </Section>
      <Charts />
      <DraftWorking />
      <Section title="Other sensing and controls">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-mute">
          <li><b>Double-acting top link</b> senses tension too (shallow ploughing, front wheels dropping into a furrow); tension sensing cuts out when the implement is fully raised.</li>
          <li><b>Lower-link sensing</b>: the draft is felt as tension in the lower arms.</li>
          <li><b>Torque sensing</b>: a special coupling in the drive to the differential works the valve; suits semi-mounted ploughs, and can also work the plough’s rear lift ram.</li>
          <li><b>Position control</b>: sets the height of above-ground implements such as sprayers; top-link force has no effect.</li>
          <li><b>Pressure control</b>: transfers some weight of a trailed implement to the rear wheels through a support chain to the lift arms.</li>
          <li><b>Flow control valve</b> sets the lift and drop speed; a <b>mechanical lock</b> holds the arms up for transport.</li>
        </ul>
      </Section>
    </div>
  )
}
