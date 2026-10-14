import { useMemo, useState } from 'react'
import { Chart } from '@/ui/Chart'
import { Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { ModeTabs, Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { RICE_CITES as R } from './cites'
import { DEFAULTS, GRAIN_VARIETIES, HARVEST_MC_PCT, analyseRiceProcessing, dryTo, live, useRice, type GrainVariety, type RiceParams, type RiceRoute } from './model'

const set = (p: Partial<RiceParams>) => useRice.getState().set(p)
const base = (p: Partial<RiceParams>) => set({ ...DEFAULTS, ...p })

export const PRESETS: Preset[] = [
  { id: 'raw-long', label: 'White rice · long grain', note: 'Regular route: clean → shell (hulls off) → brown rice → mill (bran off) → grade. Long grain (L/W > 3) is the most breakage-prone; head rice is about 55 % of kernels.', apply: () => base({}) },
  { id: 'parboiled', label: 'Parboiled · long grain', note: 'Warm-water soak, steam under pressure and dry before shelling. The starch gelatinises, sealing cracks: firmer, separate grains and far fewer brokens.', apply: () => base({ route: 'parboiled' }) },
  { id: 'medium', label: 'Medium grain', note: 'L/W 2.0–2.9, amylose 12–19 %: moist, tender grains that cling; less breakage in milling.', apply: () => base({ variety: 'medium' }) },
  { id: 'overmilled', label: 'Over-milled', note: 'Degree of milling raised to 12 % and a tight roll gap: more bran off, more brokens, lower head-rice yield.', apply: () => base({ degreeOfMillingPct: 12, hullerGapMm: 0.6 }) },
]

export const EXAM: Preset[] = [
  {
    id: 'pq-parboil',
    label: 'Whole-grain parboiled factory',
    note: 'Good-quality whole-grain parboiled rice: clean → soak (warm water) → steam → dry to ≈ 12 % → shell → mill → grade → package. Poor local quality comes from uneven soaking/steaming, sun drying with stones and fissures, and single-pass mills. By-products: hulls (fuel), bran (oil, feed), brokens (flour, brewers).',
    apply: () => base({ route: 'parboiled', dryingTargetMcPct: 12 }),
  },
]

function LivePanel() {
  const p = useRice()
  const a = useMemo(() => analyseRiceProcessing(p), [p])
  const t = useLive(() => live.time, 4)
  const hours = t / 60
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Paddy in" value={fmt(a.paddyIn, 4)} unit="kg/h" />
        <Readout label="Milled rice" value={fmt(a.totalMilledRice, 4)} unit="kg/h" tone="accent" />
        <Readout label="Milling yield" value={fmt(a.totalMilledYieldPct, 3)} unit="%" />
        <Readout label="Head rice yield" value={fmt(a.headRiceYieldPct, 3)} unit="%" tone="warn" />
        <Readout label="Brokens" value={fmt(a.totalBrokensYieldPct, 3)} unit="%" />
        <Readout label="Roll speeds" value={`${fmt(a.vFast, 3)} / ${fmt(a.vSlow, 3)}`} unit="m/s" tone="info" />
      </div>
      <Note>
        Plant time {fmt(hours, 3)} h (1 s shown = 1 min): {fmt((a.headRice * hours) / 1000, 3)} t head rice bagged. Rolls slip {fmt(a.vDiff, 3)} m/s against each other — that shear peels the husk.
      </Note>
      <div className="mt-2">
        <Table
          head={['Stream', 'kg/h', '% paddy']}
          rows={[
            ['Paddy in', fmt(a.paddyIn, 4), '100'],
            ['Dockage (cleaner)', fmt(a.impuritiesOut, 4), fmt((100 * a.impuritiesOut) / a.paddyIn, 3)],
            ['Hulls (husk)', fmt(a.huskOut, 4), fmt(a.huskYieldPct, 3)],
            ['Brown rice', fmt(a.brownRice, 4), fmt(a.brownRiceYieldPct, 3)],
            ['Bran', fmt(a.branOut, 4), fmt(a.branYieldPct, 3)],
            ['Head rice (≥ ¾)', fmt(a.headRice, 4), fmt(a.headRiceYieldPct, 3)],
            ['Second heads (½–¾)', fmt(a.secondHeads, 4), fmt(a.secondHeadsYieldPct, 3)],
            ['Screenings (¼–½)', fmt(a.screenings, 4), fmt(a.screeningsYieldPct, 3)],
            ['Brewers (< ¼)', fmt(a.brewers, 4), fmt(a.brewersYieldPct, 3)],
          ]}
          highlight={5}
        />
      </div>
    </Section>
  )
}

function Controls() {
  const p = useRice()
  return (
    <Section title="Line">
      <Segmented<RiceRoute>
        value={p.route}
        onChange={(route) => set({ route })}
        options={[
          { value: 'raw', label: 'Regular (white)' },
          { value: 'parboiled', label: 'Parboiled' },
        ]}
      />
      <Segmented<GrainVariety>
        value={p.variety}
        onChange={(variety) => set({ variety })}
        options={(['long', 'medium', 'short'] as const).map((v) => ({ value: v, label: `${GRAIN_VARIETIES[v].name} (${GRAIN_VARIETIES[v].aspectRatio})` }))}
        size="sm"
      />
      <ModeTabs<RiceParams['focusedStage']>
        value={p.focusedStage}
        onChange={(focusedStage) => set({ focusedStage })}
        options={[
          { value: 'all', label: 'All' },
          { value: 'cleaning', label: 'Cleaning' },
          { value: 'parboiling', label: 'Parboiling' },
          { value: 'hulling', label: 'Hulling' },
          { value: 'polishing', label: 'Polishing' },
          { value: 'grading', label: 'Grading' },
        ]}
      />
      <div className="h-2" />
      <Slider label="Paddy throughput" value={p.paddyFeedRate} min={200} max={5000} step={50} unit="kg/h" onChange={(paddyFeedRate) => set({ paddyFeedRate })} />
      <Slider label="Dockage removed" value={p.dockagePct} min={0} max={8} step={0.1} unit="%" onChange={(dockagePct) => set({ dockagePct })} />
      {p.route === 'parboiled' ? (
        <>
          <Slider label="Soak water temperature" value={p.parboilSoakTemp} min={30} max={80} step={1} unit="°C" onChange={(parboilSoakTemp) => set({ parboilSoakTemp })} />
          <Slider label="Steam pressure" value={p.parboilSteamPressure} min={0.2} max={2.5} step={0.1} unit="bar" onChange={(parboilSteamPressure) => set({ parboilSteamPressure })} />
        </>
      ) : null}
      <Slider label="Dry paddy to (moisture, w.b.)" value={p.dryingTargetMcPct} min={10} max={16} step={0.1} unit="%" onChange={(dryingTargetMcPct) => set({ dryingTargetMcPct })} hint="Dried to about 12 % before storage and milling" />
      <Slider label="Fast roll speed" value={p.hullerFastRpm} min={800} max={1800} step={10} unit="rpm" onChange={(hullerFastRpm) => set({ hullerFastRpm })} />
      <Slider label="Roll speed ratio" value={p.hullerRatio} min={1.05} max={1.4} step={0.01} onChange={(hullerRatio) => set({ hullerRatio })} />
      <Slider label="Roll gap" value={p.hullerGapMm} min={0.4} max={1.4} step={0.05} unit="mm" onChange={(hullerGapMm) => set({ hullerGapMm })} />
      <Slider label="Degree of milling (bran off)" value={p.degreeOfMillingPct} min={4} max={14} step={0.1} unit="%" onChange={(degreeOfMillingPct) => set({ degreeOfMillingPct })} />
      <Slider label="Aspirator air speed" value={p.aspiratorAirV} min={1.5} max={8} step={0.1} unit="m/s" onChange={(aspiratorAirV) => set({ aspiratorAirV })} hint="Between the terminal velocities of husk (~2.5 m/s) and grain (~7 m/s)" />
      <Note>Husk and bran fractions, roll settings and the breakage model are typical mill values; the flow chart gives the steps and the grading definitions only.</Note>
    </Section>
  )
}

function Charts() {
  const p = useRice()
  const a = useMemo(() => analyseRiceProcessing(p), [p])
  const stream = useMemo(() => {
    const xs = [0, 1, 2, 3, 4]
    return { xs, ys: [a.paddyIn, a.cleanPaddy, a.brownRice, a.totalMilledRice, a.headRice] }
  }, [a])
  const dom = useMemo(() => {
    const xs: number[] = []
    const raw: number[] = []
    const pb: number[] = []
    for (let d = 4; d <= 14; d += 0.5) {
      xs.push(d)
      raw.push(analyseRiceProcessing({ ...p, route: 'raw', degreeOfMillingPct: d }).headRiceYieldPct)
      pb.push(analyseRiceProcessing({ ...p, route: 'parboiled', degreeOfMillingPct: d }).headRiceYieldPct)
    }
    return { xs, raw, pb }
  }, [p])
  return (
    <Section title="Charts">
      <Chart data={[stream.xs, stream.ys]} series={[{ label: 'kg/h', color: '#d6b25e', width: 2 }]} xLabel="Paddy → clean → brown → milled → head rice" yLabel="Main stream (kg/h)" height={140} />
      <div className="h-2" />
      <Chart
        data={[dom.xs, dom.raw, dom.pb]}
        series={[
          { label: 'regular', color: '#6fb3e0', width: 2 },
          { label: 'parboiled', color: '#e8a33d', width: 2 },
        ]}
        xLabel="Degree of milling (% bran removed)"
        yLabel="Head rice yield (% paddy)"
        marker={() => [p.degreeOfMillingPct, a.headRiceYieldPct]}
        height={150}
      />
      <Note>Milling harder whitens the grain but removes more mass and breaks more kernels; parboiled grain stands up to it far better.</Note>
    </Section>
  )
}

function CalcWorking() {
  const p = useRice()
  const a = useMemo(() => analyseRiceProcessing(p), [p])
  const d = dryTo(1000, HARVEST_MC_PCT / 100, p.dryingTargetMcPct / 100)
  const steps: WorkingStep[] = [
    {
      label: 'Drying paddy (dry matter conserved)',
      tex: 'm_2=m_1\\dfrac{1-M_1}{1-M_2}',
      sub: `=1000\\,\\dfrac{1-${HARVEST_MC_PCT / 100}}{1-${n(p.dryingTargetMcPct / 100, 3)}}`,
      result: `=${n(d.out, 4)}\\ \\text{kg},\\ \\text{water removed } ${n(d.water, 3)}\\ \\text{kg per tonne}`,
      cite: R.flow('p9, dried rough rice ≈ 12 % MC'),
      beyond: true,
    },
    {
      label: 'Shelling — hulls off',
      tex: '\\text{brown}=\\text{clean paddy}(1-h)',
      sub: `=${n(a.cleanPaddy, 4)}(1-${n(GRAIN_VARIETIES[p.variety].baseHuskPct / 100, 3)})`,
      result: `=${n(a.brownRice, 4)}\\ \\text{kg/h}`,
      cite: R.flow('p9, shelling → hulls'),
    },
    {
      label: 'Milling — bran off',
      tex: '\\text{milled}=\\text{brown}(1-DOM)',
      sub: `=${n(a.brownRice, 4)}(1-${n(p.degreeOfMillingPct / 100, 3)})`,
      result: `=${n(a.totalMilledRice, 4)}\\ \\text{kg/h}\\ (${n(a.totalMilledYieldPct, 3)}\\,\\%\\ \\text{of paddy})`,
      cite: R.flow('p9, milling → rice bran'),
    },
    {
      label: 'Head rice yield',
      tex: 'HRY=\\dfrac{\\text{head rice}\\ (\\ge\\tfrac34\\ \\text{length})}{\\text{paddy}}',
      sub: `=\\dfrac{${n(a.headRice, 4)}}{${n(a.paddyIn, 4)}}`,
      result: `=${n(a.headRiceYieldPct, 3)}\\,\\%`,
      cite: R.types('p12, head rice ≥ ¾ kernel length'),
    },
    {
      label: 'Rubber-roll huller: surface speeds',
      tex: 'v=\\dfrac{\\pi D N}{60},\\quad \\Delta v=v_f-v_s',
      sub: `v_f=\\dfrac{\\pi(${p.rollDiameterM})(${p.hullerFastRpm})}{60},\\ N_s=${p.hullerFastRpm}/${p.hullerRatio}`,
      result: `v_f=${n(a.vFast, 3)},\\ v_s=${n(a.vSlow, 3)},\\ \\Delta v=${n(a.vDiff, 3)}\\ \\text{m/s}`,
      cite: R.beyond('rubber-roll huller differential speed'),
      beyond: true,
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function RicePanel() {
  const [preset, setPreset] = useState<string | null>('raw-long')
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
