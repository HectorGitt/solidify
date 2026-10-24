import { useMemo, useState } from 'react'
import { PITCH, chainLengthPitches, chordalVariation, type PitchKey } from '@/physics/elements'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { A503 } from '../_shared/cites'
import { ModeTabs, Note, NumberField, PresetGrid, Table, type Preset } from '../_shared/PanelBits'
import { DEFAULTS, PLANTER, live, planterTrain, select, useChains, type ChainParams, type Mode } from './model'

const set = (p: Partial<ChainParams>) => useChains.getState().set(p)
const base = (p: Partial<ChainParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  {
    id: 'mg17',
    label: 'Separator · 2 kW, 200→60 rpm',
    note: 'Exams 2017/18 Q1c and 2021/22 (exam and test): moderate shock → SF 1.3, design 2.6 kW; ¾″ pitch; ratio 3.3; 17/57 teeth; 2.5 kW simplex < 2.6 kW → duplex 2.5 × 1.7 = 4.25 kW.',
    flag: 'The 2017/18 marking scheme writes "driving sprocket 57 teeth, driven 17" — that would speed the shaft up to 670 rpm. The 17-tooth sprocket must be on the 200 rpm shaft (200 × 17/57 = 59.6 rpm).',
    apply: () => base({ mode: 'drive', pitch: '3/4', z1: 17, z2: 57, rated: 2, sf: 1.3, rpm: 200, outRpm: 60, simplex: 2.5, strands: 2, cPitches: 40 }),
  },
  {
    id: 'mg16',
    label: 'Same drive · 2016/17 answer',
    note: 'The 2016/17 marking guide answers the same 2 kW, 200 → 60 rpm question with 23/76 teeth and a 3.46 kW single strand — enough for 2.6 kW, so a simplex chain.',
    flag: 'The 2016/17 and 2017/18 answers disagree (23/76 simplex vs 17/57 duplex): the catalogue allows both; more teeth on the small sprocket raise the simplex rating.',
    apply: () => base({ mode: 'drive', pitch: '3/4', z1: 23, z2: 76, rated: 2, sf: 1.3, rpm: 200, outRpm: 60, simplex: 3.46, strands: 1, cPitches: 40 }),
  },
  {
    id: 'mg15',
    label: 'Pump · 6.5 kW, heavy shock',
    note: 'Exam 2015/16 Q2a: 6.5 kW, 1500 → 575 rpm, heavy shock → SF 1.5, design 9.75 kW; ratio 2.61; ½″ pitch; 16/38 teeth (rating read from the chart).',
    apply: () => base({ mode: 'drive', pitch: '1/2', z1: 16, z2: 38, rated: 6.5, sf: 1.5, rpm: 1500, outRpm: 575, simplex: NaN, strands: 1, cPitches: 36 }),
  },
  {
    id: 'mg19',
    label: '11 kW, 970→330 rpm',
    note: 'Exam and test 2019/20: SF 1.3 → 14.3 kW; ¾″ pitch; 19/57 teeth (ratio 2.94 ≈ 3); 11.70 kW simplex < 14.3 → duplex 11.7 × 1.7 = 19.89 kW.',
    apply: () => base({ mode: 'drive', pitch: '3/4', z1: 19, z2: 57, rated: 11, sf: 1.3, rpm: 970, outRpm: 330, simplex: 11.7, strands: 2, cPitches: 38 }),
  },
  {
    id: 'planter',
    label: 'Planter chain train',
    note: 'Exam 2016/17: in a planter the press wheel drives a lay shaft and the lay shaft drives the seed meter, all by chain. Sprocket sizes here are representative.',
    apply: () => base({ mode: 'planter' }),
  },
]

