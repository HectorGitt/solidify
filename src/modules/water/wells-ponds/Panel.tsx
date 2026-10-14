import { useMemo, useState } from 'react'
import { NumberField, PresetGrid, Table, type Preset } from '@/modules/vibration/_shared/ui'
import { AQUIFER_TABLE, RADIUS_TABLE, irrigableArea, twoWellUnconfined, wellDrawdown } from '@/physics/water'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { C, DEFAULTS, POND_S1, live, pondOf, useWells, wellOf, type Mode } from './model'

const DAY = 86400

function LivePanel() {
  const st = useWells()
  const w = useMemo(() => wellOf(st), [st])
  const pd = useMemo(() => pondOf(st), [st])
  const v = useLive(() => ({ ...live }), 8, (a, b) => a.k === b.k && a.vol === b.vol)
  if (st.mode === 'pond')
    return (
      <Section title="Live" right={<Badge tone="info">season</Badge>}>
        <div className="grid grid-cols-3 gap-1.5">
          <Readout label="Annual needs" value={fmt(pd.total, 4)} unit="ha-m" />
          <Readout label="Storage" value={fmt(pd.storage, 4)} unit="ha-m" tone="accent" />
          <Readout label="In the pond now" value={fmt(v.vol * 100, 3)} unit="%" tone="info" />
        </div>
      </Section>
    )
  return (
    <Section title="Live" right={<Badge tone={st.pumping ? 'accent' : 'mute'}>{st.pumping ? `cone ${fmt(v.k * 100, 2)} % developed` : 'pump off'}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Discharge Q" value={fmt(w.Q, 4)} unit="m³/day" tone="accent" />
        <Readout label="" value={fmt((w.Q / DAY) * 1000, 4)} unit="L/s" />
        <Readout label="Level in well h_w" value={fmt(w.hw, 4)} unit="m" />
        <Readout label={`s₁ at ${fmt(st.r1, 3)} m`} value={fmt(w.s1, 3)} unit="m" tone="info" />
        <Readout label={`s₂ at ${fmt(st.r2, 3)} m`} value={fmt(w.s2, 3)} unit="m" tone="info" />
        <Readout label="Transmissibility" value={fmt(w.T, 4)} unit="m²/day" />
      </div>
      <p className="mt-1 text-[11px] text-dim">Drawn to a display scale: R spans 24 m and H spans 12 m in the view, so the cone is shown exaggerated vertically.</p>
    </Section>
  )
}

function Controls() {
  const st = useWells()
  return (
    <Section title="Controls">
      <Segmented<Mode>
        value={st.mode}
        onChange={(mode) => st.set({ mode })}
        size="sm"
        options={[
          { value: 'unconfined', label: 'Gravity well' },
          { value: 'confined', label: 'Artesian well' },
          { value: 'pond', label: 'Farm pond' },
        ]}
      />
      {st.mode !== 'pond' ? (
        <>
          <Toggle label="Pump running" checked={st.pumping} onChange={(pumping) => st.set({ pumping })} />
          <Slider label="Hydraulic conductivity K" value={st.K} min={0.1} max={50} step={0.01} unit="m/day" onChange={(K) => st.set({ K })} />
          <Slider label={st.mode === 'confined' ? 'Piezometric head H' : 'Saturated thickness H'} value={st.H} min={5} max={40} step={0.01} unit="m" onChange={(H) => st.set({ H, sw: Math.min(st.sw, H * 0.95), d: Math.min(st.d, H * 0.9) })} />
          {st.mode === 'confined' ? <Slider label="Aquifer thickness d" value={st.d} min={1} max={st.H * 0.9} step={0.1} unit="m" onChange={(d) => st.set({ d })} /> : null}
          <Slider label="Drawdown in the well s_w" value={st.sw} min={0.2} max={st.H * 0.95} step={0.01} unit="m" onChange={(sw) => st.set({ sw })} />
          <Slider label="Radius of influence R" value={st.R} min={30} max={600} step={1} unit="m" onChange={(R) => st.set({ R })} />
          <Slider label="Well radius r_w" value={st.rw} min={0.05} max={0.6} step={0.005} unit="m" onChange={(rw) => st.set({ rw })} />
        </>
      ) : (
        <>
          <NumberField label="Persons" value={st.persons} step={1} onChange={(persons) => st.set({ persons })} />
          <NumberField label="Dry cows / steers" value={st.steers} step={10} onChange={(steers) => st.set({ steers })} />
          <NumberField label="Milk cows" value={st.milkCows} step={10} onChange={(milkCows) => st.set({ milkCows })} />
          <NumberField label="Horses" value={st.horses} step={1} onChange={(horses) => st.set({ horses })} />
          <NumberField label="Swine (hogs)" value={st.swine} step={10} onChange={(swine) => st.set({ swine })} />
          <NumberField label="Sheep" value={st.sheep} step={10} onChange={(sheep) => st.set({ sheep })} />
          <NumberField label="Chickens" value={st.chickens} step={100} onChange={(chickens) => st.set({ chickens })} />
          <NumberField label="Turkeys" value={st.turkeys} step={100} onChange={(turkeys) => st.set({ turkeys })} />
          <NumberField label="Irrigated area" value={st.irrHa} step={0.5} unit="ha" onChange={(irrHa) => st.set({ irrHa })} />
          <NumberField label="Irrigation depth" value={st.irrDepth} step={0.05} unit="m/season" onChange={(irrDepth) => st.set({ irrDepth })} />
          <Toggle label="Fire protection" checked={st.fire} onChange={(fire) => st.set({ fire })} />
          <Slider label="Losses (seepage, evaporation…)" value={st.loss * 100} min={0} max={60} step={1} unit="% of storage" onChange={(v) => st.set({ loss: v / 100 })} />
        </>
      )}
    </Section>
  )
}

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  const set = useWells.getState().set
  const presets: Preset[] = [
    { id: 's1q3d', label: 'Gravity well, K 76 mm/h', note: 'r_w = 0.305 m, H = 24.38 m, drawdown 9.14 m → h_w = 15.24 m, K = 1.824 m/day, R = 183 m: Q = π(1.824)(594.4 − 232.3)/ln 600 = 324 m³/day ≈ 3.75 L/s.', apply: () => set({ ...DEFAULTS }) },
    { id: 's1q2d-a', label: 'K 0.05 m/s, r_w 10 cm', note: 'H = 10 m, s = 4 m, R = 300 m: Q = 1.256 m³/s (108,500 m³/day).', apply: () => set({ ...DEFAULTS, K: 0.05 * DAY, H: 10, sw: 4, R: 300, rw: 0.1 }) },
    { id: 's1q2d-b', label: '… r_w doubled to 20 cm', note: 'Q = 1.375 m³/s: only 9.5 % more for twice the radius — well size matters little.', apply: () => set({ ...DEFAULTS, K: 0.05 * DAY, H: 10, sw: 4, R: 300, rw: 0.2 }) },
    { id: 'ps6-2a', label: 'K 21 m/day, r_w 0.19 m', note: 'H = 15 m, s = 6 m, R = 180 m: Q = π·21·(225 − 81)/ln 947 = 1385 m³/day.', apply: () => set({ ...DEFAULTS, K: 21, H: 15, sw: 6, R: 180, rw: 0.19 }) },
    { id: 's1q4d', label: 'Two observation wells', note: 'Q = 1000 L/min = 1440 m³/day; s₁ = 2.62 m at 14 m, s₂ = 1.50 m at 40 m; H = 18 m: K = 13.5 m/day, T = 243 m²/day; drawdown in a 0.15 m well ≈ 8.9 m. See the calculator below.', apply: () => set({ ...DEFAULTS, K: 13.47, H: 18, sw: 8.93, rw: 0.15, R: 300, r1: 14, r2: 40 }) },
    { id: 's1q5c', label: 'Pond: 1000 steers, 10 ha', note: '1000 steers, 500 cows, 100 hogs, 10,000 chickens, 10 ha vegetables at 0.7 m, 10 persons, fire: needs 11.25 ha-m; with 20 % loss storage = 14.06 ha-m.', apply: () => set({ ...DEFAULTS, mode: 'pond', ...POND_S1 }) },
    { id: 's2q5c', label: 'Pond: 5 ha, 8 persons', note: 'Same herd, 5 ha and 8 persons: 7.73 ha-m → 9.66 ha-m.', apply: () => set({ ...DEFAULTS, mode: 'pond', ...POND_S1, irrHa: 5, persons: 8 }) },
  ]
  return (
    <Section title="Exam presets">
      <PresetGrid presets={presets} active={active} onPick={setActive} />
    </Section>
  )
}

