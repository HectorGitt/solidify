import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { CITE } from './cites'
import { AFNOR_STANDARDS, DEFAULTS, calcGarriMassBalance, live, useGarri, type GarriGrade, type GarriParams } from './model'

const set = (p: Partial<GarriParams>) => useGarri.getState().set(p)
const base = (p: Partial<GarriParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  { id: 'standard', label: 'Medium garri · 1 t roots', note: 'Typical line: roots ≈ 68 % water, 22 % peel loss, pressed to 47 % moisture, fried to 10.5 %. Garri must not exceed 12 % moisture and should carry 0.6–1.0 % acidity (as lactic acid).', apply: () => base({}) },
  { id: 'extra-fine', label: 'Extra-fine grade', note: 'Extra-fine: 100 % passes the 0.50 mm sieve (at least 40 % passes 0.25 mm).', apply: () => base({ grade: 'extra-fine' }) },
  { id: 'coarse', label: 'Coarse grade', note: 'Coarse: 100 % passes 2 mm, no more than 40 % passes 1.25 mm.', apply: () => base({ grade: 'coarse' }) },
  { id: 'underfried', label: 'Under-fried · fails moisture', note: 'Fried only to 14 % moisture: over the 12 % limit — the garri will cake and go mouldy in the bag.', apply: () => base({ targetMoisture: 14 }) },
  { id: 'short-ferment', label: '1-day ferment · fails acidity', note: 'One day of fermentation leaves the acidity below 0.6 % and more cyanide in the product.', apply: () => base({ fermentDays: 1 }) },
  { id: 'big', label: '5 t/h plant', note: 'The same flow chart at 5 t of roots per hour, bagged in 50 kg sacks.', apply: () => base({ batchRoots: 5000 }) },
]

export const EXAM: Preset[] = [
  {
    id: 'pq-mash',
    label: 'Hammer-mill mash for garri',
    note: 'A hammer mill with a 1.5 mm screen used to make cassava mash for garri: the screen sets the fineness of the mash and so the granule size and texture after frying; too fine a mash gives pasty, lumpy garri. Here: medium grade, grated mash.',
    apply: () => base({ grade: 'medium' }),
  },
]

function Pass({ ok }: { ok: boolean }) {
  return <Badge tone={ok ? 'accent' : 'danger'}>{ok ? 'pass' : 'fail'}</Badge>
}

function LivePanel() {
  const p = useGarri()
  const mb = useMemo(() => calcGarriMassBalance(p), [p])
  const ang = useLive(() => live.peelerAngle, 4)
  const hours = ang / 3 / 60 // peeler turns at 3 rad/s of sim time; 1 s shown = 1 plant-minute
  const s = mb.standards
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Roots in" value={fmt(mb.rootsIn.mass, 4)} unit="kg/h" />
        <Readout label="Garri out" value={fmt(mb.gradedGarri.mass, 4)} unit="kg/h" tone="accent" />
        <Readout label="Yield" value={fmt(mb.extractionYieldPct, 3)} unit="% roots" tone="warn" />
        <Readout label="Steam off fryer" value={fmt(mb.steamEvaporated, 4)} unit="kg/h" tone="info" />
        <Readout label="Fryer heat" value={fmt(mb.totalHeatKj / 3600, 3)} unit="kW" />
        <Readout label="Sacks" value={`${mb.fullBags} × ${p.bagSize}`} unit="kg/h" />
      </div>
      <Note>
        Plant time {fmt(hours, 3)} h (1 s shown = 1 min): {fmt((mb.gradedGarri.mass * hours) / 1000, 3)} t garri, {fmt((mb.gradedGarri.mass * hours) / p.bagSize, 3)} sacks.
      </Note>
      <div className="mt-2">
        <Table
          head={['Stream', 'kg/h', 'moisture %', 'dry kg/h']}
          rows={[
            ['Fresh roots', fmt(mb.rootsIn.mass, 4), fmt(mb.rootsIn.moisture, 3), fmt(mb.rootsIn.solids, 4)],
            ['− peels', fmt(mb.peelsOut.mass, 4), fmt(mb.peelsOut.moisture, 3), fmt(mb.peelsOut.solids, 4)],
            ['Washed roots', fmt(mb.washedRoots.mass, 4), fmt(mb.washedRoots.moisture, 3), fmt(mb.washedRoots.solids, 4)],
            ['Mash', fmt(mb.wetMash.mass, 4), fmt(mb.wetMash.moisture, 3), fmt(mb.wetMash.solids, 4)],
            ['− liquor', fmt(mb.liquorExpelled.mass, 4), '≈ 95', fmt(mb.liquorExpelled.solids, 4)],
            ['Press cake', fmt(mb.pressCake.mass, 4), fmt(mb.pressCake.moisture, 3), fmt(mb.pressCake.solids, 4)],
            ['− fibre residue', fmt(mb.chaffFiberOut.mass, 4), fmt(mb.chaffFiberOut.moisture, 3), fmt(mb.chaffFiberOut.solids, 4)],
            ['− steam (fryer)', fmt(mb.steamEvaporated, 4), '100', '0'],
            ['Fried garri', fmt(mb.friedGarri.mass, 4), fmt(mb.friedGarri.moisture, 3), fmt(mb.friedGarri.solids, 4)],
            ['− coarse to mill', fmt(mb.oversizeRecycle.mass, 4), fmt(mb.oversizeRecycle.moisture, 3), fmt(mb.oversizeRecycle.solids, 4)],
            ['Graded garri', fmt(mb.gradedGarri.mass, 4), fmt(mb.gradedGarri.moisture, 3), fmt(mb.gradedGarri.solids, 4)],
          ]}
          highlight={10}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11.5px] text-ink/85">
        <span>
          Moisture {fmt(s.moistureVal, 3)} % ≤ 12 <Pass ok={s.moisturePass} />
        </span>
        <span>
          Acidity {fmt(s.acidityVal, 2)} % (0.6–1.0) <Pass ok={s.acidityPass} />
        </span>
        <span>
          Crude fibre {s.fibreVal} % ≤ 2 <Pass ok={s.fibrePass} />
        </span>
        <span>
          Ash {s.ashVal} % ≤ 2.75 <Pass ok={s.ashPass} />
        </span>
        <span>
          Total HCN {fmt(s.cyanideVal, 2)} mg/kg ≤ 2 (Codex STAN 193, referenced by the gari standard §4.1) <Pass ok={s.cyanidePass} />
        </span>
      </div>
      <Note>Acidity and cyanide follow a typical first-order fermentation model; fibre and ash are typical values for peeled, washed roots.</Note>
    </Section>
  )
}

