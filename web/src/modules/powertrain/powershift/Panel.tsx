import { useMemo, useState } from 'react'
import { SRC } from '@/content/citations'
import { frictionRadiusUniformWear } from '@/physics/clutch'
import { radToRpm, rpmToRad } from '@/physics/gearing'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PowerLegend, PresetGrid, Table, type Preset } from '../common/PanelBits'
import { PACK, PISTON_AREA, RATIO, REDUCTION, Z, type Sel } from './dims'
import { CAPACITY, SURFACES, idealOverlap, releaseTime, live, planShift, usePS, type PSParams, type Phase } from './model'

const set = (p: Partial<PSParams>) => usePS.getState().set(p)

const SEL_LABEL: Record<Sel, string> = { H: 'High (direct)', L: 'Low (underdrive)', R: 'Reverse', N: 'Neutral' }
const PHASE_LABEL: Record<Phase, string> = { drive: 'Driving', shift: 'Shifting on the go', stop: 'Stopping to reverse', fill: 'Clutch filling', neutral: 'Neutral' }

function LivePanel() {
  const v = useLive(() => ({ ...live, e: { ...live.e } }), 15, (a, b) => a.output === b.output && a.input === b.input && a.phase === b.phase && a.e.H === b.e.H && a.e.L === b.e.L && a.e.R === b.e.R)
  const ratio = Math.abs(v.input) > 1 ? v.output / v.input : NaN
  return (
    <Section title="Live" right={<Badge tone={v.phase === 'drive' ? 'accent' : 'warn'}>{PHASE_LABEL[v.phase]}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Selected" value={SEL_LABEL[v.sel]} tone="accent" />
        <Readout label="Input" value={fmt(v.input, 4)} unit="rpm" />
        <Readout label="Output" value={fmt(v.output, 4)} unit="rpm" tone="info" />
        <Readout label="Countershaft" value={fmt(v.counter, 4)} unit="rpm" />
        <Readout label="ω_out/ω_in" value={Number.isFinite(ratio) ? fmt(ratio, 3) : '—'} />
        <Readout label="Clutches H/L/R" value={`${Math.round(v.e.H * 100)}/${Math.round(v.e.L * 100)}/${Math.round(v.e.R * 100)}`} unit="%" />
      </div>
    </Section>
  )
}

function Controls() {
  const s = usePS()
  const ideal = idealOverlap(s.fill, s.torque)
  return (
    <Section title="Controls">
      <Segmented<Sel>
        label="Shift lever (shift valve)"
        value={s.sel}
        onChange={(sel) => set({ sel })}
        options={[
          { value: 'R', label: 'R' },
          { value: 'N', label: 'N' },
          { value: 'L', label: 'Low' },
          { value: 'H', label: 'High' },
        ]}
      />
      <Slider label="Engine speed (governed)" value={s.engineRpm} min={800} max={2400} step={10} unit="rpm" onChange={(engineRpm) => set({ engineRpm })} />
      <Slider label="Engine torque into the unit" value={s.torque} min={50} max={500} step={5} unit="N·m" onChange={(torque) => set({ torque })} />
      <Slider label="On-coming clutch fill time" value={s.fill} min={0.05} max={0.6} step={0.01} unit="s" onChange={(fill) => set({ fill })} />
      <Slider
        label="Off-going release delay (overlap)"
        value={s.overlap}
        min={-0.3}
        max={0.6}
        step={0.005}
        unit="s"
        onChange={(overlap) => set({ overlap })}
        hint="Time from the start of the on-coming fill to the start of the off-going release. Negative = released before the other fills."
      />
      <button className="mb-2 text-[11.5px] text-info hover:underline" onClick={() => set({ overlap: ideal })}>
        Set the ideal overlap ({fmt(ideal, 3)} s)
      </button>
      <Toggle label="Show oil flow" checked={s.flows} onChange={(flows) => set({ flows })} />
      <Toggle label="Colour the power path" checked={s.powerFlow} onChange={(powerFlow) => set({ powerFlow })} />
      {s.powerFlow ? <PowerLegend /> : null}
      <Note>
        High ↔ Low changes on the go, under load, by overlapping the clutches. Changing between forward and reverse stops the tractor first. Clutch sizes, pressures and tooth numbers are typical values.
      </Note>
    </Section>
  )
}

const PRESETS: Preset[] = [
  { id: 'high', label: 'High: direct 1 : 1', note: 'Direct clutch locks input to output.', apply: () => set({ sel: 'H' }) },
  { id: 'low', label: 'Low: underdrive', note: `Underdrive clutch: power goes through the countershaft, ω_out/ω_in = ${fmt(RATIO.L, 3)}.`, apply: () => set({ sel: 'L' }) },
  { id: 'reverse', label: 'Reverse', note: `Reverse clutch: one more mesh (idler), so the output turns backwards, ω_out/ω_in = ${fmt(RATIO.R, 3)}.`, apply: () => set({ sel: 'R' }) },
  {
    id: 'good',
    label: 'Good overlap',
    note: 'Off-going clutch released as the on-coming one takes the engine torque: no power interruption. Now flip High ↔ Low.',
    apply: () => {
      const s = usePS.getState()
      set({ overlap: idealOverlap(s.fill, s.torque) })
    },
  },
  { id: 'early', label: 'Released too early', note: 'The off-going clutch lets go before the other has filled: a torque hole and the engine flares.', apply: () => set({ overlap: -0.15 }) },
  { id: 'late', label: 'Released too late', note: 'Both clutches stay applied: they fight (tie-up), output torque dips and heat rises.', apply: () => set({ overlap: 0.45 }) },
]

function Presets() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <Section title="Examples">
      <PresetGrid presets={PRESETS} active={active} onPick={setActive} />
    </Section>
  )
}

