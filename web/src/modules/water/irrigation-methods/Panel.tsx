import { useMemo, useState } from 'react'
import { NumberField, PresetGrid, type Preset } from '@/modules/vibration/_shared/ui'
import { GAL_PER_ACRE_INCH, acresFromGpm, christiansen, hoursPerWeek, requiredGpm } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Bullets } from '../_shared/fx'
import { C, CRITERIA, FIELD, METHODS, finalDepth, live, sprinklerCatch, useIrr, type Method } from './model'

type BudgetMode = 'hours' | 'gpm' | 'acres'
interface Budget {
  mode: BudgetMode
  et: number
  acres: number
  gph: number
  hoursPerDay: number
  gpm: number
  label: string
}
const BUDGET0: Budget = { mode: 'hours', et: 0.15, acres: 1, gph: 0.74 * 145.2 * 60, hoursPerDay: 12, gpm: 15, label: 'Drip, 1 acre of T-tape' }

function LivePanel() {
  const v = useLive(() => ({ ...live }), 10, (a, b) => a.u === b.u)
  const st = useIrr()
  const phase = v.u >= 1 ? 'finished — holding' : v.flowing ? 'water on' : 'inflow cut off'
  return (
    <Section title="Live" right={<Badge tone={v.flowing ? 'accent' : 'mute'}>{phase}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Event" value={fmt(Math.min(100, v.u * 100), 3)} unit="%" />
        <Readout label="Wetted surface" value={fmt(v.wetFrac * 100, 3)} unit="%" tone="info" />
        {st.method === 'basin' || st.method === 'border' || st.method === 'furrow' ? <Readout label="Front advance" value={fmt(v.front, 3)} unit="m" /> : <Readout label="Method" value={METHODS[st.method].label} />}
        <Readout label="Depth at head" value={fmt(v.dHeadNow, 3)} unit="m" tone="accent" />
        <Readout label="Depth at tail" value={fmt(v.dTailNow, 3)} unit="m" tone="accent" />
        <Readout label="Root zone" value={fmt(st.root, 3)} unit="m" />
      </div>
    </Section>
  )
}

function MethodSection() {
  const st = useIrr()
  const m = METHODS[st.method]
  return (
    <Section title="Method">
      <Segmented<Method>
        value={st.method}
        onChange={(method) => st.set({ method })}
        size="sm"
        options={(Object.keys(METHODS) as Method[]).map((k) => ({ value: k, label: METHODS[k].label.replace('Sub-irrigation', 'Sub') }))}
      />
      <p className="mb-1.5 text-[11.5px] leading-snug text-ink/85">{m.how}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-0.5 text-[11px] font-medium text-accent">Advantages</div>
          <Bullets items={m.pros} />
        </div>
        <div>
          <div className="mb-0.5 text-[11px] font-medium text-warn">Drawbacks</div>
          <Bullets items={m.cons} />
        </div>
      </div>
    </Section>
  )
}

function Controls() {
  const st = useIrr()
  const surface = st.method === 'basin' || st.method === 'border' || st.method === 'furrow'
  return (
    <Section title="Controls">
      {surface ? (
        <>
          <Slider label="Final depth at head" value={st.dHead} min={0.3} max={2.4} step={0.05} unit="m" onChange={(dHead) => st.set({ dHead })} />
          <Slider label="Final depth at tail" value={st.dTail} min={0.2} max={2.4} step={0.05} unit="m" onChange={(dTail) => st.set({ dTail })} />
        </>
      ) : null}
      <Slider label="Root-zone depth" value={st.root} min={0.4} max={2.2} step={0.05} unit="m" onChange={(root) => st.set({ root })} />
      {st.method === 'sprinkler' ? <Slider label="Wetted radius (illustrative)" value={st.wetRadius} min={3} max={8} step={0.25} unit="m" onChange={(wetRadius) => st.set({ wetRadius })} hint="Head spacing is 6 m; the radius sets the overlap." /> : null}
      <Slider label="Event length" value={st.cycle} min={8} max={60} step={1} unit="s" onChange={(cycle) => st.set({ cycle })} />
    </Section>
  )
}

function ProfileChart() {
  const st = useIrr()
  const data = useMemo(() => {
    const xs: number[] = []
    const d: number[] = []
    const r: number[] = []
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * FIELD.L
      xs.push(x)
      const wx = x - FIELD.L / 2
      d.push(st.method === 'sprinkler' ? 0.75 * sprinklerCatch(wx, 0, st.wetRadius) : st.method === 'basin' ? (st.dHead + st.dTail) / 2 : st.method === 'drip' || st.method === 'sub' ? NaN : finalDepth(st, wx))
      r.push(st.root)
    }
    return { xs, d: d.map((v) => (Number.isFinite(v) ? v : null)), r }
  }, [st])
  if (st.method === 'drip' || st.method === 'sub') return null
  const vals = data.d.filter((v): v is number => v !== null)
  const ch = christiansen(vals)
  return (
    <Section title="Final wetting depth along the run">
      <Chart
        key={st.method}
        data={[data.xs, data.d, data.r]}
        series={[
          { label: st.method === 'sprinkler' ? 'Depth (relative catch)' : 'Wetting depth', color: '#5ab4ff', width: 2 },
          { label: 'Root zone', color: '#e8d06a', width: 1.5, dash: [4, 3] },
        ]}
        xLabel="Distance from head (m)"
        yLabel="Depth (m)"
        marker={() => [live.front, live.dHeadNow > 0 ? (st.method === 'sprinkler' ? live.dHeadNow : finalDepth(st, live.front - FIELD.L / 2)) : 0]}
        height={160}
      />
      <p className="mt-1 text-[11px] leading-snug text-dim">
        Distribution (Christiansen) uniformity of this profile: E_d = {fmt(ch.Ed * 100, 3)} %. {st.method === 'sprinkler' ? 'Overlap between neighbouring heads evens out the catch; the pattern shape is illustrative.' : 'Water reaching below the root-zone line at the head is deep percolation; at the tail the root zone may be under-irrigated.'}
      </p>
    </Section>
  )
}