function Controls() {
  const p = useGarri()
  return (
    <Section title="Line">
      <Slider label="Root throughput" value={p.batchRoots} min={200} max={10000} step={100} unit="kg/h" onChange={(batchRoots) => set({ batchRoots })} />
      <Slider label="Root moisture (w.b.)" value={p.rootMoisture} min={55} max={75} step={0.5} unit="%" onChange={(rootMoisture) => set({ rootMoisture })} />
      <Slider label="Peel and tip loss" value={p.peelLoss} min={10} max={35} step={0.5} unit="%" onChange={(peelLoss) => set({ peelLoss })} />
      <Slider label="Fermentation" value={p.fermentDays} min={0.5} max={5} step={0.5} unit="days" onChange={(fermentDays) => set({ fermentDays })} />
      <Slider label="Pressed cake moisture" value={p.dewaterMoisture} min={35} max={60} step={0.5} unit="%" onChange={(dewaterMoisture) => set({ dewaterMoisture })} />
      <Slider label="Fry to moisture" value={p.targetMoisture} min={6} max={18} step={0.1} unit="%" onChange={(targetMoisture) => set({ targetMoisture })} hint="Garri standard: 12 % maximum" />
      <Slider label="Pan temperature" value={p.fryingTemp} min={90} max={200} step={1} unit="°C" onChange={(fryingTemp) => set({ fryingTemp })} />
      <Segmented<GarriGrade>
        label="Grade (sifter screens)"
        value={p.grade}
        onChange={(grade) => set({ grade })}
        options={(Object.keys(AFNOR_STANDARDS) as GarriGrade[]).map((g) => ({ value: g, label: AFNOR_STANDARDS[g].label }))}
        size="sm"
      />
      <Note tone="mute">{AFNOR_STANDARDS[p.grade].note}</Note>
      <Toggle label="50 kg sacks (off: 25 kg)" checked={p.bagSize === 50} onChange={(on) => set({ bagSize: on ? 50 : 25 })} />
      <Note>Machine forms, peel loss, cake moisture and the fryer energy are typical values; the flow chart gives the steps and the standard gives the limits.</Note>
    </Section>
  )
}

