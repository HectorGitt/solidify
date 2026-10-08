import { useMemo, useState } from 'react'
import { biteLength } from '@/physics/tillage'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type PresetDef } from '../_tillage/ui'
import { C, DEFAULTS, ROTOR_R, TOOLS, cultOf, useCult, type Tool } from './model'

const pick = (tool: Tool, extra: object = {}) => () => useCult.getState().set({ tool, depth: TOOLS[tool].depth[2], ...extra })

const PRESETS: PresetDef[] = [
  { id: 'rot', label: 'Rotavator: 1 m/s, 200 rpm', note: 'Three blades per flange side: bite = v/(nZ) = 1 × 60/(200 × 3) = 0.10 m. Slower travel or faster rotor gives a finer tilth.', apply: pick('rotavator', { speed: 3.6, rotorRpm: 200, blades: 3 }) },
  { id: 'rotfast', label: 'Rotavator: 2 m/s', note: 'Doubling the forward speed doubles the bite to 0.20 m — coarser tilth.', apply: pick('rotavator', { speed: 7.2, rotorRpm: 200, blades: 3 }) },
  { id: 'ridge', label: 'Ridger, 0.75 m ridges', note: 'Conventional sequence: plough → harrow → ridge. Ridges at 0.75 m for maize, yam or cassava.', apply: pick('ridger', { ridgeSpacing: 0.75 }) },
  { id: 'chisel', label: 'Chisel plough (conservation)', note: 'Loosens without turning the soil; residue stays on the surface (mulch-till disturbs more than 25 % of the row width).', apply: pick('chisel') },
]

const TILLAGE: [string, string][] = [
  ['Conventional', 'Plough → harrow → ridge; the soil is turned and the surface left bare.'],
  ['Primary', 'After harvest when the soil is moist enough: depth, cutting and burying weeds, exposing roots, aeration and water retention.'],
  ['Secondary', 'Everything after primary tillage: harrows, cultivators, rotavator, ridger.'],
  ['Conservation / minimum', 'Does not turn the soil over.'],
  ['No-till', 'Soil left undisturbed except for nutrient injection; seed placed in a slot cut by coulters or openers; weeds controlled by herbicide.'],
  ['Ridge-till', 'Planted on ridges; residue left between the ridges; ridges rebuilt during cultivation.'],
  ['Mulch-till', 'Chisels, field cultivators, discs, sweeps or blades; more than 25 % of the row width disturbed (includes zone- and strip-till).'],
  ['Reduced-till', 'Less erosion, lower cost, saves energy.'],
]

