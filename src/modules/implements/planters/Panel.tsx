import { useState } from 'react'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, type PresetDef } from '../_tillage/ui'
import { C, DEFAULTS, live, plantOf, usePlant, type Kind } from './model'

const PRESETS: PresetDef[] = [
  { id: 'notes', label: 'Calibration: 5 × 150 mm drill', note: '80 kg/ha, D = 1 m: W = 0.75 m, L = 10000 × 0.1/0.75 = 1333 m, N = 1333/π = 424.4 ≈ 425 rev per 0.1 ha; collect 8 kg, i.e. 1.6 kg per tube.', apply: () => usePlant.getState().set({ kind: 'drill', rows: 5, spacing: 0.15, rate: 80, D: 1, area: 0.1 }) },
  { id: 'fert', label: 'Seed-cum-fertilizer drill', note: 'Split box: seed and fertilizer metered separately; fertilizer placed 2–3 cm from the seed.', apply: () => usePlant.getState().set({ kind: 'fert' }) },
  { id: 'maize', label: 'Maize planter 0.75 m', note: 'Four rows at 0.75 m, 16-cell plate turning once per 0.5 m wheel revolution: spacing πD/16 = 98 mm (change the cells for wider spacing).', apply: () => usePlant.getState().set({ kind: 'planter', pRows: 4, pSpacing: 0.75, cells: 16, ratio: 1, pD: 0.5 }) },
  { id: 'jab', label: 'Jab planter', note: 'Hand tool: jaws closed by gravity, opened by ground pressure to drop the seed.', apply: () => usePlant.getState().set({ kind: 'jab' }) },
]

const COMPARE: [string, string, string][] = [
  ['Metering', 'Continuous flow (fluted roller, feed cup)', 'Single seeds (cell / pocket plate)'],
  ['Rows', 'Narrow rows, e.g. 150–200 mm', 'Wide rows, e.g. 0.75 m'],
  ['Placement', 'Seeds dribbled along the row; rate set in kg/ha', 'Seeds at a set spacing (hills); rate set by plate cells and ratio'],
  ['Crops', 'Small grains: wheat, rice, millet', 'Row crops: maize, cowpea, cotton, groundnut'],
  ['Size', 'Openers × spacing (e.g. 5 × 150 mm)', 'Number of rows × row width'],
]