function TwoWell() {
  const [q, setQ] = useState({ Q: 1440, H: 18, r1: 14, s1: 2.62, r2: 40, s2: 1.5, rw: 0.15 })
  const r = twoWellUnconfined(q.Q, q.H, q.r1, q.s1, q.r2, q.s2)
  const w = wellDrawdown(q.Q, r.K, q.H, q.r1, r.h1, q.rw)
  const [ps, setPs] = useState({ storage: 9.87, loss: 0.6, depth: 0.61 })
  return (
    <Section title="Exam: aquifer from observation wells; pond area">
      <NumberField label="Q" value={q.Q} step={10} unit="m³/day" onChange={(Q) => setQ({ ...q, Q })} />
      <NumberField label="H" value={q.H} step={0.5} unit="m" onChange={(H) => setQ({ ...q, H })} />
      <NumberField label="r₁" value={q.r1} step={1} unit="m" onChange={(r1) => setQ({ ...q, r1 })} />
      <NumberField label="s₁" value={q.s1} step={0.01} unit="m" onChange={(s1) => setQ({ ...q, s1 })} />
      <NumberField label="r₂" value={q.r2} step={1} unit="m" onChange={(r2) => setQ({ ...q, r2 })} />
      <NumberField label="s₂" value={q.s2} step={0.01} unit="m" onChange={(s2) => setQ({ ...q, s2 })} />
      <NumberField label="Well radius" value={q.rw} step={0.01} unit="m" onChange={(rw) => setQ({ ...q, rw })} />
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="K" value={fmt(r.K, 4)} unit="m/day" tone="accent" />
        <Readout label="T = KH" value={fmt(r.T, 4)} unit="m²/day" />
        <Readout label="s in well" value={fmt(w.sw, 3)} unit="m" tone="accent" />
      </div>
      <div className="mt-2" />
      <NumberField label="Pond storage" value={ps.storage} step={0.1} unit="ha-m" onChange={(storage) => setPs({ ...ps, storage })} />
      <NumberField label="Losses" value={ps.loss * 100} step={5} unit="%" onChange={(v) => setPs({ ...ps, loss: v / 100 })} />
      <NumberField label="Seasonal irrigation depth" value={ps.depth} step={0.01} unit="m" onChange={(depth) => setPs({ ...ps, depth })} />
      <Readout label="Area that can be irrigated" value={fmt(irrigableArea(ps.storage, ps.loss, ps.depth), 4)} unit="ha" tone="accent" />
      <p className="mt-1 text-[11px] text-dim">9.87 ha-m with 60 % loss leaves 3.948 ha-m; ÷ 0.61 m = 6.47 ha.</p>
    </Section>
  )
}

