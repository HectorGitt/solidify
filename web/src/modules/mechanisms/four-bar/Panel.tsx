import { useMemo, useState } from 'react'
import { classify, crankRange, rockerSwing, sweep } from '@/physics/fourbar'
import { Chart } from '@/ui/Chart'
import { Badge, Readout, Section, Segmented, Slider, Toggle, fmt } from '@/ui/controls'
import { useLive } from '@/ui/live'
import { Working, n, type WorkingStep } from '@/ui/Working'
import { Note, PresetGrid, Table, type Preset } from '../../elements/_shared/PanelBits'
import { CRANK_HOLES, KIND_LABEL, KIND_NOTE, arrange, crankHole, deg, fixedChoice, lengths, limitsDeg, live, useFourBar, type FixedChoice } from './model'

const set = (p: Parameters<ReturnType<typeof useFourBar.getState>['set']>[0]) => useFourBar.getState().set(p)

/** the rig's three sets of bars, each tried three ways round */
const SETS: { label: string; values: number[] }[] = [
  { label: '4, 8, 10, 12: S + L < P + Q', values: [4, 8, 10, 12] },
  { label: '4, 6, 9, 12: S + L > P + Q', values: [4, 6, 9, 12] },
  { label: '4, 6, 10, 12: S + L = P + Q', values: [4, 6, 10, 12] },
]

const CHOICES: { value: FixedChoice; label: string }[] = [
  { value: 'crank', label: 'Shortest = crank' },
  { value: 'frame', label: 'Shortest fixed' },
  { value: 'coupler', label: 'Opposite shortest fixed' },
]

export const PRESETS: Preset[] = [
  {
    id: 'wiper',
    label: 'Windscreen wiper',
    note: 'A crank-rocker: the motor turns the small crank continuously and the wiper arm on the output lever sweeps to and fro. Too wide a sweep? Shorten the crank.',
    apply: () => set({ frame: 8, crank: 2.5, coupler: 12, rocker: 10 }),
  },
  {
    id: 'coupled',
    label: 'Locomotive coupling rod',
    note: 'Opposite links equal and the crank-to-crank link fixed: a parallelogram, so both cranks turn together at the same speed.',
    apply: () => set({ frame: 12, crank: 4, coupler: 12, rocker: 4 }),
  },
  {
    id: 'equal',
    label: 'Two opposite links equal',
    note: 'The lab’s last case: with a pair of opposite links equal, the linkage sits on the change point.',
    apply: () => set({ frame: 8, crank: 6, coupler: 8, rocker: 6 }),
  },
]

function LivePanel() {
  const s = useFourBar()
  const l = lengths(s)
  const c = classify(l)
  const pose = useLive(() => live.pose, 15)
  const mech = pose ? Math.abs(pose.mechanicalAdvantage) : 0
  return (
    <Section title="Live" right={<Badge tone={c.kind === 'impossible' ? 'warn' : 'info'}>{KIND_LABEL[c.kind]}</Badge>}>
      <div className="grid grid-cols-3 gap-1.5">
        <Readout label="Crank angle" value={pose ? fmt(((deg(pose.theta2) % 360) + 360) % 360, 3) : '–'} unit="°" />
        <Readout label="Output lever" value={pose ? fmt(deg(pose.theta4), 3) : '–'} unit="°" />
        <Readout label="Transmission" value={pose ? fmt(deg(pose.gamma), 3) : '–'} unit="°" tone="accent" />
        <Readout label="Crank to coupler" value={pose ? fmt(deg(pose.beta), 3) : '–'} unit="°" />
        <Readout label="Speed ratio" value={pose ? fmt(pose.velocityRatio, 3) : '–'} />
        <Readout label="Advantage" value={pose ? (mech > 50 ? '> 50' : fmt(mech, 3)) : '–'} tone="warn" />
      </div>
      <Note>{KIND_NOTE[c.kind]}</Note>
    </Section>
  )
}