function Charts() {
  const p = useGarri()
  const mb = useMemo(() => calcGarriMassBalance(p), [p])
  const line = useMemo(() => {
    const st = [mb.rootsIn, mb.peeledRoots, mb.wetMash, mb.pressCake, mb.siftedGrits, mb.friedGarri, mb.gradedGarri]
    return { xs: st.map((_, i) => i), m: st.map((s) => s.mass), d: st.map((s) => s.solids), w: st.map((s) => s.moisture) }
  }, [mb])
  const sweep = useMemo(() => {
    const xs: number[] = []
    const y: number[] = []
    for (let m = 6; m <= 18; m += 0.25) {
      xs.push(m)
      y.push(calcGarriMassBalance({ ...p, targetMoisture: m }).extractionYieldPct)
    }
    return { xs, y }
  }, [p])
  return (
    <Section title="Charts">
      <Chart
        data={[line.xs, line.m, line.d]}
        series={[
          { label: 'total', color: '#e6cf8a', width: 2 },
          { label: 'dry matter', color: '#9bd17a', width: 2, dash: [4, 3] },
        ]}
        xLabel="roots → peeled → mash → cake → grits → fried → graded"
        yLabel="kg/h"
        height={150}
      />
      <Note>The total falls steeply as peel, liquor and steam leave; the dry matter barely changes — water is what the line removes.</Note>
      <div className="h-2" />
      <Chart data={[sweep.xs, sweep.y]} series={[{ label: 'yield', color: '#e8a33d', width: 2 }]} xLabel="Final moisture (%)" yLabel="Garri yield (% of roots)" marker={() => [p.targetMoisture, mb.extractionYieldPct]} height={140} />
      <Note>Wetter garri weighs more but fails the 12 % limit and spoils in store.</Note>
    </Section>
  )
}

function CalcWorking() {
  const p = useGarri()
  const mb = useMemo(() => calcGarriMassBalance(p), [p])
  const steps: WorkingStep[] = [
    { label: 'Peeling', tex: 'm_{peeled}=m_{roots}(1-f_{peel})', sub: `=${n(mb.rootsIn.mass, 4)}(1-${n(p.peelLoss / 100, 3)})`, result: `=${n(mb.peeledRoots.mass, 4)}\\ \\text{kg/h}`, cite: CITE.garriFlow('peeling and washing → peels'), beyond: true },
    {
      label: 'Pressing — dry matter conserved',
      tex: 'm_{cake}=\\dfrac{S_{cake}}{1-M_{cake}}',
      sub: `=\\dfrac{${n(mb.pressCake.solids, 4)}}{1-${n(p.dewaterMoisture / 100, 3)}}`,
      result: `=${n(mb.pressCake.mass, 4)}\\ \\text{kg/h},\\ \\text{liquor } ${n(mb.liquorExpelled.mass, 4)}\\ \\text{kg/h}`,
      cite: CITE.garriFlow('fermentation and dewatering → liquor'),
    },
    {
      label: 'Frying — water evaporated',
      tex: 'm_{garri}=\\dfrac{S}{1-M_{garri}},\\quad m_{steam}=m_{grits}-m_{garri}',
      sub: `=\\dfrac{${n(mb.siftedGrits.solids, 4)}}{1-${n(p.targetMoisture / 100, 3)}}`,
      result: `=${n(mb.friedGarri.mass, 4)}\\ \\text{kg/h},\\ m_{steam}=${n(mb.steamEvaporated, 4)}\\ \\text{kg/h}`,
      cite: CITE.gstd('§2.1 heat treatment, §3.3 moisture ≤ 12 %'),
    },
    {
      label: 'Fryer heat duty',
      tex: 'Q=m_{grits}c_p\\Delta T+m_{steam}h_{fg}',
      sub: `=${n(mb.siftedGrits.mass, 4)}(2.8)(60)+${n(mb.steamEvaporated, 4)}(2260)`,
      result: `=${n(mb.totalHeatKj, 4)}\\ \\text{kJ/h}=${n(mb.totalHeatKj / 3600, 3)}\\ \\text{kW}`,
      beyond: true,
    },
    {
      label: 'Yield and standard check',
      tex: 'Y=\\dfrac{m_{garri}}{m_{roots}},\\quad M\\le 12\\,\\%',
      sub: `=\\dfrac{${n(mb.gradedGarri.mass, 4)}}{${n(mb.rootsIn.mass, 4)}}`,
      result: `=${n(mb.extractionYieldPct, 3)}\\,\\%,\\ M=${n(mb.standards.moistureVal, 3)}\\,\\%\\ (${mb.standards.moisturePass ? '\\text{pass}' : '\\text{fail}'})`,
      cite: CITE.gstd('§3.3'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function GarriPanel() {
  const [preset, setPreset] = useState<string | null>('standard')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={EXAM} active={preset} onPick={setPreset} />
      </Section>
      <Charts />
      <CalcWorking />
    </div>
  )
}