function ShiftChart() {
  const s = usePS()
  const from: 'H' | 'L' = s.sel === 'L' ? 'H' : 'L'
  const to: 'H' | 'L' = from === 'H' ? 'L' : 'H'
  const wGov = rpmToRad(s.engineRpm)
  const tr = useMemo(() => planShift(from, to, wGov / REDUCTION[from], s), [from, to, wGov, s])
  const data = useMemo(() => {
    const every = 5
    const pick = (a: number[]) => a.filter((_, i) => i % every === 0)
    return [pick(tr.t), pick(tr.Tout), pick(tr.Ton.map((x) => x * REDUCTION[to])), pick(tr.Toff.map((x) => x * REDUCTION[from])), pick(tr.wIn.map((w) => radToRpm(w) / 10))]
  }, [tr, from, to])
  const steady = s.torque * REDUCTION[from]
  const minOut = Math.min(...tr.Tout)
  const maxRpm = radToRpm(Math.max(...tr.wIn))
  const hole = minOut < 0.5 * Math.min(steady, s.torque * REDUCTION[to])
  return (
    <Section title={`Shift ${from} → ${to} under load`}>
      <Chart
        data={data}
        series={[
          { label: 'output torque', color: '#9bd17a', width: 2 },
          { label: 'on-coming', color: '#6fb3e0' },
          { label: 'off-going', color: '#e8794f' },
          { label: 'engine rpm/10', color: '#f5b942', dash: [4, 3] },
        ]}
        xLabel="Time from shift (s)"
        yLabel="Output-shaft N·m  ·  rpm/10"
        marker={() => (live.shiftT >= 0 ? [live.shiftT, tr.Tout[Math.min(tr.Tout.length - 1, Math.round(live.shiftT / (tr.t[1] - tr.t[0])))]] : null)}
        height={190}
      />
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        <Readout label="Min output torque" value={fmt(minOut, 3)} unit="N·m" tone={hole ? 'warn' : 'accent'} />
        <Readout label="Peak engine speed" value={fmt(maxRpm, 4)} unit="rpm" tone={maxRpm > s.engineRpm * REDUCTION[from] * 1.02 && from === 'L' ? 'warn' : 'ink'} />
        <Readout label="Clutch heat" value={fmt(tr.heat / 1000, 3)} unit="kJ" />
      </div>
      <Note>
        Green: torque on the output shaft (green line never near zero = no interruption of power). Blue / red: torque carried by each clutch, referred to the output. Overlap model: standard shift dynamics (indicative).
      </Note>
    </Section>
  )
}