function Links() {
  const s = useFourBar()
  const l = lengths(s)
  const c = classify(l)
  const current = fixedChoice(l)
  const values = [s.frame, s.crank, s.coupler, s.rocker]
  return (
    <Section title="The links">
      <Slider label="Frame, link 1" value={s.frame} min={1} max={16} step={0.5} unit="cm" onChange={(frame) => set({ frame })} />
      <Slider label="Crank, link 2" value={s.crank} min={0.5} max={14} step={0.5} unit="cm" onChange={(crank) => set({ crank })} />
      <Slider label="Coupler, link 3" value={s.coupler} min={1} max={16} step={0.5} unit="cm" onChange={(coupler) => set({ coupler })} />
      <Slider label="Output lever, link 4" value={s.rocker} min={1} max={14} step={0.5} unit="cm" onChange={(rocker) => set({ rocker })} />
      <div className="mb-1 mt-2 text-[12.5px] font-medium text-ink/90">Same bars, a different link fixed</div>
      <Segmented<FixedChoice> value={current ?? 'crank'} onChange={(choice) => set(arrange(values, choice))} options={CHOICES} />
      <div className="mt-2 grid grid-cols-1 gap-1">
        {SETS.map((x) => (
          <button key={x.label} onClick={() => set(arrange(x.values, current ?? 'crank'))} className="rounded-md border border-line-2 px-2 py-1 text-left text-[11.5px] text-ink/85 hover:border-accent/50">
            {x.label}
          </button>
        ))}
      </div>
      <Note>
        S + L = {fmt(c.sumSL, 3)} cm, P + Q = {fmt(c.sumPQ, 3)} cm: {c.grashof ? 'at least one link can turn fully.' : 'no link can turn fully.'}
      </Note>
      <Slider label="Crank speed" value={s.rpm} min={2} max={60} step={1} unit="rpm" onChange={(rpm) => set({ rpm })} />
      <Toggle label="Other assembly (crossed)" checked={s.branch === -1} onChange={(v) => set({ branch: v ? -1 : 1 })} />
      <Toggle label="Trace the coupler curve" checked={s.trace} onChange={(trace) => set({ trace })} />
    </Section>
  )
}

