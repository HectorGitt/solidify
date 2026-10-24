import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type Preset } from '../_appkit/ui'
import { C, DEFAULTS, DIG, MACHINES, SOIL_T_M3, digger, live, siftedFraction, useRoots, type Machine, type RootParams } from './model'

const apply = (p: Partial<RootParams>) => useRoots.getState().set({ ...DEFAULTS, ...p })
const forMachine = (m: Machine): Partial<RootParams> => ({ machine: m, depth: MACHINES[m].depth[1], yield: MACHINES[m].yield })

export const PRESETS: Preset[] = [
  {
    id: 'cassava',
    label: 'Cassava digger-elevator',
    note: 'Wedge with two side discs, working to 300 mm; the bar elevator runs faster than the forward speed to strip the soil. It recovers about 85 % of the roots.',
    apply: () => apply({ ...forMachine('cassava'), depth: 0.28, ratio: 1.5 }),
  },
  {
    id: 'groundnut',
    label: 'Groundnut digger-shaker',
    note: 'A blade cuts under the pods, the rod elevator shakes off the soil and the plants are left inverted (pods up) in a windrow to dry.',
    apply: () => apply({ ...forMachine('groundnut'), ratio: 1.4 }),
  },
  {
    id: 'slow-elev',
    label: 'Elevator slower than the ground',
    note: 'Ratio below 1: the elevator cannot keep ahead of the soil arriving from the blade, so it does not strip the roots and soil goes off the end with the crop. The elevator must run faster than the forward speed.',
    apply: () => apply({ ...forMachine('cassava'), ratio: 0.8 }),
  },
  {
    id: 'shallow',
    label: 'Blade too shallow',
    note: 'Running above the roots cuts tubers and leaves many in the ground: recovery falls. The depth wheels set the depth.',
    apply: () => apply({ ...forMachine('cassava'), depth: 0.1 }),
  },
  {
    id: 'lifter',
    label: 'Manual cassava lifter',
    note: 'The tong-and-lever lifter: about 400 N of effort gives about 1500 N of lift, a mechanical advantage of 3.75.',
    apply: () => apply({ ...forMachine('cassava'), effort: 400, lift: 1500 }),
  },
]

function LivePanel() {
  const st = useRoots()
  const d = digger(st)
  const v = useLive(() => ({ l: live.lifted, d: live.dropped }), 4, (a, b) => a.l === b.l && a.d === b.d)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Ground speed" value={fmt(d.v, 3)} unit="m/s" />
        <Readout label="Elevator" value={fmt(d.ve, 3)} unit="m/s" tone={d.ratio < 1 ? 'warn' : 'ink'} />
        <Readout label="Ratio" value={fmt(d.ratio, 3)} unit="× ground" tone={d.ratio < 1 ? 'warn' : 'accent'} />
        <Readout label="Soil lifted" value={fmt(d.soil, 3)} unit="m³/h" />
        <Readout label="Soil sifted" value={`${Math.round(d.sift * 100)}`} unit="%" tone={d.sift < 0.6 ? 'warn' : 'ink'} />
        <Readout label="Capacity" value={fmt(d.cap, 3)} unit="ha/h" />
        <Readout label="Recovery" value={`${Math.round(d.rec * 100)}`} unit="%" tone={d.tooShallow ? 'warn' : 'ink'} />
        <Readout label="Recovered" value={fmt(d.recovered, 3)} unit="t/ha" tone="accent" />
        <Readout label="Plants" value={`${v.d}/${v.l}`} unit="left/lifted" />
      </div>
      <Note>
        The digger lifts all the soil over the blade width and depth: {fmt(d.soilT, 3)} t/h here (at {SOIL_T_M3} t/m³, typical value). The sifting curve is an indicative model of the rule that the elevator must outrun the ground.
      </Note>
    </Section>
  )
}

function SiftChart() {
  const ag = useRoots((s) => s.agitators)
  const data = useMemo(() => {
    const xs: number[] = []
    const a: number[] = []
    for (let r = 0.5; r <= 2.5; r += 0.05) {
      xs.push(r)
      a.push(siftedFraction(r, ag) * 100)
    }
    return [xs, a]
  }, [ag])
  return (
    <Section title="Elevator speed and soil separation">
      <Chart
        data={data}
        series={[{ label: 'Soil sifted out %', color: '#9bd17a', width: 2 }]}
        xLabel="Elevator ÷ forward speed"
        yLabel="% of soil"
        marker={() => {
          const s = useRoots.getState()
          return [s.ratio, siftedFraction(s.ratio, s.agitators) * 100]
        }}
        height={150}
      />
    </Section>
  )
}