function SelectionSection() {
  return (
    <Section title="Exam: choosing an irrigation method">
      <Bullets items={CRITERIA} />
      <p className="mt-1.5 text-[11.5px] leading-snug text-ink/85">
        <b>Surface</b> when slopes are gentle and uniform, soils medium or fine, water ample and labour cheap. <b>Sprinkler</b> on sandy or shallow soils, undulating land, where water is scarce or light, frequent applications are needed.
      </p>
    </Section>
  )
}

function BudgetSection() {
  const [b, setB] = useState<Budget>(BUDGET0)
  const [preset, setPreset] = useState<string | null>('ex1')
  const presets: Preset[] = [
    { id: 'ex1', label: 'Drip: hours per week', note: '1 acre, ET 0.15 in/day → 28,516 gal/week; T-tape 0.74 gpm/100 ft × 14,520 row-ft = 6446 gal/h → 4.4 h/week (in 2–3 sets).', apply: () => { useIrr.getState().set({ method: 'drip' }); setB({ ...BUDGET0 }) } },
    { id: 'ex2', label: 'Sprinkler: hours per week', note: '1/8″ nozzle at 45 psi = 3 gpm; 20 × 20 ft spacing → 110 heads = 19,800 gal/h → 1.4 h/week (1.6–1.7 h with 10–20 % for losses).', apply: () => { useIrr.getState().set({ method: 'sprinkler' }); setB({ ...BUDGET0, gph: 19800, label: 'Sprinklers, 110 × 3 gpm' }) } },
    { id: 'ex3', label: 'Drip bed (100 ft²)', note: '62.3 gal/week; 150 emitters × 0.334 gal/h = 50.1 gal/h → 1.25 h/week.', apply: () => { useIrr.getState().set({ method: 'drip' }); setB({ ...BUDGET0, et: 62.3 / 7 / (GAL_PER_ACRE_INCH * (100 / 43560)), acres: 100 / 43560, gph: 50.1, label: '100 ft² bed, 150 emitters' }) } },
    { id: 'ex5', label: 'Pump flow for 10 acres', note: '10 acres, ET 0.30 in/day, 75 % efficiency (× 1.25), 12 h/day → 141 gpm (70 gpm pumping 24 h).', apply: () => setB({ ...BUDGET0, mode: 'gpm', et: 0.3, acres: 10, hoursPerDay: 12, label: '10 acres' }) },
    { id: 'ex6', label: 'Acres from a 15 gpm well', note: '15 gpm, ET 0.20 in/day, 12 h/day → 1.6 acres (3.2 at 24 h).', apply: () => setB({ ...BUDGET0, mode: 'acres', et: 0.2, gpm: 15, hoursPerDay: 12, label: '15 gpm well' }) },
    { id: 'gradient', label: 'Head–tail gradient (1.8 → 1.2 m)', note: 'The efficiency problem: penetration falls linearly from 1.8 m at the head to 1.2 m at the tail over a 1.8 m root zone — E_d = 90 %. Efficiencies are worked in the water-requirement scene.', apply: () => useIrr.getState().set({ method: 'border', dHead: 1.8, dTail: 1.2, root: 1.8 }) },
  ]
  const hw = hoursPerWeek(b.et, b.acres, b.gph)
  const gpm = requiredGpm(b.et, b.acres, b.hoursPerDay)
  const ac = acresFromGpm(b.gpm, b.et, b.hoursPerDay)
  const steps: WorkingStep[] =
    b.mode === 'hours'
      ? [
          { label: 'Weekly water need', tex: 'V = ET\\times7\\times A\\times27{,}158\\ \\text{gal per acre-inch}', sub: `= ${n(b.et, 3)}\\times7\\times${n(b.acres, 3)}\\times27{,}158`, result: `= ${n(hw.gal, 5)}\\ \\text{gal/week}`, cite: C.sg('water budget, 1 acre-inch = 27,158 gal') },
          { label: 'Run time', tex: 't = \\dfrac{V}{\\text{system output}}', sub: `= \\dfrac{${n(hw.gal, 5)}}{${n(b.gph, 5)}}`, result: `= ${n(hw.hours, 3)}\\ \\text{h/week};\\ +10\\text{–}20\\%\\ \\Rightarrow ${n(hw.hours * 1.1, 3)}\\text{–}${n(hw.hours * 1.2, 3)}\\ \\text{h}`, cite: C.sg('Exercises 1–3') },
        ]
      : b.mode === 'gpm'
        ? [{ label: 'Required pump flow', tex: 'q = \\dfrac{ET\\times A\\times27{,}158\\times1.25}{\\text{minutes pumped per day}}', sub: `= \\dfrac{${n(b.et, 3)}\\times${n(b.acres, 3)}\\times27{,}158\\times1.25}{${b.hoursPerDay}\\times60}`, result: `= ${n(gpm, 4)}\\ \\text{gpm}`, cite: C.sg('Exercise 5') }]
        : [{ label: 'Area a well can serve', tex: 'A = \\dfrac{q\\times\\text{minutes per day}}{ET\\times27{,}158\\times1.25}', sub: `= \\dfrac{${n(b.gpm, 3)}\\times${b.hoursPerDay * 60}}{${n(b.et, 3)}\\times27{,}158\\times1.25}`, result: `= ${n(ac, 3)}\\ \\text{acres}`, cite: C.sg('Exercise 6') }]
  return (
    <>
      <Section title="Exam presets">
        <PresetGrid presets={presets} active={preset} onPick={setPreset} />
      </Section>
      <Section title="Water budget (US units)">
        <Segmented<BudgetMode>
          value={b.mode}
          onChange={(mode) => setB({ ...b, mode })}
          size="sm"
          options={[
            { value: 'hours', label: 'Hours/week' },
            { value: 'gpm', label: 'Pump gpm' },
            { value: 'acres', label: 'Acres served' },
          ]}
        />
        <NumberField label="ET" value={b.et} step={0.01} unit="in/day" onChange={(et) => setB({ ...b, et })} />
        {b.mode !== 'acres' ? <NumberField label="Area" value={b.acres} step={0.5} unit="acre" onChange={(acres) => setB({ ...b, acres })} /> : null}
        {b.mode === 'hours' ? <NumberField label="System output" value={b.gph} step={100} unit="gal/h" onChange={(gph) => setB({ ...b, gph })} /> : null}
        {b.mode === 'acres' ? <NumberField label="Well yield" value={b.gpm} step={1} unit="gpm" onChange={(gpm) => setB({ ...b, gpm })} /> : null}
        {b.mode !== 'hours' ? <NumberField label="Pumping per day" value={b.hoursPerDay} step={1} unit="h" onChange={(hoursPerDay) => setB({ ...b, hoursPerDay })} /> : null}
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {b.mode === 'hours' ? <Readout label="Run time" value={fmt(hw.hours, 3)} unit="h/week" tone="accent" /> : b.mode === 'gpm' ? <Readout label="Pump flow" value={fmt(gpm, 4)} unit="gpm" tone="accent" /> : <Readout label="Area" value={fmt(ac, 3)} unit="acre" tone="accent" />}
          <Readout label="Case" value={b.label} />
        </div>
      </Section>
      <Section title="Working">
        <Working steps={steps} />
      </Section>
    </>
  )
}

export function Panel() {
  return (
    <div>
      <LivePanel />
      <MethodSection />
      <Controls />
      <ProfileChart />
      <BudgetSection />
      <SelectionSection />
    </div>
  )
}