function Charts() {
  const s = useFourBar()
  const l = lengths(s)
  const data = useMemo(() => {
    const pts = sweep(l, 181)
    return { x: pts.map((p) => p.theta2), out: pts.map((p) => p.theta4), gamma: pts.map((p) => p.gamma) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.frame, s.crank, s.coupler, s.rocker])
  if (data.x.length < 3) return null
  const wrap = (a: number) => (crankRange(l) ? a : ((a % 360) + 360) % 360)
  return (
    <Section title="Through a cycle">
      <Chart data={[data.x, data.gamma]} series={[{ label: 'γ', color: '#9bd17a', width: 2 }]} xLabel="Crank angle (°)" yLabel="Transmission angle (°)" marker={() => [wrap(deg(live.theta)), live.pose ? deg(live.pose.gamma) : 0]} height={140} />
      <Chart data={[data.x, data.out]} series={[{ label: 'Output', color: '#6fb3e0', width: 2 }]} xLabel="Crank angle (°)" yLabel="Output lever (°)" marker={() => [wrap(deg(live.theta)), live.pose ? deg(live.pose.theta4) : 0]} height={140} />
      <Note>The best linkage keeps γ nearest 90°. Force gets through worst where γ is smallest.</Note>
    </Section>
  )
}

/** Effect of crank radius: frame 8, coupler 12, output lever 10 cm, crank in each of four holes. */
function CrankExperiment() {
  const s = useFourBar()
  const rows = CRANK_HOLES.map((r) => {
    const l = crankHole(r)
    const lim = limitsDeg(l)
    return [
      <button key={r} onClick={() => set(l)} className="text-accent hover:underline">
        {r} cm
      </button>,
      fmt(deg(rockerSwing(l)), 3) + '°',
      fmt(lim.min, 3) + '°',
      fmt(lim.max, 3) + '°',
    ]
  })
  const active = s.frame === 8 && s.coupler === 12 && s.rocker === 10 ? CRANK_HOLES.indexOf(s.crank) : -1
  return (
    <Section title="Experiment: crank radius">
      <Table head={['Crank', 'Output swing', 'γ min', 'γ max']} rows={rows} highlight={active >= 0 ? active : undefined} />
      <Note>Frame 8, coupler 12, output lever 10 cm. A bigger crank swings the output further, but opens the range of γ, so force gets through worse at the extremes.</Note>
    </Section>
  )
}

function FourBarWorking() {
  const s = useFourBar()
  const l = lengths(s)
  const c = classify(l)
  const pose = useLive(() => live.pose, 4)
  const steps: WorkingStep[] = [
    {
      label: 'Grashof’s law',
      tex: 'S + L \\le P + Q',
      sub: `${n(c.sumSL, 3)} ${c.sumSL <= c.sumPQ + 1e-9 ? '\\le' : '>'} ${n(c.sumPQ, 3)}`,
      result: c.grashof ? '\\text{at least one link turns fully}' : '\\text{no link turns fully}',
    },
  ]
  if (!crankRange(l)) {
    const lim = limitsDeg(l)
    const d = s.frame
    const r = s.crank
    const flagged = s.frame === 8 && s.crank === 4 && s.coupler === 12 && s.rocker === 10
    steps.push(
      {
        label: 'Smallest γ: crank folded back along the frame',
        tex: '(d-r)^2 = c^2 + e^2 - 2ce\\cos\\gamma_{\\min}',
        sub: `\\cos\\gamma_{\\min} = \\dfrac{${n(s.coupler, 3)}^2 + ${n(s.rocker, 3)}^2 - ${n(Math.abs(d - r), 3)}^2}{2(${n(s.coupler, 3)})(${n(s.rocker, 3)})}`,
        result: `\\gamma_{\\min} = ${n(lim.min, 3)}^\\circ`,
      },
      {
        label: 'Largest γ: crank stretched out along the frame',
        tex: '(d+r)^2 = c^2 + e^2 - 2ce\\cos\\gamma_{\\max}',
        sub: `\\cos\\gamma_{\\max} = \\dfrac{${n(s.coupler, 3)}^2 + ${n(s.rocker, 3)}^2 - ${n(d + r, 3)}^2}{2(${n(s.coupler, 3)})(${n(s.rocker, 3)})}`,
        result: `\\gamma_{\\max} = ${n(lim.max, 3)}^\\circ`,
        errata: flagged ? 'A worked report for this set-up carries 102/240 instead of 100/240 and gets 63.4°; the correct value is 65.4°.' : undefined,
      },
    )
  }
  if (pose) {
    steps.push({
      label: 'Mechanical advantage at this instant',
      tex: 'MA = \\dfrac{e\\sin\\gamma}{r\\sin\\beta}',
      sub: `=\\dfrac{${n(s.rocker, 3)}\\sin ${n(deg(pose.gamma), 3)}^\\circ}{${n(s.crank, 3)}\\sin ${n(deg(pose.beta), 3)}^\\circ}`,
      result: `=${n(Math.abs(pose.mechanicalAdvantage), 3)}`,
    })
  }
  return (
    <Section title="Working">
      <Working steps={steps} />
    </Section>
  )
}

export function FourBarPanel() {
  const [preset, setPreset] = useState<string | null>(null)
  return (
    <div>
      <LivePanel />
      <Links />
      <Section title="Set-ups">
        <PresetGrid presets={PRESETS} active={preset} onPick={setPreset} />
      </Section>
      <CrankExperiment />
      <Charts />
      <FourBarWorking />
      <Section title="Exam points">
        <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
          <li>With S + L &lt; P + Q: shortest as crank gives a crank-rocker, shortest fixed a double crank, shortest opposite the fixed link a double rocker.</li>
          <li>γ is smallest and largest with the crank in line with the frame; both follow from the cosine rule.</li>
          <li>Toggle: crank and coupler in line, β = 0° or 180°. A small crank torque then holds a very large output torque.</li>
          <li>Crank radius zero gives no output swing. A wiper that swings too wide needs a shorter crank.</li>
        </ul>
      </Section>
    </div>
  )
}