function DiggerWorking() {
  const st = useRoots()
  const d = digger(st)
  const steps: WorkingStep[] = [
    {
      label: 'Elevator speed ratio (must exceed 1)',
      tex: 'k = \\dfrac{v_e}{v}',
      sub: `= \\dfrac{${n(d.ve, 3)}}{${n(d.v, 3)}}`,
      result: `= ${n(d.ratio, 3)}`,
      cite: C.am('§20 — bar elevator faster than forward speed'),
    },
    {
      label: 'Soil lifted by the blade',
      tex: 'Q_s = W\\,d\\,S\\times1000',
      sub: `= ${n(DIG.W, 3)}\\times${n(st.depth, 3)}\\times${n(st.speed, 3)}\\times1000`,
      result: `= ${n(d.soil, 4)}\\ \\text{m}^3/\\text{h}`,
      beyond: true,
    },
    {
      label: 'Field capacity',
      tex: 'C = \\dfrac{W\\,S}{10}',
      sub: `= \\dfrac{${n(DIG.W, 3)}\\times${n(st.speed, 3)}}{10}`,
      result: `= ${n(d.cap, 4)}\\ \\text{ha/h}`,
      cite: C.mgmt('p7–8 field capacity'),
    },
    {
      label: 'Roots recovered',
      tex: 'Y_r = Y\\,\\eta_r',
      sub: `= ${n(st.yield, 3)}\\times${n(d.rec, 3)}`,
      result: `= ${n(d.recovered, 4)}\\ \\text{t/ha}`,
      cite: C.am('§20 — digger-elevator recovers about 85 %'),
    },
    {
      label: 'Manual cassava lifter',
      tex: 'MA = \\dfrac{F_{lift}}{F_{effort}}',
      sub: `= \\dfrac{${n(st.lift, 4)}}{${n(st.effort, 4)}}`,
      result: `= ${n(d.lever, 3)}`,
      cite: C.am('§20 — about 400 N gives about 1500 N'),
    },
  ]
  return (
    <Section title="Working">
      <div className="grid grid-cols-2 gap-x-3">
        <Slider label="Lifter effort" value={st.effort} min={100} max={800} step={10} unit="N" onChange={(effort) => st.set({ effort })} />
        <Slider label="Lift force" value={st.lift} min={500} max={3000} step={50} unit="N" onChange={(lift) => st.set({ lift })} />
      </div>
      <Working steps={steps} />
    </Section>
  )
}

export function RootCropsPanel() {
  const st = useRoots()
  const [preset, setPreset] = useState<string | null>(null)
  const set = (p: Partial<RootParams>) => {
    setPreset(null)
    st.set(p)
  }
  const M = MACHINES[st.machine]
  return (
    <div>
      <Section title="Machine">
        <Segmented
          value={st.machine}
          options={[
            { value: 'cassava', label: 'Cassava digger-elevator' },
            { value: 'groundnut', label: 'Groundnut digger-shaker' },
          ]}
          onChange={(m) => set(forMachine(m))}
        />
      </Section>
      <LivePanel />
      <Section title="Controls">
        <Slider label="Forward speed" value={st.speed} min={1} max={7} step={0.25} unit="km/h" onChange={(speed) => set({ speed })} />
        <Slider label="Working depth" value={st.depth} min={M.depth[0]} max={M.depth[2]} step={0.01} unit="m" onChange={(depth) => set({ depth })} hint="Set by the depth wheels" />
        <Slider label="Elevator ÷ forward speed" value={st.ratio} min={0.5} max={2.5} step={0.05} onChange={(ratio) => set({ ratio })} hint="Changed by swapping the elevator sprocket" />
        <Toggle label="Agitators fitted" checked={st.agitators} onChange={(agitators) => set({ agitators })} />
        <Slider label="Crop yield" value={st.yield} min={0.5} max={40} step={0.5} unit="t/ha" onChange={(y) => set({ yield: y })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <SiftChart />
      <DiggerWorking />
    </div>
  )
}