function Charts() {
  const st = useWells()
  const w = useMemo(() => wellOf(st), [st])
  const data = useMemo(() => {
    const xs: number[] = []
    const h: number[] = []
    for (let i = 0; i <= 80; i++) {
      const r = st.rw * Math.pow(st.R / st.rw, i / 80)
      xs.push(r)
      h.push(w.head(r))
    }
    return { xs, h, H: xs.map(() => st.H) }
  }, [st, w])
  if (st.mode === 'pond') return null
  return (
    <Section title="Cone of depression">
      <Chart
        key={st.mode}
        data={[data.xs, data.h, data.H]}
        series={[
          { label: st.mode === 'confined' ? 'Piezometric head' : 'Water table', color: '#5ab4ff', width: 2 },
          { label: 'Original level H', color: '#9ca3af', width: 1, dash: [4, 3] },
        ]}
        xLabel="Distance from the well r (m)"
        yLabel="Head above base (m)"
        marker={() => [st.r1, w.head(st.r1)]}
        height={160}
      />
      <p className="mt-1 text-[11px] text-dim">The cone is steep near the well and flattens towards R, where the drawdown vanishes. Dot: first observation well.</p>
    </Section>
  )
}

function Tables() {
  return (
    <Section title="Aquifer tables">
      <Table head={['Material', 'Porosity %', 'Sp. yield %', 'Rel. K']} rows={AQUIFER_TABLE.map((r) => [r.label, String(r.porosity), String(r.yield), String(r.K)])} />
      <div className="mt-1.5" />
      <Table head={['Formation', 'R (m)']} rows={RADIUS_TABLE.map((r) => [r.label, `${r.lo}–${r.hi}`])} />
    </Section>
  )
}

