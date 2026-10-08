import { useState } from 'react'
import { Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../_appkit/ui'
import { C, DEFAULTS, METHODS, STAGES, VEG, acresOf, costing, live, recommend, survey, useClearing, type ClearingParams, type Method, type Stage, type Vegetation } from './model'
import { enterStage } from './Scene3D'

/** Change parameters that alter the field, then rebuild the field for the chosen stage. */
export function setAndEnter(p: Partial<ClearingParams>) {
  useClearing.getState().set(p)
  enterStage()
}

export const PRESETS: Preset[] = [
  {
    id: 'q2c',
    label: '2018/19 Q2c · Costing 40 ha',
    note: '40 ha (≈ 100 acres). Manual ₦10,000 slash + ₦5,000 stump per acre, 4 people clear 1 acre a day; dozer 15 acres/day at ₦150,000/day; bale loader 5 acres/day at ₦50,000/day. See the Working below.',
    apply: () => useClearing.getState().set({ ...DEFAULTS, stage: useClearing.getState().stage, method: useClearing.getState().method, veg: useClearing.getState().veg, auto: useClearing.getState().auto }),
  },
  {
    id: 'chain',
    label: 'Chaining regrowth',
    note: 'Regrowth up to 30 cm at about 1800 stems/ha: within the chain’s limits (45 cm, 2500 stems/ha). Two crawlers clear the whole strip in one pass.',
    apply: () => setAndEnter({ stage: 'knockdown', method: 'chain', veg: 'regrowth', auto: false }),
  },
  {
    id: 'chain-forest',
    label: 'Chain in virgin forest',
    note: 'Trees over 45 cm stand up to the chain: it rides over them. Large timber needs the dozer, tree pusher or shear blade.',
    apply: () => setAndEnter({ stage: 'knockdown', method: 'chain', veg: 'forest', auto: false }),
  },
  {
    id: 'shear',
    label: 'Shear, then root-plough',
    note: 'Shear at ground level with sharp blades, windrow and burn; the stumps are left and shattered later by root ploughing at 20–50 cm.',
    apply: () => setAndEnter({ stage: 'knockdown', method: 'shear', veg: 'savanna', auto: true }),
  },
  {
    id: 'sequence',
    label: 'Whole sequence',
    note: 'Survey → knock down → windrow → burn → till, played in order.',
    apply: () => setAndEnter({ stage: 'survey', method: 'chain', veg: 'regrowth', auto: true }),
  },
]

function LivePanel() {
  const st = useClearing()
  const v = useLive(() => ({ p: live.progress, c: live.counted, d: live.down, t: live.total }), 6, (a, b) => Math.abs(a.p - b.p) < 0.01 && a.c === b.c && a.d === b.d && a.t === b.t)
  const sv = survey(v.c, VEG[st.veg].dMax)
  return (
    <Section title="Live">
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Stage" value={STAGES.find((s) => s.id === st.stage)!.label.split(' · ')[1]} unit={`${Math.round(v.p * 100)} %`} tone="accent" />
        <Readout label="Stems counted" value={v.c} unit="in 0.1 ha" />
        <Readout label="Density" value={fmt(sv.density, 3)} unit="stems/ha" tone={sv.density > sv.limit.stemsPerHa ? 'warn' : 'ink'} />
        <Readout label="Largest stem" value={VEG[st.veg].dMax} unit="cm" tone={VEG[st.veg].dMax > sv.limit.diameterCm ? 'warn' : 'ink'} />
        <Readout label="Trees down" value={`${v.d}/${v.t}`} />
        <Readout label="Chain suits?" value={sv.chain.ok ? 'yes' : 'no'} tone={sv.chain.ok ? 'accent' : 'warn'} />
      </div>
      <Note>{STAGES.find((s) => s.id === st.stage)!.text} Machine speeds are a time-lapse.</Note>
    </Section>
  )
}

function Factors() {
  const st = useClearing()
  const r = recommend(st.veg, st.hectares)
  return (
    <Section title="Choosing a method">
      <Segmented<Vegetation> label="Vegetation" value={st.veg} options={(Object.keys(VEG) as Vegetation[]).map((k) => ({ value: k, label: VEG[k].label }))} onChange={(veg) => setAndEnter({ veg })} size="sm" />
      <Note>{VEG[st.veg].text}</Note>
      <Table
        head={['Factor', 'Here']}
        rows={[
          ['Size of the area', `${fmt(st.hectares, 3)} ha (${fmt(acresOf(st.hectares), 3)} acres)`],
          ['Vegetation type, density', `${VEG[st.veg].label}, ≈ ${VEG[st.veg].density} stems/ha`],
          ['Tree size', `up to ${VEG[st.veg].dMax} cm`],
          ['Purpose of land use', 'Arable — keep the topsoil'],
          ['Cost', 'see the costing below'],
        ]}
      />
      <div className="mt-2 rounded-md border border-accent/40 px-2.5 py-2 text-[12px] leading-snug text-ink/90">
        Suggested: <b>{r.method === 'hand' ? 'hand clearing' : METHODS[r.method].label}</b> — {r.why}
      </div>
    </Section>
  )
}

function CostWorking() {
  const st = useClearing()
  const c = costing(st)
  const naira = (x: number) => `₦${Math.round(x).toLocaleString('en-GB')}`
  const steps: WorkingStep[] = [
    {
      label: 'Area in acres',
      tex: 'A = \\dfrac{\\text{ha}}{0.4047}',
      sub: `= \\dfrac{${n(st.hectares, 4)}}{0.4047}`,
      result: `= ${n(acresOf(st.hectares), 4)}${st.guideRound ? ` \\approx ${n(c.acres, 4)}` : ''}\\ \\text{acres}`,
      cite: C.guide1819('Q2c'),
      errata: st.hectares === 40 && st.guideRound ? '40 ha is 98.8 acres; the marking guide rounds it to 100 acres.' : undefined,
    },
    {
      label: 'Manual: cost (₦) and time',
      tex: '\\text{cost} = A\\,(c_{slash}+c_{stump}),\\quad t = A/\\text{rate}',
      sub: `= ${n(c.acres, 4)}\\times${n(st.manualPerAcre, 5)},\\quad ${n(c.acres, 4)}/${n(st.manualAcresDay, 3)}`,
      result: `= ${n(c.manual.cost, 7)},\\ ${n(c.manual.days, 4)}\\ \\text{days}`,
      cite: C.guide1819('Q2c manual'),
      errata: 'The guide says “4 people will clear 1 acre in a day” but then allows 25 days for 100 acres, which needs 4 acres a day (each person clearing an acre).',
    },
    {
      label: 'Dozer (₦)',
      tex: 't = A/15,\\quad \\text{cost} = t\\times150\\,000',
      sub: `= ${n(c.acres, 4)}/${n(st.dozerAcresDay, 3)}\\ \\text{days},\\ \\times\\,${n(st.dozerPerDay, 6)}`,
      result: `= ${n(c.dozer.days, 4)} \\approx ${c.dozer.daysWhole}\\ \\text{days},\\ ${n(c.dozer.cost, 7)}`,
      cite: C.guide1819('Q2c dozer'),
    },
    {
      label: 'Bale loader (₦)',
      tex: 't = A/5,\\quad \\text{cost} = t\\times50\\,000',
      sub: `= ${n(c.acres, 4)}/${n(st.loaderAcresDay, 3)}\\ \\text{days},\\ \\times\\,${n(st.loaderPerDay, 6)}`,
      result: `= ${n(c.loader.days, 4)}\\ \\text{days},\\ ${n(c.loader.cost, 7)}`,
      cite: C.guide1819('Q2c bale loader'),
    },
  ]
  return (
    <Section title="Working — clearing cost">
      <div className="grid grid-cols-2 gap-x-3">
        <Slider label="Area" value={st.hectares} min={1} max={200} step={1} unit="ha" onChange={(hectares) => st.set({ hectares })} />
        <Slider label="Manual cost" value={st.manualPerAcre} min={5000} max={40000} step={500} unit="₦/acre" onChange={(manualPerAcre) => st.set({ manualPerAcre })} />
        <Slider label="Manual rate" value={st.manualAcresDay} min={0.5} max={8} step={0.5} unit="acre/day" onChange={(manualAcresDay) => st.set({ manualAcresDay })} />
        <Slider label="Dozer rate" value={st.dozerAcresDay} min={5} max={30} step={1} unit="acre/day" onChange={(dozerAcresDay) => st.set({ dozerAcresDay })} />
      </div>
      <Toggle label="Round acres to the nearest 5" checked={st.guideRound} onChange={(guideRound) => st.set({ guideRound })} />
      <Working steps={steps} />
      <Table
        head={['Option', 'Days', 'Cost']}
        rows={[
          ['Manual', fmt(c.manual.days, 3), naira(c.manual.cost)],
          ['Manual (4 acres/day)', fmt(c.guideManual.days, 3), naira(c.guideManual.cost)],
          ['Dozer', `${fmt(c.dozer.days, 3)} (${c.dozer.daysWhole})`, naira(c.dozer.cost)],
          ['Bale loader', fmt(c.loader.days, 3), naira(c.loader.cost)],
        ]}
      />
      <Note>
        Cheapest: {c.cheapest.id} ({naira(c.cheapest.cost)}). The dozer and bale loader cost the same here, but the dozer finishes in a third of the time — and time before the rains matters.
      </Note>
    </Section>
  )
}

export function LandClearingPanel() {
  const st = useClearing()
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Section title="Sequence">
        <div className="mb-2 grid grid-cols-5 gap-1">
          {STAGES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPreset(null)
                setAndEnter({ stage: s.id as Stage })
              }}
              className={`rounded-md border px-1 py-1 text-[11px] ${st.stage === s.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Segmented<Method>
          label="Knock-down method"
          value={st.method}
          options={(Object.keys(METHODS) as Method[]).map((k) => ({ value: k, label: METHODS[k].label }))}
          onChange={(method) => {
            setPreset(null)
            setAndEnter({ method })
          }}
          size="sm"
        />
        <Note>{METHODS[st.method].text}</Note>
        <Toggle label="Play the stages in order" checked={st.auto} onChange={(auto) => st.set({ auto })} />
      </Section>
      <Section title="Exam presets">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <Factors />
      <CostWorking />
    </div>
  )
}