function PathTable() {
  const sel = usePS((s) => s.sel)
  const rows: [Sel, string, string, number][] = [
    ['H', 'Direct clutch', 'input → output', RATIO.H],
    ['L', 'Underdrive clutch', `input ${Z.a} → ${Z.b} countershaft ${Z.c} → ${Z.d} output`, RATIO.L],
    ['R', 'Reverse clutch', `input ${Z.a} → ${Z.b} countershaft ${Z.e} → idler ${Z.idler} → ${Z.f} output`, RATIO.R],
  ]
  return (
    <Section title="Clutches and power paths">
      <Table head={['', 'Clutch applied', 'Gears', 'ω_o/ω_i']} rows={rows.map((r) => [r[0], r[1], r[2], fmt(r[3], 3)])} highlight={rows.findIndex((r) => r[0] === sel)} />
      <Note>High-low needs 2 clutches; high-low-reverse 3. More speeds come from more countershafts and clutches.</Note>
    </Section>
  )
}

function PSWorking() {
  const s = usePS()
  const Rf = frictionRadiusUniformWear(PACK.Ro, PACK.Ri)
  const F = PACK.pressure * PISTON_AREA - PACK.spring
  const steps: WorkingStep[] = [
    {
      label: 'Underdrive ratio (two external meshes, same direction)',
      tex: '\\dfrac{N_{out}}{N_{in}} = \\dfrac{z_a}{z_b}\\cdot\\dfrac{z_c}{z_d}',
      sub: `= \\dfrac{${Z.a}}{${Z.b}}\\cdot\\dfrac{${Z.c}}{${Z.d}}`,
      result: `= ${n(RATIO.L, 4)}`,
      cite: SRC.top510('p4 — Π drivers / Π followers'),
    },
    {
      label: 'Reverse ratio (three meshes: output reversed; the idler cancels)',
      tex: '\\dfrac{N_{out}}{N_{in}} = -\\dfrac{z_a}{z_b}\\cdot\\dfrac{z_e}{z_f}',
      sub: `= -\\dfrac{${Z.a}}{${Z.b}}\\cdot\\dfrac{${Z.e}}{${Z.f}}`,
      result: `= ${n(RATIO.R, 4)}`,
      cite: SRC.pt510('p4 — reverse through the countershaft'),
    },
    {
      label: 'Piston clamping force',
      tex: 'F = p\\,\\pi(r_o^2-r_i^2) - F_{spring}',
      sub: `= ${n(PACK.pressure / 1e5, 3)}\\times10^5\\,\\pi(${PACK.pistonOut}^2-${PACK.pistonIn}^2) - ${PACK.spring}`,
      result: `= ${n(F, 4)}\\ \\text{N}`,
      cite: SRC.m503(8, 'F = pπ(Ro² − Ri²)'),
    },
    {
      label: 'Clutch-pack torque capacity (uniform wear)',
      tex: 'T = F f R_f n,\\quad R_f=\\tfrac{R_o+R_i}{2},\\quad n = n_1+n_2-1',
      sub: `= ${n(F, 4)}\\times${PACK.mu}\\times${n(Rf, 3)}\\times${SURFACES}`,
      result: `= ${n(CAPACITY, 4)}\\ \\text{N·m}`,
      cite: SRC.m503(8, 'Fig 14-1, T = F f R_f n'),
    },
    {
      label: 'Overlap: the off-going clutch must be fully released when the on-coming one can carry the engine torque',
      tex: 't_{ov} = t_{fill}\\,\\dfrac{T_e}{T_{max}} - t_{rel},\\quad t_{rel} = t_{fill}/4',
      sub: `= ${n(s.fill, 3)}\\times\\dfrac{${s.torque}}{${n(CAPACITY, 4)}} - ${n(releaseTime(s.fill), 3)}`,
      result: `= ${n(idealOverlap(s.fill, s.torque), 3)}\\ \\text{s}\\quad(\\text{set: } ${n(s.overlap, 3)}\\ \\text{s})`,
      beyond: true,
      cite: SRC.beyond('linear pressure ramp; standard powershift timing'),
    },
  ]
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function PowershiftPanel() {
  return (
    <div>
      <LivePanel />
      <Controls />
      <Presets />
      <ShiftChart />
      <PathTable />
      <PSWorking />
    </div>
  )
}