function WorkingSection() {
  const st = useWells()
  const w = useMemo(() => wellOf(st), [st])
  const pd = useMemo(() => pondOf(st), [st])
  const steps: WorkingStep[] =
    st.mode === 'pond'
      ? [
          { label: 'Annual needs (Table 1)', tex: '\\sum = \\text{persons}(0.01) + \\text{fire}(0.03) + \\text{steers}(0.002) + \\text{milk cows}(0.004) + \\dots + A_{irr}d_{irr}', sub: Object.values(pd.items).filter((v) => v > 0).map((v) => n(v, 4)).join(' + '), result: `= ${n(pd.total, 4)}\\ \\text{ha-m}`, cite: C.wrd('p3 Table 1') },
          { label: 'Gross storage', tex: '\\text{storage} = \\dfrac{\\text{needs}}{1 - \\text{losses}}', sub: `= \\dfrac{${n(pd.total, 4)}}{1 - ${n(st.loss, 3)}}`, result: `= ${n(pd.storage, 4)}\\ \\text{ha-m}`, cite: C.s1('Q5c') },
        ]
      : st.mode === 'confined'
        ? [{ label: 'Artesian well', tex: 'Q = \\dfrac{2\\pi K d (H - h_w)}{\\ln(R/r_w)}', sub: `= \\dfrac{2\\pi(${n(st.K, 4)})(${n(st.d, 3)})(${n(st.H, 4)} - ${n(w.hw, 4)})}{\\ln(${n(st.R, 4)}/${n(st.rw, 3)})}`, result: `= ${n(w.Q, 4)}\\ \\text{m}^3/\\text{day}`, cite: C.wrd('p8–9 confined well') }]
        : [
            { label: 'Darcy, radial flow', tex: 'Q = 2\\pi r h K\\dfrac{dh}{dr} \\Rightarrow \\int_{h_w}^{H} h\\,dh = \\dfrac{Q}{2\\pi K}\\int_{r_w}^{R}\\dfrac{dr}{r}', cite: C.wrd('p7 derivation'), },
            { label: 'Gravity well (Dupuit–Thiem)', tex: 'Q = \\dfrac{\\pi K (H^2 - h_w^2)}{\\ln(R/r_w)}', sub: `= \\dfrac{\\pi(${n(st.K, 4)})(${n(st.H, 4)}^2 - ${n(w.hw, 4)}^2)}{\\ln(${n(st.R, 4)}/${n(st.rw, 3)})}`, result: `= ${n(w.Q, 4)}\\ \\text{m}^3/\\text{day} = ${n((w.Q / DAY) * 1000, 4)}\\ \\text{L/s}`, cite: C.s1('Q3d') },
            { label: 'Drawdown at an observation well', tex: 'h^2 = h_w^2 + \\dfrac{Q\\ln(r/r_w)}{\\pi K}', sub: `r = ${n(st.r1, 3)}\\ \\text{m}`, result: `s_1 = ${n(w.s1, 3)}\\ \\text{m}`, cite: C.wrd('p8') },
          ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function Panel() {
  return (
    <div>
      <LivePanel />
      <Controls />
      <Presets />
      <Charts />
      <WorkingSection />
      <TwoWell />
      <Tables />
    </div>
  )
}