function LivePanel() {
  const p = useChains()
  const v = useLive(() => ({ ...live }), 8, (a, b) => a.links === b.links && a.rpm2 === b.rpm2)
  const s = select(p)
  if (p.mode === 'planter') {
    const t = planterTrain(p.speed)
    return (
      <Section title="Live">
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Press wheel" value={fmt(t.wheelRpm, 3)} unit="rpm" />
          <Readout label="Lay shaft" value={fmt(t.layRpm, 3)} unit="rpm" />
          <Readout label="Seed plate" value={fmt(t.meterRpm, 3)} unit="rpm" tone="info" />
        </div>
        <Note>
          Meter turns {fmt(t.meterPerWheel, 3)} × per wheel turn ({PLANTER.zWheel}/{PLANTER.zLayIn} × {PLANTER.zLayOut}/{PLANTER.zMeter}); with {PLANTER.cells} cells the seed spacing is {fmt(t.spacing * 100, 3)} cm at any speed — the reason the meter is ground-driven.
        </Note>
      </Section>
    )
  }
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Driver" value={fmt(p.rpm, 4)} unit="rpm" />
        <Readout label="Driven" value={fmt(s.out, 4)} unit="rpm" tone="info" />
        <Readout label="Chain speed" value={fmt(s.v, 3)} unit="m/s" />
        <Readout label="Links" value={v.links} unit={`C = ${fmt(v.C * 1000, 4)} mm`} />
        <Readout label="Design power" value={fmt(s.design, 3)} unit="kW" tone="accent" />
        <Readout label="Chain needed" value={s.strands === 1 ? 'Simplex' : s.strands === 2 ? 'Duplex' : Number.isFinite(p.simplex) ? 'Larger pitch' : '—'} tone="warn" />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useChains()
  return (
    <Section title="Drive">
      <ModeTabs<Mode>
        value={p.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'drive', label: 'Two-sprocket drive' },
          { value: 'planter', label: 'Planter train' },
        ]}
      />
      <div className="h-2" />
      {p.mode === 'planter' ? (
        <Slider label="Forward speed" value={p.speed} min={2} max={12} step={0.5} unit="km/h" onChange={(speed) => set({ speed })} />
      ) : (
        <>
          <Segmented<PitchKey> value={p.pitch} onChange={(pitch) => set({ pitch })} options={(Object.keys(PITCH) as PitchKey[]).map((k) => ({ value: k, label: `${k}″` }))} label="Pitch" />
          <Segmented<'1' | '2'>
            value={String(p.strands) as '1' | '2'}
            onChange={(v) => set({ strands: v === '2' ? 2 : 1 })}
            options={[
              { value: '1', label: 'Simplex' },
              { value: '2', label: 'Duplex' },
            ]}
          />
          <Slider label="Driving sprocket z₁" value={p.z1} min={9} max={30} step={1} onChange={(z1) => set({ z1 })} />
          <Slider label="Driven sprocket z₂" value={p.z2} min={12} max={90} step={1} onChange={(z2) => set({ z2 })} />
          <Slider label="Centre distance" value={p.cPitches} min={20} max={60} step={1} unit="pitches" onChange={(cPitches) => set({ cPitches })} hint="Snapped to a whole, even number of links" />
          <Slider label="Driver speed" value={p.rpm} min={20} max={1500} step={5} unit="rpm" onChange={(rpm) => set({ rpm })} />
          <Note>Use the toolbar’s explode slider to pull the plates and pins apart, and “Section everything” to cut the pin, bush and roller.</Note>
        </>
      )}
    </Section>
  )
}