export function Panel() {
  const st = useCult()
  const [active, setActive] = useState<string | null>(null)
  const r = cultOf(st)
  const [d0, d1] = TOOLS[st.tool].depth
  const rot = st.tool === 'rotavator'
  const chart = useMemo(() => {
    const xs: number[] = []
    const ys = [150, 200, 300].map(() => [] as number[])
    for (let v = 0.3; v <= 3.01; v += 0.1) {
      xs.push(v)
      ;[150, 200, 300].forEach((rpm, i) => ys[i].push(biteLength(v, rpm, st.blades) * 1000))
    }
    return [xs, ...ys]
  }, [st.blades])
  const steps: WorkingStep[] = [
    { label: 'Field capacity', tex: 'C = W S\\,FE/10', sub: `C = ${n(r.W)} \\times ${n(st.speed)} \\times ${n(st.FE)}/10`, result: `= ${n(r.C)}\\,\\text{ha/h}`, cite: C.mgmt('p8 field capacity') },
    ...(rot
      ? [
          { label: 'Bite length', tex: 'l = \\dfrac{60\\,v}{n Z}', sub: `l = \\dfrac{60 \\times ${n(r.v)}}{${st.rotorRpm} \\times ${st.blades}}`, result: `= ${n(r.bite * 1000)}\\,\\text{mm}`, beyond: true },
          { label: 'Tip speed ratio', tex: '\\lambda = \\dfrac{\\omega R}{v}', sub: `\\lambda = \\dfrac{${n((st.rotorRpm * 2 * Math.PI) / 60)} \\times ${ROTOR_R}}{${n(r.v)}}`, result: `= ${n(r.lambda)}\\ (>1 \\text{ to cut})`, beyond: true },
        ]
      : []),
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Working width" value={fmt(r.W, 3)} unit="m" />
          <Readout label="Depth" value={fmt(st.depth * 1000, 3)} unit="mm" />
          <Readout label="Capacity" value={fmt(r.C, 3)} unit="ha/h" tone="info" />
          {rot ? (
            <>
              <Readout label="Bite length" value={fmt(r.bite * 1000, 3)} unit="mm" tone="accent" />
              <Readout label="λ = ωR/v" value={fmt(r.lambda, 3)} />
              <Readout label="Ridge left" value={fmt(r.ridge * 1000, 3)} unit="mm" />
            </>
          ) : null}
        </div>
      </Section>
      <Section title="Tool">
        <select className="mb-2.5 w-full rounded-md border border-line-2 bg-panel-2 px-2 py-1 text-[12.5px] text-ink" value={st.tool} onChange={(e) => pick(e.target.value as Tool)()}>
          {(Object.keys(TOOLS) as Tool[]).map((t) => (
            <option key={t} value={t}>
              {TOOLS[t].label}
            </option>
          ))}
        </select>
        <Slider label="Depth" value={st.depth * 1000} min={d0 * 1000} max={d1 * 1000} step={5} unit="mm" onChange={(d) => st.set({ depth: d / 1000 })} />
        <Slider label="Speed" value={st.speed} min={1} max={12} step={0.1} unit="km/h" onChange={(speed) => st.set({ speed })} />
        {rot ? (
          <>
            <Slider label="Rotor speed n" value={st.rotorRpm} min={100} max={350} step={5} unit="rpm" onChange={(rotorRpm) => st.set({ rotorRpm })} />
            <Segmented value={String(st.blades)} onChange={(b) => st.set({ blades: Number(b) })} label="Blades per flange side Z" options={['2', '3', '4'].map((v) => ({ value: v, label: v }))} size="sm" />
          </>
        ) : null}
        {st.tool === 'ridger' ? <Slider label="Ridge spacing" value={st.ridgeSpacing} min={0.6} max={1.0} step={0.05} unit="m" onChange={(ridgeSpacing) => st.set({ ridgeSpacing })} /> : null}
        <Slider label="Field efficiency" value={st.FE * 100} min={50} max={100} step={1} unit="%" onChange={(v) => st.set({ FE: v / 100 })} />
        <Toggle label="Stop the tractor mid-field (close-up)" checked={st.hold} onChange={(hold) => st.set({ hold })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
        <button className="mt-2 text-[11.5px] text-mute underline" onClick={() => (st.set({ ...DEFAULTS }), setActive(null))}>
          reset
        </button>
      </Section>
      {rot ? (
        <Section title="Rotavator bite length vs forward speed">
          <Chart
            data={chart}
            series={[
              { label: '150 rpm', color: '#7ab8f5' },
              { label: '200 rpm', color: '#9bd17a' },
              { label: '300 rpm', color: '#f08a3c' },
            ]}
            xLabel="forward speed v (m/s)"
            yLabel="bite length (mm)"
            marker={() => {
              const s = useCult.getState()
              return [s.speed / 3.6, cultOf(s).bite * 1000]
            }}
          />
        </Section>
      ) : null}
      <Section title="Working">
        <Working steps={steps} />
      </Section>
      <Section title="Tillage systems">
        <dl className="space-y-1 text-[11.5px] leading-snug">
          {TILLAGE.map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-medium text-ink">{k}: </dt>
              <dd className="inline text-mute">{v}</dd>
            </div>
          ))}
        </dl>
        <Note>The construction of the harrows, rotary cultivator and ridger shown here is typical.</Note>
      </Section>
    </>
  )
}