export function Panel() {
  const st = usePlant()
  const [active, setActive] = useState<string | null>(null)
  const r = plantOf(st)
  const v = useLive(() => ({ revs: live.revs, dist: live.dist }), 8, (a, b) => a.revs === b.revs)
  const drill = st.kind === 'drill' || st.kind === 'fert'
  const steps: WorkingStep[] = [
    { label: 'Drill width', tex: 'W = n \\times s', sub: `W = ${st.rows} \\times ${n(st.spacing)}`, result: `= ${n(r.cal.W)}\\,\\text{m}`, cite: C.am('§13.4 drill size') },
    { label: 'Distance for the test area', tex: 'L = \\dfrac{10000\\,A}{W}', sub: `L = \\dfrac{10000 \\times ${n(st.area)}}{${n(r.cal.W)}}`, result: `= ${n(r.cal.L)}\\,\\text{m}`, cite: C.am('§13 calibration') },
    { label: 'Wheel revolutions', tex: 'N = \\dfrac{L}{\\pi D}', sub: `N = \\dfrac{${n(r.cal.L)}}{\\pi \\times ${n(st.D)}}`, result: `= ${n(r.cal.N)} \\approx ${Math.ceil(r.cal.N)}\\ \\text{rev}`, cite: C.am('§13 calibration') },
    { label: 'Seed to collect', tex: 'm = R\\,A,\\quad m_{tube} = m/n', sub: `m = ${n(st.rate)} \\times ${n(st.area)} = ${n(r.cal.total)}\\,\\text{kg}`, result: `m_{tube} = ${n(r.cal.perTube)}\\,\\text{kg}`, cite: C.am('§13 calibration') },
  ]
  const psteps: WorkingStep[] = [
    { label: 'Seed spacing', tex: 's = \\dfrac{\\pi D}{i\\,N_c}', sub: `s = \\dfrac{\\pi \\times ${n(st.pD)}}{${n(st.ratio)} \\times ${st.cells}}`, result: `= ${n(r.seedGap * 1000)}\\,\\text{mm}`, beyond: true },
    { label: 'Plant population', tex: 'P = \\dfrac{10000}{r\\,s}', sub: `P = \\dfrac{10000}{${n(st.pSpacing)} \\times ${n(r.seedGap)}}`, result: `= ${n(r.pop)}\\,\\text{plants/ha}`, beyond: true },
  ]
  return (
    <>
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Width" value={fmt(r.W, 3)} unit="m" />
          <Readout label="Capacity" value={fmt(r.C, 3)} unit="ha/h" tone="info" />
          <Readout label="Wheel revs (pass)" value={fmt(v.revs, 3)} tone="accent" />
          {drill ? <Readout label="Seed metered" value={fmt((v.dist * r.cal.W * st.rate) / 10000, 3)} unit="kg" /> : <Readout label="Seed spacing" value={fmt(r.seedGap * 1000, 3)} unit="mm" />}
          {drill ? <Readout label="Revs per 0.1 ha" value={fmt(r.cal.N, 4)} /> : <Readout label="Population" value={fmt(r.pop / 1000, 3)} unit="k/ha" />}
        </div>
      </Section>
      <Section title="Machine">
        <Segmented<Kind>
          value={st.kind}
          onChange={(kind) => st.set({ kind })}
          options={[
            { value: 'drill', label: 'Seed drill' },
            { value: 'fert', label: 'Seed + fert.' },
            { value: 'planter', label: 'Planter' },
            { value: 'jab', label: 'Jab' },
          ]}
          size="sm"
        />
        {drill ? (
          <>
            <Slider label="Openers n" value={st.rows} min={3} max={9} step={1} digits={2} onChange={(rows) => st.set({ rows })} />
            <Slider label="Row spacing s" value={st.spacing * 1000} min={100} max={300} step={10} unit="mm" onChange={(s) => st.set({ spacing: s / 1000 })} />
            <Slider label="Seed rate R" value={st.rate} min={10} max={200} step={5} unit="kg/ha" onChange={(rate) => st.set({ rate })} />
            <Slider label="Ground-wheel diameter D" value={st.D} min={0.4} max={1.2} step={0.05} unit="m" onChange={(D) => st.set({ D })} />
            <Slider label="Calibration area A" value={st.area} min={0.01} max={0.5} step={0.01} unit="ha" onChange={(area) => st.set({ area })} />
          </>
        ) : st.kind === 'planter' ? (
          <>
            <Slider label="Rows" value={st.pRows} min={2} max={4} step={1} digits={2} onChange={(pRows) => st.set({ pRows })} />
            <Slider label="Row spacing" value={st.pSpacing} min={0.5} max={1.0} step={0.05} unit="m" onChange={(pSpacing) => st.set({ pSpacing })} />
            <Slider label="Cells on the plate" value={st.cells} min={6} max={30} step={1} digits={2} onChange={(cells) => st.set({ cells })} />
            <Slider label="Plate revs per wheel rev" value={st.ratio} min={0.25} max={2} step={0.05} onChange={(ratio) => st.set({ ratio })} />
            <Slider label="Drive-wheel diameter" value={st.pD} min={0.4} max={0.8} step={0.02} unit="m" onChange={(pD) => st.set({ pD })} />
          </>
        ) : null}
        {st.kind !== 'jab' ? (
          <>
            <Slider label="Seeding depth" value={st.depth * 1000} min={20} max={80} step={5} unit="mm" onChange={(d) => st.set({ depth: d / 1000 })} />
            <Slider label="Speed" value={st.speed} min={2} max={10} step={0.1} unit="km/h" onChange={(speed) => st.set({ speed })} />
          </>
        ) : null}
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
        <button className="mt-2 text-[11.5px] text-mute underline" onClick={() => (st.set({ ...DEFAULTS }), setActive(null))}>
          reset
        </button>
      </Section>
      <Section title="Working — drill calibration">
        <Working steps={steps} />
        <Note>Jack up the drill, turn the ground wheel N times and weigh the seed caught from each tube; adjust the rate setting until each tube gives the target mass.</Note>
      </Section>
      {st.kind === 'planter' ? (
        <Section title="Working — planter plate">
          <Working steps={psteps} />
        </Section>
      ) : null}
      <Section title="Seed drill vs planter">
        <table className="w-full border-collapse text-[11px] leading-snug">
          <thead>
            <tr className="text-mute">
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-left font-medium">Seed drill</th>
              <th className="py-1 text-left font-medium">Planter</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(([k, a, b]) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="py-1 pr-1 font-medium text-ink">{k}</td>
                <td className="py-1 pr-1 text-ink/80">{a}</td>
                <td className="py-1 text-ink/80">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>Crops and row widths are typical examples.</Note>
      </Section>
    </>
  )
}