function Selection() {
  const p = useChains()
  const s = select(p)
  const pm = PITCH[p.pitch]
  const steps: WorkingStep[] = [
    { label: '(a) Service factor → design power', tex: 'P_d=\\text{SF}\\times P', sub: `=${p.sf}\\times${p.rated}`, result: `=${n(s.design, 4)}\\ \\text{kW}`, cite: A503.m(3, 'steps (a)–(b)') },
    { label: '(b) Speed ratio', tex: 'i=N_1/N_2', sub: `=${p.rpm}/${p.outRpm}`, result: `=${n(s.ratio, 3)}`, cite: A503.m(3) },
    { label: '(c) Pitch and sprockets (chart)', tex: `p=${p.pitch}''\\ (${n(pm * 1000, 4)}\\ \\text{mm}),\\ z_2/z_1=${p.z2}/${p.z1}`, sub: `N_2=N_1\\dfrac{z_1}{z_2}=${p.rpm}\\times\\dfrac{${p.z1}}{${p.z2}}`, result: `=${n(s.out, 4)}\\ \\text{rpm}`, cite: A503.table('chain selection chart') },
  ]
  if (Number.isFinite(p.simplex))
    steps.push({
      label: '(d) Rating: simplex, or duplex = 1.7 × simplex',
      tex: 'P_{duplex}=1.7\\,P_{simplex}',
      sub: `P_{simplex}=${p.simplex}\\ \\text{kW}${p.simplex >= s.design ? '\\ \\ge' : '\\ <'}\\ ${n(s.design, 4)};\\ \\ 1.7\\times${p.simplex}`,
      result: `=${n(s.duplex, 4)}\\ \\text{kW}\\ \\Rightarrow\\ \\text{${s.strands === 1 ? 'simplex' : s.strands === 2 ? 'duplex' : 'try a larger pitch'}}`,
      cite: A503.mg17('Q1c'),
    })
  steps.push({ label: 'Pitch diameters', tex: 'D=\\dfrac{p}{\\sin(180^\\circ/z)}', sub: `D_1=\\dfrac{${n(pm * 1000, 4)}}{\\sin(180^\\circ/${p.z1})}`, result: `D_1=${n(s.D1 * 1000, 4)},\\ D_2=${n(s.D2 * 1000, 4)}\\ \\text{mm}`, beyond: true, cite: A503.beyond('sprocket geometry') })
  steps.push({ label: 'Chain speed and chordal (polygon) action', tex: 'v=\\dfrac{zpN}{60},\\quad \\dfrac{\\Delta v}{v}=1-\\cos\\dfrac{180^\\circ}{z_1}', sub: `v=\\dfrac{${p.z1}(${n(pm, 4)})(${p.rpm})}{60}`, result: `=${n(s.v, 3)}\\ \\text{m/s},\\ \\ \\Delta v/v=${n(s.variation * 100, 3)}\\,\\%`, beyond: true, cite: A503.beyond('chordal action — not in the notes') })
  steps.push({ label: 'Chain length', tex: 'L_p=\\dfrac{2C}{p}+\\dfrac{z_1+z_2}{2}+\\left(\\dfrac{z_2-z_1}{2\\pi}\\right)^2\\dfrac{p}{C}', sub: `C=${n(live.C * 1000, 4)}\\ \\text{mm}`, result: `L_p\\approx${n(chainLengthPitches(live.C, pm, p.z1, p.z2), 4)}\\ \\to\\ ${live.links}\\ \\text{links (even)}`, beyond: true, cite: A503.beyond('chain length formula') })
  return (
    <Section title="Selection — working">
      <NumberField label="Rated power" value={p.rated} onChange={(rated) => set({ rated })} unit="kW" step={0.1} />
      <NumberField label="Service factor" value={p.sf} onChange={(sf) => set({ sf })} step={0.1} hint="1.3 moderate shock, 1.5 heavy shock (typical)" />
      <NumberField label="Driven speed wanted" value={p.outRpm} onChange={(outRpm) => set({ outRpm })} unit="rpm" step={1} />
      <NumberField label="Simplex rating (chart)" value={p.simplex} onChange={(simplex) => set({ simplex })} unit="kW" step={0.01} />
      <div className="h-1" />
      <Working steps={steps} />
    </Section>
  )
}

function Charts() {
  const p = useChains()
  const data = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []
    for (let z = 8; z <= 40; z++) {
      xs.push(z)
      ys.push(chordalVariation(z) * 100)
    }
    return { xs, ys }
  }, [])
  return (
    <Section title="Chordal action">
      <Chart data={[data.xs, data.ys]} series={[{ label: 'Δv/v', color: '#e8794f', width: 2 }]} xLabel="Teeth on the small sprocket" yLabel="Speed variation (%)" marker={() => [p.z1, chordalVariation(p.z1) * 100]} height={140} />
      <Note>The chain wraps the sprocket as a polygon, so its speed pulses once per tooth. Few teeth → rough running: one reason the catalogue sets a minimum tooth count.</Note>
      <Table
        head={['Pitch', 'mm', 'Typical use']}
        rows={[
          ['½″', '12.7', 'light drives, planters'],
          ['⅝″', '15.875', ''],
          ['¾″', '19.05', '2–15 kW farm machines'],
          ['1″', '25.4', 'heavy drives'],
        ]}
      />
    </Section>
  )
}

export function ChainsPanel() {
  const [preset, setPreset] = useState<string | null>('mg17')
  return (
    <div>
      <LivePanel />
      <Controls />
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Selection />
      <Charts />
    </div>
  )
}
